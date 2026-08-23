from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, brier_score_loss

from engine.live_engine import ACTIONS


DATA_PATH = Path("data/payments_v3.csv")


def build_models(train_df):
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder

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

    # Rebuild history features.
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

    # IMPORTANT:
    # split customers, not individual rows, to reduce leakage from
    # repeated customer history.
    customers = df["customer_id"].unique()

    train_customers, test_customers = train_test_split(
        customers,
        test_size=0.25,
        random_state=42,
    )

    train_df = df[df["customer_id"].isin(train_customers)].copy()
    test_df = df[df["customer_id"].isin(test_customers)].copy()

    print("=" * 70)
    print("ADAPTIVE REVENUE RECOVERY V3 — MODEL AUDIT")
    print("=" * 70)

    print(f"Total rows:       {len(df)}")
    print(f"Training rows:    {len(train_df)}")
    print(f"Test rows:        {len(test_df)}")

    models = build_models(train_df)

    feature_cols = [
        "amount",
        "payment_method",
        "failure_reason",
        "previous_successes",
        "previous_failures",
    ]

    for action in ACTIONS:
        subset = test_df[test_df["initial_action"] == action].copy()

        X_test = subset[feature_cols]
        y_test = subset["recovered"].astype(int)

        probabilities = models[action].predict_proba(X_test)[:, 1]

        auc = roc_auc_score(y_test, probabilities)
        brier = brier_score_loss(y_test, probabilities)
        baseline = y_test.mean()

        print()
        print(f"--- {action} ---")
        print(f"Test cases:             {len(subset)}")
        print(f"Actual recovery rate:   {baseline:.4f}")
        print(f"ROC-AUC:                {auc:.4f}")
        print(f"Brier score:            {brier:.4f}")
        print(
            f"Mean predicted probability: "
            f"{probabilities.mean():.4f}"
        )

    print()
    print("=" * 70)
    print("AUDIT COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()