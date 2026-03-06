import json
import secrets
import hashlib
from decimal import Decimal
from datetime import timedelta, date
from io import BytesIO
from urllib.parse import quote
import django.utils.timezone as timezone
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core import signing
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.core.mail import send_mail, get_connection
from django.db import transaction
from django.db.models import Q, Sum, Min
from django.http import JsonResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
try:
    import razorpay
except ModuleNotFoundError:
    razorpay = None
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import (
    Booking,
    EmailOTP,
    LoginAttempt,
    TrainAvailability,
    UserProfile,
    SelectedTrain,
    PassengerSession
)
from .serializers import BookingSerializer
from .utils import generate_seat_details, generate_pnr, validate_passenger_mix


def _simple_pdf_from_lines(lines):
    # Minimal single-page PDF fallback (no external dependencies).
    def esc(text):
        return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    y = 790
    content_lines = ["BT", "/F1 11 Tf", f"50 {y} Td"]
    for idx, line in enumerate(lines):
        if idx == 0:
            content_lines.append(f"({esc(line)}) Tj")
        else:
            content_lines.append("0 -14 Td")
            content_lines.append(f"({esc(line)}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")

    objects = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    objects.append(b"2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n")
    objects.append(
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n"
    )
    objects.append(
        f"4 0 obj << /Length {len(stream)} >> stream\n".encode("ascii")
        + stream
        + b"\nendstream endobj\n"
    )
    objects.append(b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("ascii"))

    pdf.extend(
        (
            f"trailer << /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF\n"
        ).encode("ascii")
    )
    return bytes(pdf)


@api_view(["GET"])
def api_root(request):
    return Response({"status": "ok"})

def get_data(request):
    try:
        if request.body:
            return json.loads(request.body)
        return request.POST
    except:
        return request.POST


def _client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _record_attempt(request, *, status, username=None, email=None):
    LoginAttempt.objects.create(
        username=username,
        email=email,
        ip_address=_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:1000],
        status=status,
    )


def _is_rate_limited(request, *, username=None, email=None):
    def _has_at_least(queryset, limit):
        # Pull only up to the threshold IDs instead of counting all rows.
        ids = list(queryset.values_list("id", flat=True)[:limit])
        return len(ids) >= limit

    now = timezone.now()
    ip = _client_ip(request)
    recent_window = now - timedelta(minutes=10)
    burst_window = now - timedelta(minutes=1)

    ip_recent = LoginAttempt.objects.filter(ip_address=ip, timestamp__gte=recent_window).order_by("-timestamp")
    if _has_at_least(ip_recent, 40):
        return True

    ip_burst = LoginAttempt.objects.filter(ip_address=ip, timestamp__gte=burst_window).order_by("-timestamp")
    if _has_at_least(ip_burst, 10):
        return True

    if username:
        username_failures = LoginAttempt.objects.filter(
            username=username,
            status__in=["login_failed", "otp_failed", "blocked"],
            timestamp__gte=recent_window,
        ).order_by("-timestamp")
        if _has_at_least(username_failures, 8):
            return True

    if email:
        email_failures = LoginAttempt.objects.filter(
            email=email,
            status__in=["login_failed", "otp_failed", "blocked"],
            timestamp__gte=recent_window,
        ).order_by("-timestamp")
        if _has_at_least(email_failures, 8):
            return True

    return False


def _normalize_device(device):
    if not isinstance(device, dict):
        return None

    required_text_fields = ["ua", "language", "timezone", "platform"]
    for key in required_text_fields:
        value = device.get(key)
        if not isinstance(value, str) or not value.strip():
            return None
        if len(value) > 512:
            return None

    screen_width = device.get("screenWidth")
    screen_height = device.get("screenHeight")
    try:
        screen_width = int(screen_width)
        screen_height = int(screen_height)
    except (TypeError, ValueError):
        return None

    if screen_width <= 0 or screen_height <= 0:
        return None

    return {
        "ua": device["ua"].strip(),
        "language": device["language"].strip(),
        "timezone": device["timezone"].strip(),
        "platform": device["platform"].strip(),
        "screenWidth": screen_width,
        "screenHeight": screen_height,
    }


