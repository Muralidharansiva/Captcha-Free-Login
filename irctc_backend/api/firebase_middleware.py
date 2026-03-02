# api/firebase_middleware.py

import logging
from firebase_admin import auth as firebase_auth

logger = logging.getLogger(__name__)

class FirebaseAuthMiddleware:
    """
    Attach decoded Firebase token to request.
    Non-blocking middleware.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        request.firebase_user = None
        request.firebase_uid = None
        request.firebase_email = None

        try:
            auth_header = request.META.get("HTTP_AUTHORIZATION", "")

            if auth_header and auth_header.startswith("Bearer "):
                id_token = auth_header.split("Bearer ")[1]
                decoded = firebase_auth.verify_id_token(id_token)

                request.firebase_user = decoded
                request.firebase_uid = decoded.get("uid")
                request.firebase_email = decoded.get("email")

        except Exception as e:
            logger.debug(f"Firebase verification failed: {e}")

        return self.get_response(request)