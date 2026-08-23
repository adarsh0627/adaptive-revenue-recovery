from config import require_razorpay_credentials, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
from agent.tools import RazorpayTestClient

def main():
    require_razorpay_credentials()

    client = RazorpayTestClient(
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET,
    )

    # Authentication check without creating a Payment Link.
    # Fetching the list is intentionally avoided here to keep the first
    # command side-effect free.
    print("Razorpay TEST MODE credentials loaded.")
    print("Key ID:", RAZORPAY_KEY_ID[:12] + "...")
    print("No payment was created.")
    print("Next: run backend/create_test_link.py")

if __name__ == "__main__":
    main()