def _device_fingerprint_hash(device):
    payload = json.dumps(device, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _validate_security_conditions(data):
    honeypot = data.get("honeypot")
    if isinstance(honeypot, str) and honeypot.strip():
        return None, "Invalid request"

    try:
        human_score = float(data.get("humanScore", 0))
    except (TypeError, ValueError):
        human_score = 0.0
    if human_score < 0.5:
        return None, "Invalid request"

    behavior = data.get("behavior", {})
    if not isinstance(behavior, dict):
        return None, "Invalid request"

    typing = behavior.get("typing", {})
    timing = behavior.get("timing", {})
    if not isinstance(typing, dict) or not isinstance(timing, dict):
        return None, "Invalid request"

    duration_ms = typing.get("durationMs", 0)
    submit_ms = timing.get("timeToSubmitMs", 0)
    try:
        duration_ms = int(duration_ms)
        submit_ms = int(submit_ms)
    except (TypeError, ValueError):
        return None, "Invalid request"
    if duration_ms < 800 or submit_ms < 800:
        return None, "Invalid request"

    normalized_device = _normalize_device(data.get("device"))
    if not normalized_device:
        return None, "Invalid request"

    return normalized_device, None


def _masked_email(email):
    if "@" not in email:
        return "registered email"
    local, domain = email.split("@", 1)
    masked_local = (local[:2] + "***") if len(local) >= 2 else "***"
    return f"{masked_local}@{domain}"


def _coerce_journey_date(value):
    if isinstance(value, date):
        return value

    text = str(value or "").strip()
    if not text:
        return None

    try:
        return date.fromisoformat(text)
    except ValueError:
        return None

def _send_login_otp_email(email, otp):
    """
    Send login OTP with a bounded SMTP timeout so login requests do not hang.
    Returns True when at least one message is accepted by the backend.
    """
    smtp_user = str(getattr(settings, "EMAIL_HOST_USER", "") or "").strip()
    smtp_pass = str(getattr(settings, "EMAIL_HOST_PASSWORD", "") or "").strip()

    # If SMTP credentials are not configured, skip email attempt immediately
    # and let OTP fallback flow continue without blocking login.
    if not smtp_user or not smtp_pass:
        return False

    try:
        timeout = int(getattr(settings, "EMAIL_TIMEOUT", 5) or 5)
        connection = get_connection(timeout=max(3, min(timeout, 8)))
        sent_count = send_mail(
            "Your Login OTP",
            f"Your OTP is {otp}",
            settings.DEFAULT_FROM_EMAIL or smtp_user or "noreply@example.com",
            [email],
            fail_silently=False,
            connection=connection,
        )
        return sent_count > 0
    except Exception:
        return False


def _resolve_user_profile(identity, create=False):
    identity = (identity or "").strip()
    if not identity:
        return None

    direct_profile = UserProfile.objects.filter(firebase_uid=identity).first()
    if direct_profile:
        return direct_profile

    user = User.objects.filter(username=identity).first()
    if user and user.email:
        canonical_email = user.email.strip().lower()
        email_profile = UserProfile.objects.filter(firebase_uid=canonical_email).first()
        if email_profile:
            return email_profile
        if create:
            return UserProfile.objects.create(firebase_uid=canonical_email, email=canonical_email)
        return None

    if create:
        email_value = identity.lower() if "@" in identity else None
        return UserProfile.objects.create(firebase_uid=identity, email=email_value)
    return None


def _get_razorpay_client():
    if razorpay is None:
        return None
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return None
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def _auth_header_token(request):
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("Bearer "):
        return ""
    return auth_header.split(" ", 1)[1].strip()


def _load_session_payload(request):
    token = _auth_header_token(request)
    if not token:
        return None

    max_age = int(getattr(settings, "SESSION_TOKEN_MAX_AGE_SECONDS", 60 * 60 * 24 * 7))
    try:
        return signing.loads(token, salt="auth-session-token", max_age=max_age)
    except signing.BadSignature:
        return None


def _get_session_user(request):
    payload = _load_session_payload(request)
    if not payload:
        return None, None, Response({"error": "Unauthorized"}, status=401)

    username = str(payload.get("username") or "").strip()
    email = str(payload.get("email") or "").strip().lower()

    user = User.objects.filter(username=username).first() if username else None
    if not user and email:
        user = User.objects.filter(email=email).first()

    if not user or not user.is_active:
        return None, payload, Response({"error": "Unauthorized"}, status=401)

    if username and user.username != username:
        return None, payload, Response({"error": "Unauthorized"}, status=401)

    if email and (user.email or "").strip().lower() != email:
        return None, payload, Response({"error": "Unauthorized"}, status=401)

    return user, payload, None


def _require_admin(request):
    user, payload, error = _get_session_user(request)
    if error:
        return None, None, error
    if not (user.is_staff or user.is_superuser):
        return None, payload, Response({"error": "Admin access required"}, status=403)
    return user, payload, None


def _identity_matches_session(identity, payload):
    ident = str(identity or "").strip().lower()
    if not ident:
        return False

    session_usernames = {
        str(payload.get("username") or "").strip().lower(),
        str(payload.get("email") or "").strip().lower(),
    }
    return ident in session_usernames


@csrf_exempt
def login_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    data = get_data(request)
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if _is_rate_limited(request, username=username):
        _record_attempt(request, status="blocked", username=username)
        return JsonResponse({"error": "Too many attempts. Try later."}, status=429)

    device, security_error = _validate_security_conditions(data)
    if security_error:
        _record_attempt(request, status="blocked", username=username)
        return JsonResponse({"error": "Invalid request"}, status=403)

    if not username or not password:
        _record_attempt(request, status="login_failed", username=username)
        return JsonResponse({"error": "Invalid credentials"}, status=400)

    user = authenticate(username=username, password=password)
    if not user:
        _record_attempt(request, status="login_failed", username=username)
        return JsonResponse({"error": "Invalid credentials"}, status=401)
    if not user.email:
        _record_attempt(request, status="login_failed", username=username)
        return JsonResponse({"error": "Email not configured for this account"}, status=400)

    recent_otps = EmailOTP.objects.filter(
        email=user.email,
        created_at__gte=timezone.now() - timedelta(minutes=1)
    )
    if recent_otps.count() >= 3:
        _record_attempt(request, status="blocked", username=username, email=user.email)
        return JsonResponse({"error": "Too many attempts. Try later."}, status=429)

    otp = str(secrets.randbelow(900000) + 100000)
    otp_record = EmailOTP.objects.create(
        email=user.email,
        otp_hash=EmailOTP.hash_otp(otp),
        ip_address=_client_ip(request),
    )
    otp_sent = _send_login_otp_email(user.email, otp)
    if not otp_sent:
        otp_record.delete()
        _record_attempt(request, status="blocked", username=user.username, email=user.email)
        return JsonResponse({"error": "Unable to send OTP email. Try again shortly."}, status=503)

    otp_expiry_seconds = int(getattr(settings, "OTP_EXPIRY_SECONDS", 45) or 45)
    otp_destination = _masked_email(user.email)
    challenge_token = signing.dumps(
        {
            "otp_id": otp_record.id,
            "username": user.username,
            "device_hash": _device_fingerprint_hash(device),
        },
        salt="auth-otp-challenge",
    )
    _record_attempt(
        request,
        status="otp_sent",
        username=user.username,
        email=user.email,
    )

    payload = {
        "success": True,
        "challengeToken": challenge_token,
        "otpDestination": otp_destination,
        "otpExpiresInSeconds": otp_expiry_seconds,
    }

    return JsonResponse(payload)


@csrf_exempt
def register_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    data = get_data(request)
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if _is_rate_limited(request, username=username, email=email):
        _record_attempt(request, status="blocked", username=username, email=email)
        return JsonResponse({"error": "Too many attempts. Try later."}, status=429)

    _, security_error = _validate_security_conditions(data)
    if security_error:
        _record_attempt(request, status="blocked", username=username, email=email)
        return JsonResponse({"error": "Invalid request"}, status=403)

    if not username or not email or not password:
        return JsonResponse({"error": "All fields required"}, status=400)
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"error": "Invalid email address"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "Email already registered"}, status=400)

    User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

    return JsonResponse({
        "success": True,
        "message": "User registered successfully",
        "username": username,
        "email": email,
    })


