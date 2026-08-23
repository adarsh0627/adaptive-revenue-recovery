from dataclasses import dataclass

@dataclass
class Guardrails:
    max_automated_amount: float = 10_000
    max_attempts: int = 2
    max_contacts_7_days: int = 2
    min_probability: float = 0.10

    def check(self, action, amount, probability,
              previous_attempts=0, contacts_last_7_days=0):
        if contacts_last_7_days >= self.max_contacts_7_days:
            return False, "contact_limit_reached"
        if previous_attempts >= self.max_attempts:
            return False, "max_attempts_reached"
        if probability < self.min_probability:
            return False, "probability_too_low"
        if action in {"retry", "payment_link", "message"} and amount > self.max_automated_amount:
            return False, "merchant_approval_required"
        return True, "approved"
