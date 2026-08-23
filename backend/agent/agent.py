from typing import Dict, Any
from .guardrails import Guardrails


class RecoveryAgent:
    """
    Deterministic orchestration layer.

    The financial decision is made by the recovery engine.
    This class handles guardrails, tool execution, audit logging,
    and optional live recovery-attempt state.
    """

    def __init__(self, provider, guardrails=None, live_state=None):
        self.provider = provider
        self.guardrails = guardrails or Guardrails()
        self.live_state = live_state
        self.audit = []

    def log(self, event, details):
        self.audit.append({
            "event": event,
            "details": details,
        })

    def get_fallback_actions(self, context):
        scores = context.get("all_scores", {})

        return [
            action
            for action, _ in sorted(
                scores.items(),
                key=lambda item: item[1],
                reverse=True,
            )
            if action != "stop"
        ]

    def record_live_attempt(
        self,
        context: Dict[str, Any],
        action: str,
        result: Dict[str, Any],
    ):
        """
        Record an action only when the provider actually executed it.

        A retry result of 'not_connected' is deliberately not recorded
        as a real recovery attempt.
        """
        if self.live_state is None:
            return

        if action == "retry" and result.get("status") == "not_connected":
            self.log(
                "LIVE_STATE_RECORD",
                {
                    "recorded": False,
                    "reason": "retry_not_connected",
                },
            )
            return

        if action not in {
            "retry",
            "payment_link",
            "message",
            "escalate",
        }:
            return

        if action == "retry":
            if result.get("status") == "paid":
                attempt_result = "success"
            elif result.get("success") is False:
                attempt_result = "failed"
            else:
                attempt_result = "pending"

        elif action == "payment_link":
            if result.get("status") == "paid":
                attempt_result = "success"
            else:
                attempt_result = "pending"

        elif action == "message":
            attempt_result = "pending"

        elif action == "escalate":
            attempt_result = "pending"

        else:
            attempt_result = "pending"

        attempt = self.live_state.record_attempt(
            payment_id=context["payment_id"],
            action=action,
            result=attempt_result,
            recovered_amount=0.0,
        )

        self.log(
            "LIVE_STATE_RECORD",
            {
                "recorded": True,
                "attempt": attempt,
            },
        )

    def run(self, context: Dict[str, Any]):
        action = context["recommended_action"]
        probability = float(context["recommended_probability"])
        amount = float(context["amount"])

        self.log(
            "ENGINE_RECOMMENDATION",
            {
                "action": action,
                "probability": probability,
                "expected_net_recovery": context.get(
                    "best_expected_net_recovery"
                ),
            },
        )

        fallback_actions = self.get_fallback_actions(context)

        # Always try the engine's recommended action first.
        # If it cannot actually execute, move to the next
        # highest-scoring executable action.
        actions_to_try = [action] + [
            candidate
            for candidate in fallback_actions
            if candidate != action
        ]

        for candidate in actions_to_try:
            candidate_probability = float(
                context.get(
                    "action_probabilities",
                    {},
                ).get(
                    candidate,
                    0.0,
                )
            )

            allowed, reason = self.guardrails.check(
                candidate,
                amount,
                candidate_probability,
                context.get("previous_attempts", 0),
                context.get("contacts_last_7_days", 0),
            )

            self.log(
                "GUARDRAIL_CHECK",
                {
                    "action": candidate,
                    "allowed": allowed,
                    "reason": reason,
                },
            )

            if not allowed:
                if reason == "merchant_approval_required":
                    result = self.provider.escalate_to_merchant(
                        context["payment_id"],
                        reason,
                    )

                    self.log("TOOL_RESULT", result)

                    return {
                        "status": "awaiting_merchant",
                        "result": result,
                    }

                continue

            if candidate == "payment_link":
                result = self.provider.create_payment_link(
                    context["payment_id"],
                    amount,
                )

                self.log("TOOL_RESULT", result)

                self.record_live_attempt(
                    context,
                    candidate,
                    result,
                )

                return {
                    "status": "waiting_for_payment",
                    "result": result,
                }

            if candidate == "retry":
                result = self.provider.retry_payment(
                    context["payment_id"],
                    amount,
                )

                self.log("TOOL_RESULT", result)

                # A not-connected retry is not a real attempt.
                if result.get("status") == "not_connected":
                    self.log(
                        "ACTION_REEVALUATION",
                        {
                            "failed_action": "retry",
                            "reason": "tool_not_connected",
                            "next_action": (
                                actions_to_try[
                                    actions_to_try.index(candidate) + 1
                                ]
                                if actions_to_try.index(candidate) + 1
                                < len(actions_to_try)
                                else None
                            ),
                        },
                    )
                    continue

                self.record_live_attempt(
                    context,
                    candidate,
                    result,
                )

                return {
                    "status": (
                        "completed"
                        if result.get("status") == "paid"
                        else "needs_re_evaluation"
                    ),
                    "result": result,
                }

            if candidate == "message":
                result = self.provider.send_message(
                    context["customer_id"],
                    "Your recent payment could not be completed. "
                    "Please try again.",
                )

                self.log("TOOL_RESULT", result)

                self.record_live_attempt(
                    context,
                    candidate,
                    result,
                )

                return {
                    "status": "waiting_for_payment",
                    "result": result,
                }

            if candidate == "escalate":
                result = self.provider.escalate_to_merchant(
                    context["payment_id"],
                    "Engine recommendation",
                )

                self.log("TOOL_RESULT", result)

                self.record_live_attempt(
                    context,
                    candidate,
                    result,
                )

                return {
                    "status": "awaiting_merchant",
                    "result": result,
                }

        # Nothing executable remained.
        result = self.provider.stop_recovery(
            context["payment_id"],
            "No executable recovery action remained",
        )

        self.log("TOOL_RESULT", result)

        return {
            "status": "stopped",
            "result": result,
        }