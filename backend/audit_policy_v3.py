from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


DATA_PATH = Path("data/payments_v3.csv")

ACTIONS = ["retry", "payment_link", "message", "escalate"]

ACTION_COSTS = {
    "retry": 8.0,
    "payment_link": 4.0,
    "message": 12.0,
    "escalate": 120.0,
}


def train_models(train_df):
    models = {}

    feature_cols = [
        "amount",
        "payment_method",
        "failure_reason",
        "previous_successes",
        "previous_failures",
    ]

    for action in ACTIONS:
        subset = train_df[train_df["initial_action"] == action].copy()

        X = subset[feature_cols]
        y = subset["recovered"].astype(int)

        preprocessor = ColumnTransformer(
            transformers=[
                (
                    "categorical",
                    OneHotEncoder(handle_unknown="ignore"),
                    ["payment_method", "failure_reason"],
                ),
                (
                    "numeric",
                    "passthrough",
                    ["amount", "previous_successes", "previous_failures"],
                ),
            ]
        )

        model = Pipeline(
            [
                ("preprocessor", preprocessor),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=120,
                        max_depth=8,
                        min_samples_leaf=20,
                        random_state=42,
                        class_weight="balanced",
                    ),
                ),
            ]
        )

        model.fit(X, y)
        models[action] = model

    return models


def main():
    df = pd.read_csv(DATA_PATH)

    df["payment_method"] = df["payment_method"].fillna("Unknown")
    df["failure_reason"] = df["failure_reason"].fillna("unknown")

    # Build customer history features.
    history = (
        df.groupby("customer_id")
        .agg(
            previous_successes=("recovered", "sum"),
            previous_failures=(
                "recovered",
                lambda s: int((~s.astype(bool)).sum()),
            ),
        )
        .reset_index()
    )

    df = df.drop(
        columns=["previous_successes", "previous_failures"],
        errors="ignore",
    )

    df = df.merge(history, on="customer_id", how="left")

    # Split by customer to reduce leakage.
    customers = df["customer_id"].unique()

    train_customers, test_customers = train_test_split(
        customers,
        test_size=0.25,
        random_state=42,
    )

    train_df = df[df["customer_id"].isin(train_customers)].copy()
    test_df = df[df["customer_id"].isin(test_customers)].copy()

    models = train_models(train_df)

    feature_cols = [
        "amount",
        "payment_method",
        "failure_reason",
        "previous_successes",
        "previous_failures",
    ]

    X_test = test_df[feature_cols]

    # ------------------------------------------------------------
    # V3 POLICY
    # ------------------------------------------------------------

    action_probabilities = {}

    for action in ACTIONS:
        action_probabilities[action] = models[action].predict_proba(
            X_test
        )[:, 1]

    probability_df = pd.DataFrame(action_probabilities, index=test_df.index)

    # Expected net recovery for every possible action.
    score_df = probability_df.copy()

    for action in ACTIONS:
        score_df[action] = (
            test_df["amount"] * score_df[action]
            - ACTION_COSTS[action]
        )

    # V3 chooses the action with maximum expected net recovery.
    v3_action = score_df.idxmax(axis=1)

    # ------------------------------------------------------------
    # HISTORICAL OUTCOME ANALYSIS
    # ------------------------------------------------------------

    # IMPORTANT:
    # The test dataset contains the outcome for the action that
    # actually happened historically.
    #
    # We cannot observe the counterfactual outcome for actions that
    # were NOT actually taken.
    #
    # Therefore this audit reports:
    # 1. V3's predicted policy.
    # 2. Historical action performance.
    # 3. Whether V3 tends to choose actions consistent with
    #    historically strong actions.
    #
    # It does NOT claim counterfactual causal recovery.

    print("=" * 70)
    print("ADAPTIVE REVENUE RECOVERY V3 — POLICY AUDIT")
    print("=" * 70)

    print(f"Test payments: {len(test_df)}")

    print("\nHistorical action performance:")
    historical = (
        test_df.groupby("initial_action")
        .agg(
            cases=("recovered", "size"),
            recovery_rate=("recovered", "mean"),
            recovered_amount=("recovered", "sum"),
        )
        .sort_values("recovery_rate", ascending=False)
    )

    print(historical.to_string())

    print("\nV3 recommended action distribution:")

    policy_counts = v3_action.value_counts()

    for action in ACTIONS:
        count = int(policy_counts.get(action, 0))
        percentage = count / len(test_df) * 100

        print(
            f"{action:15s} "
            f"{count:5d} "
            f"({percentage:6.2f}%)"
        )

    print("\nV3 expected-net-recovery summary:")

    chosen_scores = score_df.max(axis=1)

    print(
        f"Mean expected net recovery: "
        f"₹{chosen_scores.mean():.2f}"
    )

    print(
        f"Median expected net recovery: "
        f"₹{chosen_scores.median():.2f}"
    )

    print(
        f"Total expected net recovery: "
        f"₹{chosen_scores.sum():.2f}"
    )

    # ------------------------------------------------------------
    # BASELINE POLICY SCORES
    # ------------------------------------------------------------

    print("\nBaseline expected-net-recovery policies:")

    for action in ACTIONS:
        baseline_scores = score_df[action]

        print(
            f"{action:15s} "
            f"mean=₹{baseline_scores.mean():.2f} "
            f"total=₹{baseline_scores.sum():.2f}"
        )

    # ------------------------------------------------------------
    # AGREEMENT WITH HISTORICAL BEST ACTION
    # ------------------------------------------------------------

    historical_rates = (
        train_df.groupby("initial_action")["recovered"]
        .mean()
        .to_dict()
    )

    historical_best = max(
        ACTIONS,
        key=lambda action: historical_rates[action]
    )

    v3_agrees = (v3_action == historical_best).mean()

    print("\nPolicy diagnostics:")

    print(
        f"Historically strongest action in training data: "
        f"{historical_best}"
    )

    print(
        f"V3 agreement with strongest historical action: "
        f"{v3_agrees:.2%}"
    )

    print("\nIMPORTANT:")
    print(
        "This audit does NOT estimate causal counterfactual recovery."
    )
    print(
        "The dataset only records the outcome of the action actually taken."
    )
    print(
        "Therefore V3's expected recovery is model-based, not observed "
        "recovery under the chosen policy."
    )

    print("\n" + "=" * 70)
    print("POLICY AUDIT COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()