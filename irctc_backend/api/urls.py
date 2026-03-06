from django.urls import path
from . import views

urlpatterns = [

    path("", views.api_root),

    # Train + Booking
    path("search-trains/", views.search_trains),
    path("select-train/", views.select_train),
    path("save-passengers/", views.save_passengers),
    path("pending-booking/", views.pending_booking),
    path("create-booking/", views.create_booking),
    path("verify-payment/", views.verify_payment),
    path("bookings/", views.get_bookings),
    path("bookings/<str:booking_id>/", views.get_booking_detail),
    path("cancel-booking/", views.cancel_booking),
    path("check-availability/", views.check_availability),
    path("train-status/", views.train_status),
    path("download-ticket/", views.download_ticket),
    path("ttr-verify-ticket/", views.ttr_verify_ticket),
    path("booking-stats/", views.booking_stats),
    path("submit-behavior/", views.submit_behavior),
    path("create-razorpay-order/", views.create_razorpay_order),
    path("webhook/razorpay/", views.razorpay_webhook),
    path("login/", views.login_view),
    path("verify-email-otp/", views.verify_email_otp),
    path("register/", views.register_view),

    # Admin APIs
    path("admin/session/", views.admin_session),
    path("admin/users/", views.admin_users),
    path("admin/users/<int:user_id>/", views.admin_update_user),
    path("admin/analytics/", views.admin_analytics),
]
