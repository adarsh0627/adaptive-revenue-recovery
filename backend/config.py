import os
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]

load_dotenv(ROOT / ".env")


# ---------------------------------------------------------
# RAZORPAY
# ---------------------------------------------------------

RAZORPAY_KEY_ID = os.getenv(
    "RAZORPAY_KEY_ID",
    "",
)

RAZORPAY_KEY_SECRET = os.getenv(
    "RAZORPAY_KEY_SECRET",
    "",
)

RAZORPAY_WEBHOOK_SECRET = os.getenv(
    "RAZORPAY_WEBHOOK_SECRET",
    "",
)


# ---------------------------------------------------------
# OPTIONAL AI
# ---------------------------------------------------------

ANTHROPIC_API_KEY = os.getenv(
    "ANTHROPIC_API_KEY",
    "",
)


# ---------------------------------------------------------
# SERVER CONFIGURATION
# ---------------------------------------------------------

API_HOST = os.getenv(
    "API_HOST",
    "0.0.0.0",
)

API_PORT = int(
    os.getenv(
        "API_PORT",
        os.getenv("PORT", "8001"),
    )
)

WEBHOOK_HOST = os.getenv(
    "WEBHOOK_HOST",
    "0.0.0.0",
)

WEBHOOK_PORT = int(
    os.getenv(
        "WEBHOOK_PORT",
        os.getenv("PORT", "8000"),
    )
)


# ---------------------------------------------------------
# FRONTEND / CORS
# ---------------------------------------------------------

CORS_ORIGIN = os.getenv(
    "CORS_ORIGIN",
    "http://localhost:5173",
)


# ---------------------------------------------------------
# RAZORPAY VALIDATION
# ---------------------------------------------------------

def require_razorpay_credentials():

    if (
        not RAZORPAY_KEY_ID
        or not RAZORPAY_KEY_SECRET
    ):
        raise RuntimeError(
            "Razorpay credentials missing. "
            "Copy .env.example to .env and add "
            "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
        )

    if not RAZORPAY_KEY_ID.startswith(
        "rzp_test_"
    ):
        raise RuntimeError(
            "This prototype only accepts "
            "Razorpay TEST MODE keys. "
            "Expected key_id to start with "
            "rzp_test_."
        )