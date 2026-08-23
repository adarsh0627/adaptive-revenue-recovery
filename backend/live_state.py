"""Runtime recovery-attempt state for live/demo payments."""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


class LiveRecoveryState:
    """Persist live recovery attempts separately from training data."""

    def __init__(self, path: Path):
        self.path = Path(path)

        if self.path.exists():
            with self.path.open("r", encoding="utf-8") as f:
                self.data = json.load(f)
        else:
            self.data = {}

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)

        with self.path.open(
            "w",
            encoding="utf-8",
        ) as f:
            json.dump(
                self.data,
                f,
                indent=2,
            )

    def get_attempts(
        self,
        payment_id: str,
    ):
        return self.data.get(
            payment_id,
            [],
        )

    def get_attempt_count(
        self,
        payment_id: str,
    ) -> int:
        return len(
            self.get_attempts(payment_id)
        )

    def record_attempt(
        self,
        payment_id: str,
        action: str,
        result: str = "pending",
        recovered_amount: float = 0.0,
    ) -> Dict[str, Any]:

        attempts = self.data.setdefault(
            payment_id,
            [],
        )

        attempt = {
            "attempt_number": len(attempts) + 1,
            "action": action,
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
            "result": result,
            "recovered_amount": float(
                recovered_amount
            ),
        }

        attempts.append(attempt)

        self._save()

        return attempt

    def update_last_attempt(
        self,
        payment_id: str,
        result: str,
        recovered_amount: float = 0.0,
    ) -> Dict[str, Any] | None:

        attempts = self.data.get(
            payment_id,
            [],
        )

        if not attempts:
            return None

        attempts[-1]["result"] = result
        attempts[-1]["recovered_amount"] = float(
            recovered_amount
        )

        self._save()

        return attempts[-1]