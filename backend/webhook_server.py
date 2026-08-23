"""Razorpay webhook receiver connected to Adaptive Recovery Engine v3."""

import hashlib
import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(ROOT / ".env")

from agent.agent import RecoveryAgent
from agent.guardrails import Guardrails
from agent.tools import RazorpayTestClient, RazorpayRecoveryProvider
from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, require_razorpay_credentials
from engine.live_engine import LiveRecoveryEngine
from state import RecoveryState
from live_state import LiveRecoveryState
from live_links import LiveRecoveryLinks

WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
HOST = "127.0.0.1"
PORT = 8000
DATA_PATH = ROOT / "data" / "payments_v3.csv"

processed_event_ids = set()
engine = None
provider = None
agent = None
live_state = None
state = None
live_links = None


def verify_signature(raw_body: bytes, received_signature: str) -> bool:
    if not WEBHOOK_SECRET or not received_signature:
        return False
    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, received_signature)


def build_payment_context(payment: dict) -> dict:
    payment_id = payment.get("id") or "unknown"
    customer_id = (
        payment.get("customer_id")
        or payment.get("email")
        or "unknown_customer"
    )

    amount = (payment.get("amount") or 0) / 100.0
    method = payment.get("method") or "Unknown"

    customer_history = state.get_customer_history(
        customer_id
    )

    historical_attempt_history = (
        state.get_payment_attempt_history(payment_id)
    )

    # Live runtime state is authoritative when this payment has
    # already been processed by the live recovery system.
    live_attempts = live_state.get_attempts(payment_id)

    if live_attempts:
        previous_attempts = len(live_attempts)
        last_attempt = live_attempts[-1]

        last_action = last_attempt.get("action")
        last_result = last_attempt.get("result")
    else:
        previous_attempts = (
            historical_attempt_history["previous_attempts"]
        )
        last_action = historical_attempt_history["last_action"]
        last_result = historical_attempt_history["last_result"]

    return {
        "payment_id": payment_id,
        "customer_id": customer_id,
        "amount": amount,
        "method": method,
        "error_code": payment.get("error_code") or "",
        "error_description": (
            payment.get("error_description") or ""
        ),

        # Customer history used by the V3 model.
        "previous_successes":
            customer_history["previous_successes"],

        "previous_failures":
            customer_history["previous_failures"],

        # Runtime-aware recovery history used by guardrails.
        "previous_attempts":
            previous_attempts,

        "contacts_last_7_days": 0,

        # Diagnostics / audit.
        "customer_known":
            customer_history["customer_known"],

        "customer_ltv":
            customer_history["customer_ltv"],

        "preferred_payment_method":
            customer_history["preferred_payment_method"],

        "last_recovery_action":
            last_action,

        "last_recovery_result":
            last_result,
    }


def process_failed_payment(payment: dict):
    context = build_payment_context(payment)
    decision = engine.decide(context)

    context.update({
        "recommended_action": decision["recommended_action"],
        "recommended_probability": decision["recommended_probability"],
        "best_expected_net_recovery": decision["best_expected_net_recovery"],
        "action_probabilities": decision["action_probabilities"],
        "all_scores": decision.get("all_scores", {}),
        "failure_reason": decision["failure_reason_normalized"],
    })

    print("\nRECOVERY ENGINE V3")
    print("Normalized failure:", decision["failure_reason_normalized"])
    print("Action probabilities:", decision["action_probabilities"])
    print("Recommended action:", decision["recommended_action"])
    print("Recovery probability:", round(decision["recommended_probability"], 3))
    print("Expected net recovery: ₹", round(decision["best_expected_net_recovery"], 2))

    result = agent.run(context)

    # Persist the mapping between the recovery payment and the
    # Razorpay Payment Link so a later payment.captured event
    # can resolve the original recovery attempt.
    #
    # Use the ACTUAL executed result, because the engine's original
    # recommendation may have fallen back to another action.
    tool_result = result.get("result", {})

    if (
        result.get("status") == "waiting_for_payment"
        and tool_result.get("id")
        and tool_result.get("reference_id")
    ):
        payment_link_id = tool_result["id"]
        reference_id = tool_result["reference_id"]

        live_links.record_link(
            payment_id=context["payment_id"],
            payment_link_id=payment_link_id,
            reference_id=reference_id,
        )

        print("LIVE LINK MAPPING SAVED")
        print("Recovery Payment ID:", context["payment_id"])
        print("Payment Link ID:", payment_link_id)
        print("Reference ID:", reference_id)

    print("\nAGENT RESULT")
    print("Status:", result.get("status"))
    tool_result = result.get("result", {})
    if tool_result.get("short_url"):
        print("Recovery Payment Link:", tool_result["short_url"])
        print("Recovery Payment Link ID:", tool_result.get("id"))

    print("\nAUDIT TRAIL")
    for i, event in enumerate(agent.audit[-3:], 1):
        print(f"{i}. {event['event']}: {event['details']}")