@csrf_exempt
def verify_email_otp(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    data = get_data(request)
    otp = data.get("otp", "").strip()
    challenge_token = data.get("challengeToken", "").strip()

    if _is_rate_limited(request):
        _record_attempt(request, status="blocked")
        return JsonResponse({"error": "Too many attempts. Try later."}, status=429)

    device, security_error = _validate_security_conditions(data)
    if security_error:
        _record_attempt(request, status="blocked")
        return JsonResponse({"error": "Invalid request"}, status=403)

    if not otp or not challenge_token:
        return JsonResponse({"error": "OTP and challenge token are required"}, status=400)

    try:
        challenge_payload = signing.loads(
            challenge_token,
            salt="auth-otp-challenge",
            max_age=int(getattr(settings, "OTP_EXPIRY_SECONDS", 45) or 45),
        )
    except signing.BadSignature:
        return JsonResponse({"error": "Invalid or expired OTP challenge"}, status=400)

    otp_id = challenge_payload.get("otp_id")
    expected_device_hash = challenge_payload.get("device_hash")
    username = challenge_payload.get("username")
    if not otp_id or not expected_device_hash or not username:
        return JsonResponse({"error": "Invalid OTP challenge"}, status=400)

    current_device_hash = _device_fingerprint_hash(device)
    if current_device_hash != expected_device_hash:
        _record_attempt(request, status="otp_failed", username=username)
        return JsonResponse({"error": "Device verification failed"}, status=403)

    record = EmailOTP.objects.filter(id=otp_id).first()
    if not record:
        return JsonResponse({"error": "OTP not found"}, status=400)

    if record.is_expired():
        record.delete()
        return JsonResponse({"error": "OTP expired"}, status=400)

    if record.otp_hash != EmailOTP.hash_otp(otp):
        record.attempts += 1
        record.save(update_fields=["attempts"])
        if record.attempts >= 5:
            record.delete()
        _record_attempt(request, status="otp_failed", username=username, email=record.email)
        return JsonResponse({"error": "Invalid OTP"}, status=400)

    user = User.objects.filter(username=username, email=record.email).first()
    if not user:
        record.delete()
        return JsonResponse({"error": "Invalid login state"}, status=400)

    session_token = signing.dumps(
        {"username": user.username, "email": user.email},
        salt="auth-session-token",
    )

    record.delete()
    _record_attempt(request, status="success", username=user.username, email=user.email)
    return JsonResponse({
        "success": True,
        "token": session_token,
        "user": {
            "username": user.username,
            "email": user.email,
        },
    })

@api_view(["GET", "POST"])
def search_trains(request):
    _, _, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error


    def _norm(value):
        return str(value or "").strip().lower()

    def _duration_label(departure_time, arrival_time):
        try:
            dep_h, dep_m = [int(x) for x in str(departure_time).split(":", 1)]
            arr_h, arr_m = [int(x) for x in str(arrival_time).split(":", 1)]
            dep_total = dep_h * 60 + dep_m
            arr_total = arr_h * 60 + arr_m
            if arr_total < dep_total:
                arr_total += 24 * 60
            mins = arr_total - dep_total
            return f"{mins // 60}h {mins % 60}m"
        except Exception:
            return "Duration not available"

    if request.method == "POST":
        source_query = _norm(request.data.get("source"))
        destination_query = _norm(request.data.get("destination"))
    else:
        source_query = _norm(request.query_params.get("source"))
        destination_query = _norm(request.query_params.get("destination"))

    train_master = {
        "12678": {"trainName": "Kanniyakumari Express", "source": "Chennai Central", "destination": "Kanniyakumari", "departureTime": "17:30", "arrivalTime": "06:00", "platformNumber": "4"},
        "16318": {"trainName": "Trivandrum Express", "source": "Chennai Egmore", "destination": "Trivandrum", "departureTime": "18:45", "arrivalTime": "08:15", "platformNumber": "2"},
        "12624": {"trainName": "Chennai Mail", "source": "Trivandrum", "destination": "Chennai Central", "departureTime": "15:00", "arrivalTime": "04:30", "platformNumber": "5"},
        "12698": {"trainName": "Guruvayur Express", "source": "Chennai Egmore", "destination": "Guruvayur", "departureTime": "22:15", "arrivalTime": "14:30", "platformNumber": "7"},
        "22638": {"trainName": "West Coast SF Express", "source": "Ernakulam", "destination": "Chennai Central", "departureTime": "08:20", "arrivalTime": "19:45", "platformNumber": "3"},
        "16715": {"trainName": "Trichy - Madurai Passenger", "source": "Tiruchirappalli", "destination": "Madurai Junction", "departureTime": "07:00", "arrivalTime": "09:00", "platformNumber": "1"},
        "16716": {"trainName": "Madurai - Dindigul Passenger", "source": "Madurai Junction", "destination": "Dindigul Junction", "departureTime": "09:30", "arrivalTime": "10:40", "platformNumber": "2"},
        "16717": {"trainName": "Dindigul - Trichy Express", "source": "Dindigul Junction", "destination": "Tiruchirappalli", "departureTime": "11:30", "arrivalTime": "13:00", "platformNumber": "1"},
        "16718": {"trainName": "Trichy - Pudukottai Fast Passenger", "source": "Tiruchirappalli", "destination": "Pudukottai", "departureTime": "14:15", "arrivalTime": "15:30", "platformNumber": "3"},
        "16719": {"trainName": "Pudukottai - Trichy Passenger", "source": "Pudukottai", "destination": "Tiruchirappalli", "departureTime": "16:00", "arrivalTime": "17:15", "platformNumber": "4"},
        "16720": {"trainName": "Madurai - Pollachi Express", "source": "Madurai Junction", "destination": "Pollachi Junction", "departureTime": "06:45", "arrivalTime": "10:00", "platformNumber": "2"},
        "16721": {"trainName": "Pollachi - Dindigul Passenger", "source": "Pollachi Junction", "destination": "Dindigul Junction", "departureTime": "11:00", "arrivalTime": "14:00", "platformNumber": "5"},
        "16722": {"trainName": "Dindigul - Pudukottai Link Express", "source": "Dindigul Junction", "destination": "Pudukottai", "departureTime": "15:30", "arrivalTime": "17:30", "platformNumber": "6"},
    }
    trains = []
    default_journey_date = timezone.localdate() + timedelta(days=1)

    train_numbers = list(train_master.keys())

    # Fetch first available SL/GN record per train in one DB round-trip.
    earliest_dates = (
        TrainAvailability.objects
        .filter(train_number__in=train_numbers, class_type="SL", quota="GN")
        .values("train_number")
        .annotate(first_date=Min("journey_date"))
    )

    first_date_map = {item["train_number"]: item["first_date"] for item in earliest_dates}
    availability_q = Q()
    for train_no, first_date in first_date_map.items():
        availability_q |= Q(train_number=train_no, journey_date=first_date, class_type="SL", quota="GN")

    availability_by_train = {}
    if availability_q:
        for availability in TrainAvailability.objects.filter(availability_q):
            availability_by_train[availability.train_number] = availability

    missing_numbers = [n for n in train_numbers if n not in availability_by_train]
    if missing_numbers:
        TrainAvailability.objects.bulk_create(
            [
                TrainAvailability(
                    train_number=train_number,
                    journey_date=default_journey_date,
                    class_type="SL",
                    quota="GN",
                    available_seats=40,
                )
                for train_number in missing_numbers
            ],
            ignore_conflicts=True,
        )

        for availability in TrainAvailability.objects.filter(
            train_number__in=missing_numbers,
            class_type="SL",
            quota="GN",
        ).order_by("train_number", "journey_date"):
            if availability.train_number not in availability_by_train:
                availability_by_train[availability.train_number] = availability

    for train_number, details in train_master.items():
        if source_query and source_query not in _norm(details.get("source")):
            continue
        if destination_query and destination_query not in _norm(details.get("destination")):
            continue
        availability = availability_by_train.get(train_number)
        if availability is None:
            journey_date_value = default_journey_date
            available_seats_value = 40
        else:
            journey_date_value = availability.journey_date
            available_seats_value = availability.available_seats

        trains.append({
            "id": train_number,
            "trainNumber": train_number,
            "trainName": details["trainName"],
            "source": details["source"],
            "destination": details["destination"],
            "departureTime": details["departureTime"],
            "arrivalTime": details["arrivalTime"],
            "duration": _duration_label(details["departureTime"], details["arrivalTime"]),
            "platformNumber": details["platformNumber"],
            "fare": 250,
            "availableSeats": available_seats_value,
            "date": str(journey_date_value),
            "journeyDate": str(journey_date_value),
        })

    return Response({"success": True, "trains": trains})
@api_view(["GET", "POST"])
def select_train(request):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    if request.method == "POST":

        identity = request.data.get("email") or payload.get("email") or payload.get("username")
        if not _identity_matches_session(identity, payload):
            return Response({"error": "Forbidden"}, status=403)
        train = request.data.get("train")

        if not identity or not train:
            return Response({"error": "Missing data"}, status=400)

        user_profile = _resolve_user_profile(identity, create=True)

        SelectedTrain.objects.update_or_create(
            user=user_profile,
            defaults={"train": train}
        )

        return Response({"success": True})

    if request.method == "GET":

        identity = request.query_params.get("email") or payload.get("email") or payload.get("username")
        if not _identity_matches_session(identity, payload):
            return Response({"error": "Forbidden"}, status=403)

        user_profile = _resolve_user_profile(identity, create=False)
        selected = SelectedTrain.objects.filter(user=user_profile).first()

        return Response({
            "train": selected.train if selected else None
        })


# ================= SAVE PASSENGERS =================

@api_view(["POST"])
def save_passengers(request):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    identity = request.data.get("email") or payload.get("email") or payload.get("username")
    if not _identity_matches_session(identity, payload):
        return Response({"error": "Forbidden"}, status=403)
    passengers = request.data.get("passengers", [])
    is_family = bool(request.data.get("isFamily", False))

    ok, message = validate_passenger_mix(passengers, is_family)
    if not ok:
        return Response({"error": message}, status=400)

    user_profile = _resolve_user_profile(identity, create=True)

    passengers_with_meta = []
    for p in passengers:
        if isinstance(p, dict):
            p = {**p, "isFamilyBooking": is_family}
        passengers_with_meta.append(p)

    PassengerSession.objects.update_or_create(
        user=user_profile,
        defaults={"passengers": passengers_with_meta}
    )

    return Response({"success": True})
@api_view(["GET"])
def pending_booking(request):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    identity = request.query_params.get("email") or payload.get("email") or payload.get("username")
    if not _identity_matches_session(identity, payload):
        return Response({"error": "Forbidden"}, status=403)

    user_profile = _resolve_user_profile(identity, create=False)
    selected = SelectedTrain.objects.filter(user=user_profile).first()
    passenger_session = PassengerSession.objects.filter(user=user_profile).first()

    if not selected or not passenger_session:
        return Response({"error": "No pending booking"}, status=400)

    total_fare = 250 * len(passenger_session.passengers)

    return Response({
        "train": selected.train,
        "passengers": passenger_session.passengers,
        "totalFare": total_fare
    })
@api_view(["POST"])
@transaction.atomic
def create_booking(request):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    identity = request.data.get("email") or payload.get("email") or payload.get("username")
    if not _identity_matches_session(identity, payload):
        return Response({"error": "Forbidden"}, status=403)
    journey_date_raw = request.data.get("journeyDate")
    transaction_id = request.data.get("transactionId")

    user_profile = _resolve_user_profile(identity, create=False)
    if not user_profile:
        return Response({"error": "User not found"}, status=400)

    selected = SelectedTrain.objects.filter(user=user_profile).first()
    passenger_session = PassengerSession.objects.filter(user=user_profile).first()

    if not selected or not passenger_session:
        return Response({"error": "Booking session expired"}, status=400)

    train_number = selected.train.get("trainNumber")
    journey_date = _coerce_journey_date(
        journey_date_raw
        or selected.train.get("journeyDate")
        or selected.train.get("date")
    )
    if not journey_date:
        return Response({"error": "Invalid or missing journey date"}, status=400)

    passengers = passenger_session.passengers
    passenger_count = len(passengers)
    is_family = bool(passengers and isinstance(passengers[0], dict) and passengers[0].get("isFamilyBooking"))

    ok, message = validate_passenger_mix(passengers, is_family)
    if not ok:
        return Response({"error": message}, status=400)

    try:
        availability = TrainAvailability.objects.select_for_update().get(
            train_number=train_number,
            journey_date=journey_date,
            class_type="SL",
            quota="GN",
        )
    except TrainAvailability.DoesNotExist:
        return Response({"error": "Train not available"}, status=404)

    if availability.available_seats < passenger_count:
        return Response({"error": "Not enough seats"}, status=400)

    availability.available_seats -= passenger_count
    availability.save()

    seats = generate_seat_details(passengers, is_family=is_family)

    for i, p in enumerate(passengers):
        p["seatNumber"] = seats[i]["seatNumber"]
        p["coach"] = seats[i]["coach"]
        p["berth"] = seats[i]["berth"]
        p["status"] = seats[i]["status"]
        p["isFamilyBooking"] = is_family

    booking = Booking.objects.create(
        user=user_profile,
        pnr=generate_pnr(),
        train=selected.train,
        passengers=passengers,
        total_fare=Decimal(250 * passenger_count),
        journey_date=journey_date,
        status="CONFIRMED",
        payment_status="PAID" if transaction_id else "PENDING",
        transaction_id=transaction_id,
        contact_email=user_profile.email
    )

    # Clear session after booking
    SelectedTrain.objects.filter(user=user_profile).delete()
    PassengerSession.objects.filter(user=user_profile).delete()

    return Response({
        "success": True,
        "pnr": booking.pnr
    })


@api_view(["GET"])
def get_booking_detail(request, booking_id):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    identity = request.query_params.get("email") or payload.get("email") or payload.get("username")
    if not _identity_matches_session(identity, payload):
        return Response({"error": "Forbidden"}, status=403)
    user_profile = _resolve_user_profile(identity, create=False)

    if not user_profile:
        return Response({"error": "User not found"}, status=404)

    booking = Booking.objects.filter(user=user_profile, id=booking_id).first()
    if not booking:
        return Response({"error": "Booking not found"}, status=404)

    return Response({
        "success": True,
        "booking": BookingSerializer(booking).data
    })


# ================= DASHBOARD =================

@api_view(["GET"])
def get_bookings(request):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    identity = request.query_params.get("email") or payload.get("email") or payload.get("username")
    if not _identity_matches_session(identity, payload):
        return Response({"error": "Forbidden"}, status=403)

    user_profile = _resolve_user_profile(identity, create=False)

    if not user_profile:
        return Response({"bookings": []})

    bookings = Booking.objects.filter(user=user_profile)

    return Response({
        "success": True,
        "bookings": BookingSerializer(bookings, many=True).data
    })


# ================= DOWNLOAD TICKET =================

@api_view(["GET"])
def download_ticket(request):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    booking_id = request.query_params.get("bookingId")
    identity = request.query_params.get("email") or payload.get("email") or payload.get("username")
    if not _identity_matches_session(identity, payload):
        return Response({"error": "Forbidden"}, status=403)
    should_download = request.query_params.get("download", "1") == "1"

    if not booking_id or not identity:
        return Response({"error": "bookingId and email are required"}, status=400)

    user_profile = _resolve_user_profile(identity, create=False)
    if not user_profile:
        return Response({"error": "User not found"}, status=404)

    booking = Booking.objects.filter(user=user_profile, id=booking_id).first()
    if not booking:
        return Response({"error": "Booking not found"}, status=404)

    train = booking.train or {}
    passengers = booking.passengers or []
    ttr_verified = bool(train.get("_ttrVerified", False))
    ttr_verified_at = train.get("_ttrVerifiedAt")
    token = signing.dumps({"bookingId": booking.id, "pnr": booking.pnr}, salt="ttr-ticket")
    verify_url = request.build_absolute_uri(f"/api/ttr-verify-ticket/?token={quote(token)}")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.pdfgen import canvas
        from reportlab.graphics.barcode.qr import QrCodeWidget
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics import renderPDF
    except ImportError:
        fallback_lines = [
            "IRCTC RailBook Ticket",
            f"PNR: {booking.pnr}",
            f"Status: {booking.status}",
            f"Train: {train.get('trainName', '-')} ({train.get('trainNumber', '-')})",
            f"Route: {train.get('source', '-')} to {train.get('destination', '-')}",
            f"Journey Date: {booking.journey_date}",
            f"Departure: {train.get('departureTime', '-')}",
            f"Arrival: {train.get('arrivalTime', '-')}",
            f"Platform: {train.get('platformNumber', 'Not assigned')}",
            f"Total Fare: Rs {booking.total_fare}",
            f"Verification URL: {verify_url}",
            "",
            "Passengers:",
        ]
        for i, p in enumerate(passengers):
            if isinstance(p, dict):
                fallback_lines.append(
                    f"{i + 1}. {p.get('name', '-')} | {p.get('age', '-')} | {p.get('gender', '-')} | "
                    f"{p.get('coach', '-')}-{p.get('seatNumber', '-')} {p.get('berth', '-')}"
                )
            else:
                fallback_lines.append(f"{i + 1}. {str(p)}")

        pdf_bytes = _simple_pdf_from_lines(fallback_lines)
        return FileResponse(
            BytesIO(pdf_bytes),
            as_attachment=should_download,
            filename=f"ticket-{booking.pnr}.pdf",
            content_type="application/pdf",
        )

    width, height = A4
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    # Header band
    c.setFillColor(colors.HexColor("#1f78de"))
    c.rect(30, height - 130, width - 60, 90, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(45, height - 75, "IRCTC RailBook - Ticket Confirmed")
    c.setFont("Helvetica", 12)
    c.drawString(45, height - 98, f"PNR: {booking.pnr}   Status: {booking.status}")
    c.drawRightString(width - 45, height - 98, f"TTR Verified: {'YES' if ttr_verified else 'NO'}")

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, height - 155, f"{train.get('trainName', '-')} ({train.get('trainNumber', '-')})")
    c.setFont("Helvetica", 11)
    c.drawString(40, height - 173, f"{train.get('source', '-')} to {train.get('destination', '-')}")
    c.drawString(40, height - 191, f"Journey Date: {booking.journey_date}")
    c.drawString(40, height - 209, f"Departure: {train.get('departureTime', '-')}")
    c.drawString(240, height - 209, f"Arrival: {train.get('arrivalTime', '-')}")
    c.drawString(40, height - 227, f"Platform: {train.get('platformNumber', 'Not assigned')}")
    c.drawString(240, height - 227, f"Transaction ID: {booking.transaction_id or '-'}")

    qr_widget = QrCodeWidget(verify_url)
    bounds = qr_widget.getBounds()
    qr_size = 110
    qr_w = bounds[2] - bounds[0]
    qr_h = bounds[3] - bounds[1]
    drawing = Drawing(qr_size, qr_size, transform=[qr_size / qr_w, 0, 0, qr_size / qr_h, 0, 0])
    drawing.add(qr_widget)
    renderPDF.draw(drawing, c, width - 150, height - 270)
    c.setFont("Helvetica", 8)
    c.drawRightString(width - 40, height - 276, "Scan for TTR verification")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, height - 258, "Passenger Details")
    y = height - 278

    for i, p in enumerate(passengers):
        if y < 95:
            c.showPage()
            y = height - 60
            c.setFont("Helvetica-Bold", 12)
            c.drawString(40, y, "Passenger Details (contd.)")
            y -= 20

        if isinstance(p, dict):
            c.setFont("Helvetica-Bold", 10)
            c.drawString(45, y, f"{i + 1}. {p.get('name', '-')}")
            c.setFont("Helvetica", 10)
            c.drawString(210, y, f"Age: {p.get('age', '-')}")
            c.drawString(290, y, f"Gender: {p.get('gender', '-')}")
            c.drawString(390, y, f"Coach: {p.get('coach', '-')}")
            c.drawString(460, y, f"Seat: {p.get('seatNumber', '-')}")
            y -= 14
            c.drawString(65, y, f"Berth: {p.get('berth', '-')}")
            c.drawString(240, y, f"Status: {p.get('status', '-')}")
            y -= 16
        else:
            c.setFont("Helvetica", 10)
            c.drawString(45, y, f"{i + 1}. {str(p)}")
            y -= 18

        c.setStrokeColor(colors.HexColor("#d9e5f5"))
        c.line(40, y, width - 40, y)
        y -= 10

    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, 60, f"Total Fare: Rs {booking.total_fare}")
    c.setFont("Helvetica", 8)
    c.drawString(40, 45, f"Verification URL: {verify_url}")
    c.save()

    buffer.seek(0)
    return FileResponse(
        buffer,
        as_attachment=should_download,
        filename=f"ticket-{booking.pnr}.pdf",
        content_type="application/pdf",
    )


