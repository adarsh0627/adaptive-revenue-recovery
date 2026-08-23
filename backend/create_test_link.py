from config import require_razorpay_credentials, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
from agent.tools import RazorpayTestClient

def main():
    require_razorpay_credentials()

    client = RazorpayTestClient(
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET,
    )

    link = client.create_payment_link(
        amount_rupees=100.00,
        reference_id="ARR-ORIGINAL-FAIL-002",
	description="Original payment failure test",
    )

    print("Payment Link created in TEST MODE.")
    print("ID:", link.get("id"))
    print("Short URL:", link.get("short_url"))
    print("Status:", link.get("status"))

if __name__ == "__main__":
    main()
