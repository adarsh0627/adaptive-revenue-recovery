from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


DATA_PATH = Path("data/payments_v3.csv")

ACTIONS = ["retry", "payment_link", "message", "escalate"]

FEATURE_COLS = [
    "amount",
    "payment_method",
    "failure_reason",
    "previous_successes",
    "previous_failures",
]


def add_point_in_time_history(df):
    df = df.sort_values(
        ["customer_id", "timestamp", "payment_id"]
    ).copy()

    df["previous_successes"] = (
        df.groupby("customer_id")["recovered"]
        .transform(
            lambda s: s.astype(int).shift(1).cumsum().fillna(0)
        )
    )

    df["previous_failures"] = (
        df.groupby("customer_id")["recovered"]
        .transform(
            lambda s: (1 - s.astype(int))
            .shift(1)
            .cumsum()
            .fillna(0)
        )
    )

    return df


def train_models(train_df):
    models = {}

    for action in ACTIONS:
        subset = train_df[
            train_df["initial_action"] == action
        ].copy()

        X = subset[FEATURE_COLS]
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
                    [
                        "amount",
                        "previous_successes",
                        "previous_failures",
                    ],
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


def print_calibration(action, y_true, probabilities):
    print()
    print("-" * 70)
    print(f"{action.upper()} — CALIBRATION")
    print("-" * 70)

    result = pd.DataFrame(
        {
            "actual": y_true.to_numpy(),
            "probability": probabilities,
        }
    )

    # Fixed 10-percentage-point probability buckets.
    bins = [
        0.0,
        0.1,
        0.2,
        0.3,
        0.4,
        0.5,
        0.6,
        0.7,
        0.8,
        0.9,
        1.0,
    ]

    labels = [
        "0-10%",
        "10-20%",
        "20-30%",
        "30-40%",
        "40-50%",
        "50-60%",
        "60-70%",
        "70-80%",
        "80-90%",
        "90-100%",
    ]

    result["bucket"] = pd.cut(
        result["probability"],
        bins=bins,
        labels=labels,
        include_lowest=True,
        right=True,
    )

    calibration = (
        result.groupby(
            "bucket",
            observed=False,
        )
        .agg(
            cases=("actual", "size"),
            mean_predicted=("probability", "mean"),
            actual_recovery=("actual", "mean"),
        )
    )

    calibration["gap"] = (
        calibration["actual_recovery"]
        - calibration["mean_predicted"]
    )

    print(
        calibration.to_string(
            formatters={
                "mean_predicted": "{:.4f}".format,
                "actual_recovery": "{:.4f}".format,
                "gap": "{:+.4f}".format,
            }
        )
    )


def main():
    print("=" * 70)
    print("ADAPTIVE REVENUE RECOVERY V3 — CALIBRATION AUDIT")
    print("=" * 70)

    df = pd.read_csv(DATA_PATH)

    df["payment_method"] = df["payment_method"].fillna("Unknown")
    df["failure_reason"] = df["failure_reason"].fillna("unknown")
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    # Build history using only information available before
    # each payment.
    df = add_point_in_time_history(df)

    # Split by customer.
    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.25,
        random_state=42,
    )

    train_idx, test_idx = next(
        splitter.split(
            df,
            groups=df["customer_id"],
        )
    )

    train_df = df.iloc[train_idx].copy()
    test_df = df.iloc[test_idx].copy()

    print(f"Total payments:    {len(df)}")
    print(f"Training payments: {len(train_df)}")
    print(f"Test payments:     {len(test_df)}")
    print(
        f"Train customers:   "
        f"{train_df['customer_id'].nunique()}"
    )
    print(
        f"Test customers:    "
        f"{test_df['customer_id'].nunique()}"
    )

    models = train_models(train_df)

    for action in ACTIONS:
        subset = test_df[
            test_df["initial_action"] == action
        ].copy()

        X_test = subset[FEATURE_COLS]
        y_test = subset["recovered"].astype(int)

        probabilities = models[action].predict_proba(
            X_test
        )[:, 1]

        print_calibration(
            action,
            y_test,
            probabilities,
        )

    print()
    print("=" * 70)
    print("CALIBRATION AUDIT COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()