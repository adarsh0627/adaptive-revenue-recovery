"""
Starter decision interface.

The trained models from the notebook/prototype phase are not bundled as
binary model files yet. This module defines the contract the production
engine will implement.

Input: payment context
Output: recommended action + probability + expected net recovery
"""

ACTION_COSTS = {
    "retry": 8.0,
    "payment_link": 4.0,
    "message": 12.0,
    "escalate": 120.0,
    "stop": 0.0,
}

def rank_actions(payment, action_probabilities):
    """
    action_probabilities example:
    {"retry": 0.65, "payment_link": 0.48, ...}

    Returns the action maximizing expected net recovery.
    """
    amount = float(payment["amount"])

    scores = {
        action: amount * float(prob) - ACTION_COSTS[action]
        for action, prob in action_probabilities.items()
    }
    scores["stop"] = 0.0

    best_action = max(scores, key=scores.get)

    return {
        "recommended_action": best_action,
        "recommended_probability": float(
            action_probabilities.get(best_action, 0.0)
        ),
        "best_expected_net_recovery": float(scores[best_action]),
        "all_scores": scores,
    }
