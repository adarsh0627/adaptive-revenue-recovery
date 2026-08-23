"""Lightweight state/history access for Adaptive Revenue Recovery V3."""

from pathlib import Path
from typing import Any, Dict

import pandas as pd


class RecoveryState:
    """Read customer and recovery-attempt history from V3 CSV data."""

    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)

        self.customers_path = (
            self.data_dir / "customers_v3.csv"
        )

        self.attempts_path = (
            self.data_dir / "recovery_attempts_v3.csv"
        )

        self.customers = pd.read_csv(
            self.customers_path
        )

        self.attempts = pd.read_csv(
            self.attempts_path
        )

        self.customers = self.customers.set_index(
            "customer_id"
        )

    def get_customer_history(
        self,
        customer_id: str,
    ) -> Dict[str, Any]:

        row = self.customers.loc[
            customer_id
        ] if customer_id in self.customers.index else None

        if row is None:
            return {
                "customer_known": False,
                "previous_successes": 0,
                "previous_failures": 0,
                "customer_ltv": 0.0,
                "preferred_payment_method": "Unknown",
            }

        return {
            "customer_known": True,
            "previous_successes": int(
                row["total_successful_payments"]
            ),
            "previous_failures": int(
                row["total_failed_payments"]
            ),
            "customer_ltv": float(
                row["customer_ltv"]
            ),
            "preferred_payment_method": str(
                row["preferred_payment_method"]
            ),
        }

    def get_payment_attempt_history(
        self,
        payment_id: str,
    ) -> Dict[str, Any]:

        rows = self.attempts[
            self.attempts["payment_id"]
            == payment_id
        ]

        if rows.empty:
            return {
                "previous_attempts": 0,
                "last_action": None,
                "last_result": None,
            }

        rows = rows.sort_values(
            "attempt_number"
        )

        last = rows.iloc[-1]

        return {
            "previous_attempts": int(
                len(rows)
            ),
            "last_action": str(
                last["action"]
            ),
            "last_result": str(
                last["result"]
            ),
        }