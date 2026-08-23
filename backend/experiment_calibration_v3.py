from pathlib import Path

import pandas as pd

from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


DATA_PATH = Path("data/payments_v3.csv")

ACTIONS = [
    "retry",
    "payment_link",
    "message",
    "escalate",
]

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
            lambda s: s.astype(int)
            .shift(1)
            .cumsum()
            .fillna(0)
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


def make_base_model():
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

    classifier = RandomForestClassifier(
        n_estimators=120,
        max_depth=8,
        min_samples_leaf=20,
        random_state=42,
        class_weight="balanced",
    )

    return Pipeline(
        [
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )


def main():
    print("=" * 70)
    print("ADAPTIVE REVENUE RECOVERY V3 — CALIBRATION EXPERIMENT")
    print("=" * 70)

    df = pd.read_csv(DATA_PATH)

    df["payment_method"] = df["payment_method"].fillna("Unknown")
    df["failure_reason"] = df["failure_reason"].fillna("unknown")
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = add_point_in_time_history(df)

    # ------------------------------------------------------------
    # CUSTOMER-LEVEL HOLDOUT
    # ------------------------------------------------------------

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

    print(f"Training payments: {len(train_df)}")
    print(f"Test payments:     {len(test_df)}")
    print(
        f"Customer overlap: "
        f"{len(set(train_df.customer_id) & set(test_df.customer_id))}"
    )

    # ------------------------------------------------------------
    # EVALUATE EACH ACTION
    # ------------------------------------------------------------

    for action in ACTIONS:

        train_action = train_df[
            train_df["initial_action"] == action
        ].copy()

        test_action = test_df[
            test_df["initial_action"] == action
        ].copy()

        X_train = train_action[FEATURE_COLS]
        y_train = train_action["recovered"].astype(int)

        X_test = test_action[FEATURE_COLS]
        y_test = test_action["recovered"].astype(int)

        # --------------------------------------------------------
        # RAW RANDOM FOREST
        # --------------------------------------------------------

        raw_model = make_base_model()

        raw_model.fit(
            X_train,
            y_train,
        )

        raw_probability = raw_model.predict_proba(
            X_test
        )[:, 1]

        # --------------------------------------------------------
        # SIGMOID CALIBRATION
        # --------------------------------------------------------

        calibrated_model = CalibratedClassifierCV(
            estimator=make_base_model(),
            method="sigmoid",
            cv=5,
        )

        calibrated_model.fit(
            X_train,
            y_train,
        )

        calibrated_probability = calibrated_model.predict_proba(
            X_test
        )[:, 1]

        # --------------------------------------------------------
        # METRICS
        # --------------------------------------------------------

        raw_brier = brier_score_loss(
            y_test,
            raw_probability,
        )

        calibrated_brier = brier_score_loss(
            y_test,
            calibrated_probability,
        )

        raw_auc = roc_auc_score(
            y_test,
            raw_probability,
        )

        calibrated_auc = roc_auc_score(
            y_test,
            calibrated_probability,
        )

        print()
        print("-" * 70)
        print(action.upper())
        print("-" * 70)

        print(
            f"Test cases:                 "
            f"{len(test_action)}"
        )

        print(
            f"Actual recovery rate:       "
            f"{y_test.mean():.4f}"
        )

        print()
        print("RAW RANDOM FOREST")
        print(
            f"Mean probability:           "
            f"{raw_probability.mean():.4f}"
        )
        print(
            f"Brier score:                "
            f"{raw_brier:.4f}"
        )
        print(
            f"ROC-AUC:                    "
            f"{raw_auc:.4f}"
        )

        print()
        print("SIGMOID CALIBRATED")
        print(
            f"Mean probability:           "
            f"{calibrated_probability.mean():.4f}"
        )
        print(
            f"Brier score:                "
            f"{calibrated_brier:.4f}"
        )
        print(
            f"ROC-AUC:                    "
            f"{calibrated_auc:.4f}"
        )

        print()
        print(
            f"Brier improvement:          "
            f"{raw_brier - calibrated_brier:+.4f}"
        )

        print(
            f"ROC-AUC change:              "
            f"{calibrated_auc - raw_auc:+.4f}"
        )

    print()
    print("=" * 70)
    print("CALIBRATION EXPERIMENT COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()