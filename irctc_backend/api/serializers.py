# api/serializers.py
from rest_framework import serializers
from .models import Booking, BookingBehavior

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = "__all__"

class BookingBehaviorSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingBehavior
        fields = "__all__"
