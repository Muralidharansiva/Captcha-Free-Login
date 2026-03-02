# api/admin.py

from django.contrib import admin
from .models import (
    Booking,
    SelectedTrain,
    PassengerSession,
    TrainAvailability,
    BookingBehavior,
    LoginAttempt,
    UserProfile,
    BookingQueue,
    EmailOTP,
)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("pnr", "user", "journey_date", "status", "payment_status", "total_fare", "booking_date")
    list_filter = ("status", "journey_date", "payment_status", "travel_class", "quota")
    search_fields = ("pnr", "transaction_id", "contact_phone", "contact_email")


@admin.register(SelectedTrain)
class SelectedTrainAdmin(admin.ModelAdmin):
    list_display = ("user", "updated_at")


@admin.register(PassengerSession)
class PassengerSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "updated_at")


@admin.register(TrainAvailability)
class TrainAvailabilityAdmin(admin.ModelAdmin):
    list_display = ("train_number", "journey_date", "class_type", "quota", "available_seats")
    list_filter = ("journey_date", "class_type", "quota")


@admin.register(BookingBehavior)
class BookingBehaviorAdmin(admin.ModelAdmin):
    list_display = ("pnr", "user", "human_score", "created_at")
    search_fields = ("pnr",)
    readonly_fields = ("human_score", "created_at")


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "username", "ip_address", "status")
    search_fields = ("username", "ip_address", "user_agent")
    readonly_fields = ("timestamp", "ip_address", "user_agent", "username", "status")
    list_filter = ("status", "timestamp")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("firebase_uid", "email", "display_name", "created_at")
    search_fields = ("firebase_uid", "email", "display_name")


@admin.register(BookingQueue)
class BookingQueueAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "created_at")


@admin.register(EmailOTP)
class EmailOTPAdmin(admin.ModelAdmin):
    list_display = ("email", "created_at", "attempts")
    readonly_fields = ("created_at",)