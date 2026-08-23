"""Persistent mapping between recovery payments and Razorpay Payment Links."""

import json
from pathlib import Path
from typing import Any, Dict


class LiveRecoveryLinks:
    """Persist recovery-payment -> Razorpay Payment Link mappings."""

    def __init__(self, path: Path):
        self.path = Path(path)

        if self.path.exists():
            with self.path.open("r", encoding="utf-8") as f:
                self.data = json.load(f)
        else:
            self.data = {}

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)

        with self.path.open("w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2)

    def record_link(
        self,
        payment_id: str,
        payment_link_id: str,
        reference_id: str,
    ) -> Dict[str, Any]:
        record = {
            "payment_id": payment_id,
            "payment_link_id": payment_link_id,
            "reference_id": reference_id,
        }

        self.data[payment_link_id] = record
        self._save()

        return record

    def get_by_link_id(
        self,
        payment_link_id: str,
    ) -> Dict[str, Any] | None:
        return self.data.get(payment_link_id)

    def find_by_payment_id(
        self,
        payment_id: str,
    ) -> Dict[str, Any] | None:
        for record in self.data.values():
            if record.get("payment_id") == payment_id:
                return record

        return None