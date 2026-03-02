import requests
import hmac
import hashlib
import json

# Replace with your actual Razorpay webhook secret
WEBHOOK_SECRET = "your_webhook_secret_here"

# Replace with your backend webhook endpoint
WEBHOOK_URL = "http://127.0.0.1:8000/api/razorpay-webhook/"

# Simulated Razorpay webhook payload
payload = {
    "event": "payment.captured",
    "payload": {
        "payment": {
            "entity": {
                "id": "TXN20251022103000",  # Must match a transaction_id in your Booking table
                "email": "user@example.com",
                "contact": "9876543210"
            }
        }
    }
}

# Convert payload to JSON string
body = json.dumps(payload).encode("utf-8")

# Generate Razorpay-style signature
signature = hmac.new(
    bytes(WEBHOOK_SECRET, "utf-8"),
    body,
    hashlib.sha256
).hexdigest()

# Send POST request to your backend
response = requests.post(
    WEBHOOK_URL,
    data=body,
    headers={
        "Content-Type": "application/json",
        "X-Razorpay-Signature": signature
    }
)
print("Status:", response.status_code)
try:
    print("Response:", response.json())
except Exception:
    print("Raw Response:", response.text)