@api_view(["GET"])
def ttr_verify_ticket(request):
    token = request.query_params.get("token")
    if not token:
        return Response({"error": "token is required"}, status=400)

    try:
        payload = signing.loads(token, salt="ttr-ticket", max_age=60 * 60 * 24 * 30)
    except signing.BadSignature:
        return Response({"error": "Invalid or expired token"}, status=400)

    booking_id = payload.get("bookingId")
    pnr = payload.get("pnr")
    booking = Booking.objects.filter(id=booking_id, pnr=pnr).first()
    if not booking:
        return Response({"error": "Booking not found"}, status=404)

    train = booking.train or {}
    if not train.get("_ttrVerified", False):
        now = timezone.now()
        train["_ttrVerified"] = True
        train["_ttrVerifiedAt"] = now.isoformat()
        booking.train = train
        booking.save(update_fields=["train"])
        ttr_verified = True
        ttr_verified_at = now.isoformat()
    else:
        ttr_verified = True
        ttr_verified_at = train.get("_ttrVerifiedAt")

    return Response({
        "success": True,
        "message": "Ticket verified by TTR",
        "bookingId": booking.id,
        "pnr": booking.pnr,
        "ttrVerified": ttr_verified,
        "ttrVerifiedAt": ttr_verified_at,
        "status": booking.status,
    })

