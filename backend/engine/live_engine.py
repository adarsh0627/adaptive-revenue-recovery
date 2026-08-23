"""Live decision engine for Adaptive Revenue Recovery v3.

The engine trains action-specific recovery models from the synthetic
v3 dataset at process startup.

Financial decision-making stays outside the LLM/agent layer.

Each action model now has a probability calibration layer so that
predicted recovery probabilities are better aligned with observed
recovery frequencies.
"""

from pathlib import Path
from typing import Any, Dict

import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .recovery_engine import rank_actions


ACTIONS = [
    "retry",
    "payment_link",
    "message",
    "escalate",
]


class LiveRecoveryEngine:
    def __init__(self, data_path: Path):
        self.data_path = Path(data_path)
        self.models = {}
        self._train()

    def _make_base_model(self):
        """Create the underlying Random Forest pipeline."""

        feature_cols = [
            "amount",
            "payment_method",
            "failure_reason",
            "previous_successes",
            "previous_failures",
        ]

        preprocessor = ColumnTransformer(
            transformers=[
                (
                    "categorical",
                    OneHotEncoder(
                        handle_unknown="ignore"
                    ),
                    [
                        "payment_method",
                        "failure_reason",
                    ],
                ),
                (
                    "numeric",
                    "passthrough",
                    [
                        "amount",
                        "previous_successes",
                        "previous_failures",
                    ],
                ),
            ]
        )

        classifier = RandomForestClassifier(
            n_estimators=120,
            max_depth=8,
            min_samples_leaf=20,
            random_state=42,
            class_weight="balanced",
        )

        return Pipeline(
            [
                (
                    "preprocessor",
                    preprocessor,
                ),
                (
                    "classifier",
                    classifier,
                ),
            ]
        )

    def _build_point_in_time_history(self, payments):
        """
        Build customer-history features using only outcomes from
        payments that occurred before the current payment.

        This prevents the current/future payment outcome from
        becoming a feature for that same payment.
        """

        payments = payments.sort_values(
            [
                "customer_id",
                "timestamp",
                "payment_id",
            ]
        ).copy()

        payments["previous_successes"] = (
            payments.groupby("customer_id")["recovered"]
            .transform(
                lambda s:
                s.astype(int)
                .shift(1)
                .cumsum()
                .fillna(0)
            )
        )

        payments["previous_failures"] = (
            payments.groupby("customer_id")["recovered"]
            .transform(
                lambda s:
                (1 - s.astype(int))
                .shift(1)
                .cumsum()
                .fillna(0)
            )
        )

        return payments

    def _train(self):
        payments = pd.read_csv(self.data_path)

        payments["payment_method"] = (
            payments["payment_method"]
            .fillna("Unknown")
        )

        payments["failure_reason"] = (
            payments["failure_reason"]
            .fillna("unknown")
        )

        payments["timestamp"] = pd.to_datetime(
            payments["timestamp"]
        )

        # IMPORTANT:
        # Build history before training, using only prior
        # payments for each customer.
        payments = self._build_point_in_time_history(
            payments
        )

        feature_cols = [
            "amount",
            "payment_method",
            "failure_reason",
            "previous_successes",
            "previous_failures",
        ]

        for action in ACTIONS:

            subset = payments[
                payments["initial_action"] == action
            ].copy()

            if (
                subset["recovered"].nunique() < 2
                or len(subset) < 50
            ):
                continue

            X = subset[feature_cols]
            y = subset["recovered"].astype(int)

            # CalibratedClassifierCV performs cross-validation
            # internally and learns the sigmoid calibration layer.
            calibrated_model = CalibratedClassifierCV(
                estimator=self._make_base_model(),
                method="sigmoid",
                cv=5,
            )

            calibrated_model.fit(
                X,
                y,
            )

            self.models[action] = calibrated_model

        if len(self.models) < len(ACTIONS):
            raise RuntimeError(
                "Could not train all recovery action models "
                "from payments_v3.csv"
            )

    @staticmethod
    def normalize_failure_reason(
        error_code: str,
        description: str,
        method: str,
    ) -> str:

        text = (
            f"{error_code} {description}"
        ).lower()

        if (
            "timeout" in text
            or "timed out" in text
        ):
            return "bank_timeout"

        if (
            "network" in text
            or "temporary issue" in text
        ):
            return "network_error"

        if (
            "insufficient" in text
            or "balance" in text
        ):
            return "insufficient_balance"

        if "limit" in text:
            return "limit_exceeded"

        if "expired" in text:
            return "expired_card"

        if (
            method.lower() == "card"
            and "declin" in text
        ):
            return "card_declined"

        return "network_error"

    def decide(
        self,
        payment: Dict[str, Any],
    ) -> Dict[str, Any]:

        amount = float(
            payment.get("amount", 0.0)
        )

        method = str(
            payment.get("method")
            or "Unknown"
        )

        failure_reason = (
            self.normalize_failure_reason(
                str(
                    payment.get("error_code")
                    or ""
                ),
                str(
                    payment.get("error_description")
                    or ""
                ),
                method,
            )
        )

        row = pd.DataFrame(
            [
                {
                    "amount": amount,
                    "payment_method": (
                        method.title()
                        if method
                        else "Unknown"
                    ),
                    "failure_reason":
                        failure_reason,
                    "previous_successes":
                        float(
                            payment.get(
                                "previous_successes",
                                0,
                            )
                        ),
                    "previous_failures":
                        float(
                            payment.get(
                                "previous_failures",
                                0,
                            )
                        ),
                }
            ]
        )

        probabilities = {
            action:
                float(
                    self.models[action]
                    .predict_proba(row)[0][1]
                )
            for action in ACTIONS
        }

        decision = rank_actions(
            payment,
            probabilities,
        )

        decision.update(
            {
                "failure_reason_normalized":
                    failure_reason,

                "action_probabilities":
                    probabilities,
            }
        )

        return decision