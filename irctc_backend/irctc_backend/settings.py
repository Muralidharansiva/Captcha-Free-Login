import os
from datetime import timedelta
from pathlib import Path

try:
    import dj_database_url
except ModuleNotFoundError:
    dj_database_url = None

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv(*_args, **_kwargs):  # type: ignore[no-redef]
        return False

try:
    import rest_framework_simplejwt  # noqa: F401
except ModuleNotFoundError:
    SIMPLE_JWT_AVAILABLE = False
else:
    SIMPLE_JWT_AVAILABLE = True

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw.strip())
    except (TypeError, ValueError):
        return default


# CORS Configuration
DEFAULT_FRONTEND_ORIGINS = ["https://captcha-free-login.vercel.app"]
DEFAULT_FRONTEND_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
    r"^http://localhost(:\d+)?$",
    r"^http://127\.0\.0\.1(:\d+)?$",
]
CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL_ORIGINS", "False").lower() == "true"
CORS_ALLOWED_ORIGINS = _split_csv(os.getenv("CORS_ALLOWED_ORIGINS", "")) or DEFAULT_FRONTEND_ORIGINS
CORS_ALLOWED_ORIGIN_REGEXES = (
    _split_csv(os.getenv("CORS_ALLOWED_ORIGIN_REGEXES", ""))
    or DEFAULT_FRONTEND_ORIGIN_REGEXES
)
CSRF_TRUSTED_ORIGINS = _split_csv(os.getenv("CSRF_TRUSTED_ORIGINS", "")) or [
    *DEFAULT_FRONTEND_ORIGINS,
    "https://*.vercel.app",
]

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me-in-production")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

allowed_hosts = _split_csv(os.getenv("ALLOWED_HOSTS", ""))
if not allowed_hosts:
    allowed_hosts = [
        "127.0.0.1",
        "localhost",
        "testserver",
        "captcha-free-login.onrender.com",
        ".onrender.com",
    ]

render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if render_hostname and render_hostname not in allowed_hosts:
    allowed_hosts.append(render_hostname)

ALLOWED_HOSTS = allowed_hosts

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "irctc_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "irctc_backend.wsgi.application"

database_url = os.getenv("DATABASE_URL", "").strip()
if database_url and dj_database_url is not None:
    DATABASES = {
        "default": dj_database_url.parse(
            database_url,
            conn_max_age=600,
            ssl_require=not DEBUG,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": (
        ["rest_framework_simplejwt.authentication.JWTAuthentication"]
        if SIMPLE_JWT_AVAILABLE
        else []
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp-relay.brevo.com")
EMAIL_PORT = _env_int("EMAIL_PORT", 587)
EMAIL_USE_TLS = _env_bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = _env_bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = _env_int("EMAIL_TIMEOUT", 8)

# Keep transport mode valid even when both flags are accidentally set.
if EMAIL_USE_TLS and EMAIL_USE_SSL:
    EMAIL_USE_SSL = False

# Support Brevo aliases + generic + Django-standard env names.
EMAIL_HOST_USER = (
    os.getenv("EMAIL_HOST_USER")
    or os.getenv("BREVO_SMTP_LOGIN")
    or os.getenv("SMTP_LOGIN")
    or os.getenv("EMAIL_USER")
    or ""
).strip()
EMAIL_HOST_PASSWORD = (
    os.getenv("EMAIL_HOST_PASSWORD")
    or os.getenv("BREVO_SMTP_KEY")
    or os.getenv("SMTP_KEY")
    or os.getenv("EMAIL_PASS")
    or os.getenv("EMAIL_PASSWORD")
    or ""
).strip()
DEFAULT_FROM_EMAIL = (
    os.getenv("DEFAULT_FROM_EMAIL")
    or os.getenv("BREVO_SENDER_EMAIL")
    or os.getenv("SENDER_EMAIL")
    or EMAIL_HOST_USER
    or "noreply@example.com"
).strip()
SERVER_EMAIL = DEFAULT_FROM_EMAIL
BREVO_API_KEY = (
    os.getenv("BREVO_API_KEY")
    or os.getenv("BREVO_API_TOKEN")
    or ""
).strip()
BREVO_API_URL = os.getenv("BREVO_API_URL", "https://api.brevo.com/v3/smtp/email").strip()
BREVO_API_TIMEOUT = _env_int("BREVO_API_TIMEOUT", 10)
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "Captcha Free Login").strip()

# OTP security + delivery settings.
OTP_EXPIRY_SECONDS = _env_int("OTP_EXPIRY_SECONDS", 45)
OTP_FALLBACK_TO_RESPONSE = _env_bool("OTP_FALLBACK_TO_RESPONSE", default=False)
OTP_EMAIL_RETRY_COUNT = _env_int("OTP_EMAIL_RETRY_COUNT", 2)
OTP_EMAIL_RETRY_DELAY_MS = _env_int("OTP_EMAIL_RETRY_DELAY_MS", 600)

RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "change_this")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SECURE_CONTENT_TYPE_NOSNIFF = True

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

SESSION_TOKEN_MAX_AGE_SECONDS = int(os.getenv("SESSION_TOKEN_MAX_AGE_SECONDS", "604800"))