@api_view(["POST"])
def verify_payment(request):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    identity = request.data.get("email") or payload.get("email") or payload.get("username")
    if not _identity_matches_session(identity, payload):
        return Response({"error": "Forbidden"}, status=403)
    razorpay_payment_id = request.data.get("razorpay_payment_id")
    razorpay_order_id = request.data.get("razorpay_order_id")
    razorpay_signature = request.data.get("razorpay_signature")

    if not razorpay_payment_id or not razorpay_order_id or not razorpay_signature:
        return Response({"error": "Missing Razorpay verification fields"}, status=400)

    user_profile = _resolve_user_profile(identity, create=False)

    if not user_profile:
        return Response({"error": "User not found"}, status=400)

    client = _get_razorpay_client()
    if client is None:
        return Response({"error": "Razorpay is not configured on server"}, status=503)
    try:
        client.utility.verify_payment_signature({
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_order_id": razorpay_order_id,
            "razorpay_signature": razorpay_signature,
        })
    except Exception:
        return Response({"error": "Payment signature verification failed"}, status=400)

    return Response({
        "success": True,
        "message": "Payment verified",
        "paymentId": razorpay_payment_id,
        "orderId": razorpay_order_id,
    })
@api_view(["GET"])
def check_availability(request):

    train_number = request.query_params.get("trainNumber")
    journey_date = request.query_params.get("journeyDate")

    availability = TrainAvailability.objects.filter(
        train_number=train_number,
        journey_date=journey_date
    ).first()

    if not availability:
        return Response({"availableSeats": 0})

    return Response({
        "availableSeats": availability.available_seats
    })
