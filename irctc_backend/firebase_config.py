# Minimal firebase_config values used by settings at import time.
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIREBASE_ADMIN_CERT_PATH = os.environ.get(
    "C:\FullProject\irctc_backend\serviceAccountKey.json",
    os.path.join(BASE_DIR, "irctc_backend", "firebase-adminsdk.json")
)
SMS_API_URL = os.environ.get("SMS_API_URL", "")
SMS_API_KEY = os.environ.get("SMS_API_KEY", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@irctc-clone.com")