def process_captured_payment(payment: dict):
    payment_id = payment.get("id") or "unknown"
    amount = (payment.get("amount") or 0) / 100.0

    print("\nCAPTURED PAYMENT PROCESSING")

    # Razorpay's payment.captured webhook gives us the captured
    # payment ID. Resolve it back to the Payment Link through
    # Razorpay's read-only Payment Link API.
    payment_link = provider.find_payment_link_by_payment_id(
        payment_id
    )

    if not payment_link:
        print("LIVE STATE UPDATE: not resolved")
        print(
            "Reason: no Payment Link found for captured payment",
            payment_id,
        )
        return

    payment_link_id = payment_link.get("id")
    reference_id = payment_link.get("reference_id", "")

    print("Payment Link ID:", payment_link_id)
    print("Reference ID:", reference_id)

    mapping = live_links.get_by_link_id(
        payment_link_id
    )

    if not mapping:
        print("LIVE STATE UPDATE: not resolved")
        print(
            "Reason: Payment Link is not registered "
            "as a recovery link"
        )
        return

    recovery_payment_id = mapping["payment_id"]

    updated = live_state.update_last_attempt(
        recovery_payment_id,
        "success",
        amount,
    )

    if updated is None:
        print("LIVE STATE UPDATE: not resolved")
        print(
            "Reason: no live recovery attempt for",
            recovery_payment_id,
        )
        return

    print("LIVE STATE UPDATE: success")
    print("Recovery payment ID:", recovery_payment_id)
    print("Captured payment ID:", payment_id)
    print("Recovered amount: ₹", amount)
    print("Updated attempt:", updated)
    print("RECOVERY COMPLETED → stop recovery")


class RazorpayWebhookHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            body = b'{"status":"ok","service":"razorpay-webhook-receiver"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404, "Not Found")

    def do_POST(self):
        if self.path != "/webhooks/razorpay":
            self.send_error(404, "Not Found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)
        signature = self.headers.get("X-Razorpay-Signature", "")
        event_id = self.headers.get("x-razorpay-event-id", "")

        if not verify_signature(raw_body, signature):
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"rejected","reason":"invalid_signature"}')
            return

        if event_id and event_id in processed_event_ids:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"duplicate","processed":false}')
            return

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        if event_id:
            processed_event_ids.add(event_id)

        event = payload.get("event", "unknown")
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})

        print("\n" + "=" * 60)
        print("RAZORPAY WEBHOOK RECEIVED")
        print("=" * 60)
        print("Event:", event)
        print("Event ID:", event_id or "(not provided)")
        print("Payment ID:", payment.get("id"))
        print("Payment status:", payment.get("status"))
        print("Amount:", (payment.get("amount") or 0) / 100)
        print("Method:", payment.get("method"))
        print("Error code:", payment.get("error_code"))
        print("Error description:", payment.get("error_description"))

        # Acknowledge Razorpay immediately before doing recovery work.
        body = b'{"status":"received"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

        if event == "payment.failed":
            print("\nRECOVERY EVENT:")
            print("FAILED PAYMENT → Recovery Engine v3")

            try:
                process_failed_payment(payment)
            except Exception as exc:
                print(
                    "RECOVERY PROCESSING ERROR:",
                    repr(exc),
                )

        elif event == "payment.captured":
            print("\nRECOVERY EVENT:")
            print("PAYMENT CAPTURED → stop recovery")

            try:
                process_captured_payment(payment)
            except Exception as exc:
                print(
                    "CAPTURED PAYMENT PROCESSING ERROR:",
                    repr(exc),
                )

        else:
            print("\nRECOVERY EVENT:")
            print("Event received; no recovery action.")

    def log_message(self, format, *args):
        return


def main():
    global engine, provider, agent, live_state, state, live_links

    if not WEBHOOK_SECRET:
        raise RuntimeError(
            "RAZORPAY_WEBHOOK_SECRET is missing. Add a dedicated webhook secret to .env."
        )

    require_razorpay_credentials()

    state = RecoveryState(ROOT / "data")

    live_state = LiveRecoveryState(
        ROOT / "data" / "live_recovery_attempts.json"
    )

    live_links = LiveRecoveryLinks(
        ROOT / "data" / "live_recovery_links.json"
    )

    engine = LiveRecoveryEngine(DATA_PATH)

    provider = RazorpayRecoveryProvider(
        RazorpayTestClient(
            RAZORPAY_KEY_ID,
            RAZORPAY_KEY_SECRET,
        )
    )

    agent = RecoveryAgent(
        provider,
        Guardrails(),
        live_state,
    )

    server = HTTPServer(
        (HOST, PORT),
        RazorpayWebhookHandler,
    )

    print("=" * 60)
    print("RAZORPAY WEBHOOK + ADAPTIVE RECOVERY ENGINE V3")
    print("=" * 60)
    print(f"Listening on: http://{HOST}:{PORT}")
    print(f"Webhook path: http://{HOST}:{PORT}/webhooks/razorpay")
    print("Model source: data/payments_v3.csv")
    print("Waiting for payment events... Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping webhook receiver...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
