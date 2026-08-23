"""
Run one complete live vertical slice:

Synthetic recovery context
        ↓
Calibrated V3 Recovery Engine
        ↓
Guardrails
        ↓
Recovery Agent
        ↓
Razorpay Test API
        ↓
Payment Link / Recovery Action

Run from project root:
    python backend/demo_recovery.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"

sys.path.insert(0, str(BACKEND))

from config import (
    require_razorpay_credentials,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
)
from agent.agent import RecoveryAgent
from agent.guardrails import Guardrails
from agent.tools import (
    RazorpayTestClient,
    RazorpayRecoveryProvider,
)
from engine.live_engine import LiveRecoveryEngine


def main():
    require_razorpay_credentials()

    data_path = ROOT / "data" / "payments_v3.csv"

    # ------------------------------------------------------------
    # 1. START CALIBRATED V3 ENGINE
    # ------------------------------------------------------------

    engine = LiveRecoveryEngine(data_path)

    # ------------------------------------------------------------
    # 2. SYNTHETIC FAILED PAYMENT
    # ------------------------------------------------------------

    context = {
        "payment_id": "LIVE-DEMO-003",
        "customer_id": "demo_customer_001",
        "amount": 100.00,
        "method": "wallet",
        "error_code": "BAD_REQUEST_ERROR",
        "error_description": "temporary issue",
        "previous_successes": 0,
        "previous_failures": 0,
    }

    # ------------------------------------------------------------
    # 3. V3 DECISION
    # ------------------------------------------------------------

    decision = engine.decide(context)

    context.update(
        {
            "recommended_action":
                decision["recommended_action"],

            "recommended_probability":
                decision["recommended_probability"],

            "best_expected_net_recovery":
                decision["best_expected_net_recovery"],

            "failure_reason":
                decision["failure_reason_normalized"],
        }
    )

    # ------------------------------------------------------------
    # 4. RAZORPAY TEST PROVIDER
    # ------------------------------------------------------------

    client = RazorpayTestClient(
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET,
    )

    provider = RazorpayRecoveryProvider(client)

    agent = RecoveryAgent(
        provider,
        Guardrails(),
    )

    # ------------------------------------------------------------
    # 5. PRINT DECISION
    # ------------------------------------------------------------

    print("=" * 60)
    print("ADAPTIVE REVENUE RECOVERY — CALIBRATED V3")
    print("=" * 60)

    print(f"Payment ID: {context['payment_id']}")
    print(f"Test amount: ₹{context['amount']:.2f}")
    print(f"Failure: {context['failure_reason']}")

    print()
    print("ACTION PROBABILITIES:")

    for action, probability in (
        decision["action_probabilities"].items()
    ):
        print(
            f"  {action:15s}: "
            f"{probability:.4f}"
        )

    print()
    print(
        "ENGINE RECOMMENDATION:",
        decision["recommended_action"].upper(),
    )

    print(
        "RECOVERY PROBABILITY:",
        f"{decision['recommended_probability']:.4f}",
    )

    print(
        "EXPECTED NET RECOVERY:",
        f"₹{decision['best_expected_net_recovery']:.2f}",
    )

    print()
    print("GUARDRAILS: checking...")
    print()

    # ------------------------------------------------------------
    # 6. RUN AGENT
    # ------------------------------------------------------------

    result = agent.run(context)

    print("AGENT RESULT:")
    print("Status:", result["status"])
    print()

    # ------------------------------------------------------------
    # 7. RAZORPAY RESULT
    # ------------------------------------------------------------

    tool_result = result.get("result", {})

    if tool_result.get("short_url"):
        print("REAL RAZORPAY TEST PAYMENT LINK:")
        print(tool_result["short_url"])
        print()

        print("Payment Link ID:")
        print(tool_result.get("id"))

    # ------------------------------------------------------------
    # 8. AUDIT TRAIL
    # ------------------------------------------------------------

    print()
    print("AUDIT TRAIL:")

    for i, event in enumerate(agent.audit, 1):
        print(
            f"{i}. "
            f"{event['event']}: "
            f"{event['details']}"
        )


if __name__ == "__main__":
    main()