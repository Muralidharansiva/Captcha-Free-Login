# api/auth.py
import logging
from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from firebase_admin import auth as firebase_auth

logger = logging.getLogger(__name__)

class FirebaseAuthentication(BaseAuthentication):
    """
    DRF authentication class that verifies Firebase ID tokens.
    Returns a simple user-like object with uid attribute.
    """
    def authenticate(self, request):
        auth_header = request.headers.get("Authorization") or request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header:
            return None  # No token provided

        # Accept both "Bearer <token>" and raw token (legacy)
        if auth_header.startswith("Bearer "):
            id_token = auth_header.split("Bearer ", 1)[1].strip()
        else:
            id_token = auth_header.strip()

        try:
            decoded = firebase_auth.verify_id_token(id_token)
            user = type("FirebaseUser", (), {"uid": decoded.get("uid")})()
            return (user, None)
        except Exception as e:
            logger.info("Firebase token verification failed: %s", e)
            raise exceptions.AuthenticationFailed("Invalid Firebase token")