@api_view(["POST"])
@transaction.atomic
def cancel_booking(request):
    _, payload, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    pnr = request.data.get("pnr")
    identity = request.data.get("email") or payload.get("email") or payload.get("username")
    if not _identity_matches_session(identity, payload):
        return Response({"error": "Forbidden"}, status=403)

    user_profile = _resolve_user_profile(identity, create=False)
    if not user_profile:
        return Response({"error": "User not found"}, status=404)

    booking = Booking.objects.filter(pnr=pnr, user=user_profile).first()

    if not booking:
        return Response({"error": "Booking not found"}, status=404)

    if booking.status == "CANCELLED":
        return Response({"error": "Already cancelled"}, status=400)

    try:
        availability = TrainAvailability.objects.select_for_update().get(
            train_number=booking.train.get("trainNumber"),
            journey_date=booking.journey_date
        )
    except TrainAvailability.DoesNotExist:
        return Response({"error": "Train not found"}, status=404)

    availability.available_seats += len(booking.passengers)
    availability.save()

    booking.status = "CANCELLED"
    booking.save()

    return Response({"success": True})
@api_view(["GET"])
def train_status(request):

    train_number = request.query_params.get("trainNumber")

    return Response({
        "trainNumber": train_number,
        "status": "On Time"
    })



