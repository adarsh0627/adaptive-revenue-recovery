import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

def require_razorpay_credentials():
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise RuntimeError(
            "Razorpay credentials missing. Copy .env.example to .env "
            "and add TEST MODE RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
        )
    if not RAZORPAY_KEY_ID.startswith("rzp_test_"):
        raise RuntimeError(
            "This prototype only accepts Razorpay TEST MODE keys. "
            "Expected key_id to start with rzp_test_."
        )
