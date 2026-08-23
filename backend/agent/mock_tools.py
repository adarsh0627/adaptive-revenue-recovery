class MockPaymentProvider:
    def create_payment_link(self, payment_id, amount):
        return {
            "tool": "create_payment_link",
            "success": True,
            "payment_link_id": f"mock_plink_{payment_id.lower()}",
            "payment_link": f"https://mock-pay.local/{payment_id}",
            "amount": amount,
        }

    def retry_payment(self, payment_id, amount):
        return {
            "tool": "retry_payment",
            "success": False,
            "status": "failed",
            "payment_id": payment_id,
            "amount": amount,
        }

    def send_message(self, customer_id, message, channel="email"):
        return {
            "tool": "send_message",
            "success": True,
            "customer_id": customer_id,
            "channel": channel,
        }

    def escalate_to_merchant(self, payment_id, reason):
        return {
            "tool": "escalate_to_merchant",
            "success": True,
            "case_id": f"mock_case_{payment_id.lower()}",
            "reason": reason,
        }

    def stop_recovery(self, payment_id, reason):
        return {
            "tool": "stop_recovery",
            "success": True,
            "payment_id": payment_id,
            "reason": reason,
        }
