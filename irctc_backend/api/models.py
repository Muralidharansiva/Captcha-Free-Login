# api/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid
import hashlib


# ==========================================
# EMAIL OTP MODEL
# ==========================================

class EmailOTP(models.Model):
    email = models.EmailField()
    otp_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.IntegerField(default=0)
    ip_address = models.CharField(max_length=64, blank=True, null=True)

    def is_expired(self):
        expiry_seconds = int(getattr(settings, "OTP_EXPIRY_SECONDS", 45) or 45)
        return timezone.now() > self.created_at + timezone.timedelta(seconds=expiry_seconds)

    @staticmethod
    def hash_otp(otp):
        return hashlib.sha256(otp.encode()).hexdigest()

    def __str__(self):
        return f"OTP for {self.email}"


# ==========================================
# USER PROFILE
# ==========================================

class UserProfile(models.Model):
    firebase_uid = models.CharField(max_length=128, unique=True)
    email = models.EmailField(blank=True, null=True)
    display_name = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.display_name or self.email or self.firebase_uid


# ==========================================
# TRAIN SELECTION
# ==========================================

class SelectedTrain(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    train = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)


class PassengerSession(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    passengers = models.JSONField(default=list)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=32, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

class TrainAvailability(models.Model):
    train_number = models.CharField(max_length=32)
    journey_date = models.DateField()
    class_type = models.CharField(max_length=10, default="SL")
    quota = models.CharField(max_length=20, default="GN")
    available_seats = models.IntegerField(default=0)

    rac_available = models.IntegerField(default=10)
    waiting_available = models.IntegerField(default=20)

    class Meta:
        unique_together = ("train_number", "journey_date", "class_type", "quota")

def gen_id():
    return uuid.uuid4().hex


class Booking(models.Model):
    id = models.CharField(max_length=40, primary_key=True, default=gen_id)
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    pnr = models.CharField(max_length=64, unique=True)
    train = models.JSONField()
    passengers = models.JSONField()
    total_fare = models.DecimalField(max_digits=10, decimal_places=2)
    booking_date = models.DateTimeField(default=timezone.now)
    journey_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=32, default="CONFIRMED")
    payment_status = models.CharField(max_length=32, default="PENDING")
    transaction_id = models.CharField(max_length=128, blank=True, null=True)
    travel_class = models.CharField(max_length=10, default="SL")
    quota = models.CharField(max_length=20, default="GN")
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=32, blank=True, null=True)


class BookingBehavior(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    pnr = models.CharField(max_length=64, blank=True, null=True)
    behavior = models.JSONField()
    device = models.JSONField()
    human_score = models.FloatField(default=0.0)
    created_at = models.DateTimeField(default=timezone.now)


class BookingQueue(models.Model):
    user = models.CharField(max_length=128)
    status = models.CharField(max_length=32, default="PENDING")
    created_at = models.DateTimeField(default=timezone.now)


class LoginAttempt(models.Model):
    timestamp = models.DateTimeField(default=timezone.now)
    username = models.CharField(max_length=255, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True)
    ip_address = models.CharField(max_length=64, blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=32, default="failed")

    class Meta:
        indexes = [
            models.Index(fields=["timestamp"]),
            models.Index(fields=["ip_address", "timestamp"]),
            models.Index(fields=["username", "timestamp"]),
            models.Index(fields=["email", "timestamp"]),
            models.Index(fields=["status", "timestamp"]),
        ]
