from typing import Any, Dict
import requests


class RazorpayTestClient:
    BASE_URL = "https://api.razorpay.com/v1"

    def __init__(self, key_id: str, key_secret: str):
        self.auth = (key_id, key_secret)

    def create_payment_link(
        self,
        amount_rupees: float,
        reference_id: str,
        description: str,
    ) -> Dict[str, Any]:
        payload = {
            "amount": int(round(amount_rupees * 100)),
            "currency": "INR",
            "reference_id": reference_id,
            "description": description,
        }

        response = requests.post(
            f"{self.BASE_URL}/payment_links",
            auth=self.auth,
            json=payload,
            timeout=20,
        )

        data = response.json()
        if not response.ok:
            raise RuntimeError(
                f"Razorpay Payment Link API failed "
                f"({response.status_code}): {data}"
            )

        return data

    def fetch_payment_link(self, payment_link_id: str) -> Dict[str, Any]:
        response = requests.get(
            f"{self.BASE_URL}/payment_links/{payment_link_id}",
            auth=self.auth,
            timeout=20,
        )
        data = response.json()
        if not response.ok:
            raise RuntimeError(
                f"Razorpay Payment Link fetch failed "
                f"({response.status_code}): {data}"
            )
        return data

    def find_payment_link_by_payment_id(
        self,
        payment_id: str,
    ) -> Dict[str, Any] | None:
        response = requests.get(
            f"{self.BASE_URL}/payment_links/",
            params={"payment_id": payment_id},
            auth=self.auth,
            timeout=20,
        )

        data = response.json()

        if not response.ok:
            raise RuntimeError(
                f"Razorpay Payment Link search failed "
                f"({response.status_code}): {data}"
            )

        links = data.get("payment_links", [])

        if not links:
            return None

        return links[0]


class RazorpayRecoveryProvider:
    """
    Adapter that exposes the same tool contract used by our agent.

    This is the bridge:
        Agent -> provider tool -> Razorpay Test API
    """

    def __init__(self, client: RazorpayTestClient):
        self.client = client

    def create_payment_link(self, payment_id: str, amount: float):
        reference_id = f"ARR-{payment_id}"
        return self.client.create_payment_link(
            amount_rupees=amount,
            reference_id=reference_id[:40],
            description=f"Adaptive recovery for failed payment {payment_id}",
        )

    def send_message(self, customer_id: str, message: str,
                     channel: str = "email"):
        # Messaging is still mocked. We will connect a real channel later.
        return {
            "tool": "send_message",
            "success": True,
            "customer_id": customer_id,
            "channel": channel,
            "message": message,
            "mode": "mock",
        }

    def retry_payment(self, payment_id: str, amount: float):
        # Deliberately not implemented against a real customer payment yet.
        return {
            "tool": "retry_payment",
            "success": False,
            "status": "not_connected",
            "reason": "Real retry flow will be added after payment-state handling.",
        }

    def escalate_to_merchant(self, payment_id: str, reason: str):
        return {
            "tool": "escalate_to_merchant",
            "success": True,
            "case_id": f"case_{payment_id}",
            "reason": reason,
        }

    def stop_recovery(self, payment_id: str, reason: str):
        return {
            "tool": "stop_recovery",
            "success": True,
            "payment_id": payment_id,
            "reason": reason,
        }

    def find_payment_link_by_payment_id(
        self,
        payment_id: str,
    ):
        return self.client.find_payment_link_by_payment_id(
            payment_id
        )
