"""
Observe a Razorpay Test Mode Payment Link.

Usage:
    python backend/observe_payment_link.py plink_xxxxxxxxx

The script only reads the Payment Link. It does not create or modify anything.
"""

import sys
from config import (
    require_razorpay_credentials,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
)
from agent.tools import RazorpayTestClient


def main():
    if len(sys.argv) != 2:
        print("Usage: python backend/observe_payment_link.py <payment_link_id>")
        raise SystemExit(1)

    payment_link_id = sys.argv[1]

    require_razorpay_credentials()

    client = RazorpayTestClient(
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET,
    )

    link = client.fetch_payment_link(payment_link_id)

    print("=" * 60)
    print("RAZORPAY PAYMENT LINK OBSERVATION")
    print("=" * 60)
    print("Payment Link ID:", link.get("id"))
    print("Status:", link.get("status"))
    print("Amount:", link.get("amount", 0) / 100)
    print("Amount paid:", link.get("amount_paid", 0) / 100)
    print("Reference ID:", link.get("reference_id"))
    print("Short URL:", link.get("short_url"))

    payments = link.get("payments")
    if payments:
        print()
        print("Captured payment(s):")
        for payment in payments:
            print("  Payment ID:", payment.get("payment_id"))
            print("  Amount:", payment.get("amount", 0) / 100)
            print("  Status:", payment.get("status"))
    else:
        print()
        print("No captured payment is attached to this link yet.")

    print()
    print("RECOVERY OBSERVATION:")
    status = link.get("status")
    if status == "paid":
        print("SUCCESS → stop recovery.")
    elif status in {"created", "partially_paid"}:
        print("NOT FULLY RECOVERED → continue observation / re-evaluate.")
    elif status in {"expired", "cancelled"}:
        print("LINK CLOSED → choose another bounded recovery action.")
    else:
        print("UNKNOWN STATE → send to review before taking action.")


if __name__ == "__main__":
    main()
