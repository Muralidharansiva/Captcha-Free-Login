# api/firebase_auth.py

from functools import wraps
from rest_framework.response import Response
from rest_framework import status


def firebase_required(view_func):
    """
    Decorator to protect API endpoints.
    Requires FirebaseAuthMiddleware to attach request.firebase_user.
    """

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):

        if not hasattr(request, "firebase_user") or request.firebase_user is None:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return view_func(request, *args, **kwargs)

    return wrapper