@api_view(["POST"])
def create_razorpay_order(request):
    _, _, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    try:
        amount = request.data.get("amount")
        receipt = request.data.get("receipt") or f"receipt_{secrets.token_hex(8)}"

        if amount is None:
            return Response({"error": "Amount missing"}, status=400)
        try:
            amount_int = int(amount)
        except (TypeError, ValueError):
            return Response({"error": "Invalid amount"}, status=400)
        if amount_int <= 0:
            return Response({"error": "Amount must be greater than zero"}, status=400)

        client = _get_razorpay_client()
        if client is None:
            return Response({"error": "Razorpay is not configured on server"}, status=503)

        order = client.order.create({
            "amount": amount_int * 100,
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
        })

        return Response({
            "order_id": order["id"],
            "amount": order["amount"],
            "key": settings.RAZORPAY_KEY_ID
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)
@api_view(["GET"])
def booking_stats(request):
    _, _, auth_error = _require_admin(request)
    if auth_error:
        return auth_error

    total = Booking.objects.count()
    confirmed = Booking.objects.filter(status="CONFIRMED").count()
    cancelled = Booking.objects.filter(status="CANCELLED").count()

    return Response({
        "totalBookings": total,
        "confirmed": confirmed,
        "cancelled": cancelled
    })
@api_view(["POST"])
def submit_behavior(request):
    _, _, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    return Response({
        "success": True,
        "message": "Behavior recorded"
    })


@api_view(["GET"])
def admin_session(request):
    user, _, auth_error = _get_session_user(request)
    if auth_error:
        return auth_error

    return Response({
        "success": True,
        "isAdmin": bool(user.is_staff or user.is_superuser),
        "username": user.username,
        "email": user.email,
    })


@api_view(["GET"])
def admin_users(request):
    _, _, auth_error = _require_admin(request)
    if auth_error:
        return auth_error

    query = str(request.query_params.get("q") or "").strip()
    users_qs = User.objects.all().order_by("-date_joined")
    if query:
        users_qs = users_qs.filter(Q(username__icontains=query) | Q(email__icontains=query))

    users = []
    for u in users_qs[:200]:
        users.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "isActive": u.is_active,
            "isStaff": u.is_staff,
            "isSuperuser": u.is_superuser,
            "dateJoined": u.date_joined,
            "lastLogin": u.last_login,
        })

    return Response({"success": True, "users": users})


@api_view(["POST"])
def admin_update_user(request, user_id):
    admin_user, _, auth_error = _require_admin(request)
    if auth_error:
        return auth_error

    target = User.objects.filter(id=user_id).first()
    if not target:
        return Response({"error": "User not found"}, status=404)

    if target.id == admin_user.id and request.data.get("isActive") is False:
        return Response({"error": "You cannot deactivate your own account"}, status=400)

    def _to_bool(value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on"}
        return bool(value)

    changed = False
    if "isActive" in request.data:
        target.is_active = _to_bool(request.data.get("isActive"))
        changed = True
    if "isStaff" in request.data:
        target.is_staff = _to_bool(request.data.get("isStaff"))
        changed = True

    if changed:
        target.save(update_fields=["is_active", "is_staff"])

    return Response({
        "success": True,
        "user": {
            "id": target.id,
            "username": target.username,
            "email": target.email,
            "isActive": target.is_active,
            "isStaff": target.is_staff,
            "isSuperuser": target.is_superuser,
            "dateJoined": target.date_joined,
            "lastLogin": target.last_login,
        }
    })


@api_view(["GET"])
def admin_analytics(request):
    _, _, auth_error = _require_admin(request)
    if auth_error:
        return auth_error

    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    staff_users = User.objects.filter(is_staff=True).count()

    total_bookings = Booking.objects.count()
    confirmed_bookings = Booking.objects.filter(status="CONFIRMED").count()
    cancelled_bookings = Booking.objects.filter(status="CANCELLED").count()

    revenue_value = Booking.objects.exclude(status="CANCELLED").aggregate(total=Sum("total_fare")).get("total")
    if revenue_value is None:
        revenue_value = Decimal("0")

    since = timezone.now() - timedelta(hours=24)
    login_events = LoginAttempt.objects.filter(timestamp__gte=since)
    failed_logins = login_events.filter(status__in=["login_failed", "otp_failed", "blocked"]).count()

    return Response({
        "success": True,
        "metrics": {
            "users": {
                "total": total_users,
                "active": active_users,
                "staff": staff_users,
            },
            "bookings": {
                "total": total_bookings,
                "confirmed": confirmed_bookings,
                "cancelled": cancelled_bookings,
            },
            "revenue": {
                "total": str(revenue_value),
            },
            "security": {
                "loginAttempts24h": login_events.count(),
                "failedLogins24h": failed_logins,
            },
        },
    })

@csrf_exempt
def razorpay_webhook(request):
    return JsonResponse({"status": "Webhook received"})

