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


def split_by_customer(df, test_size, random_state):
    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=test_size,
        random_state=random_state,
    )

    train_idx, test_idx = next(
        splitter.split(
            df,
            groups=df["customer_id"],
        )
    )

    return (
        df.iloc[train_idx].copy(),
        df.iloc[test_idx].copy(),
    )


def main():
    print("=" * 70)
    print("ADAPTIVE REVENUE RECOVERY V3")
    print("FINAL OUT-OF-SAMPLE CALIBRATION VALIDATION")
    print("=" * 70)

    df = pd.read_csv(DATA_PATH)

    df["payment_method"] = df["payment_method"].fillna("Unknown")
    df["failure_reason"] = df["failure_reason"].fillna("unknown")
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = add_point_in_time_history(df)

    # ------------------------------------------------------------
    # 1. OUTER TEST SPLIT
    # ------------------------------------------------------------

    development_df, test_df = split_by_customer(
        df,
        test_size=0.20,
        random_state=42,
    )

    # ------------------------------------------------------------
    # 2. DEVELOPMENT -> TRAIN + CALIBRATION
    # ------------------------------------------------------------

    train_df, calibration_df = split_by_customer(
        development_df,
        test_size=0.25,
        random_state=43,
    )

    print(f"Total payments:       {len(df)}")
    print(f"Training payments:    {len(train_df)}")
    print(f"Calibration payments: {len(calibration_df)}")
    print(f"Final test payments:  {len(test_df)}")

    train_customers = set(train_df["customer_id"])
    calibration_customers = set(calibration_df["customer_id"])
    test_customers = set(test_df["customer_id"])

    print()
    print(
        "Train/Calibration overlap:",
        len(train_customers & calibration_customers),
    )
    print(
        "Train/Test overlap:",
        len(train_customers & test_customers),
    )
    print(
        "Calibration/Test overlap:",
        len(calibration_customers & test_customers),
    )

    if (
        train_customers & calibration_customers
        or train_customers & test_customers
        or calibration_customers & test_customers
    ):
        raise RuntimeError(
            "Customer leakage detected."
        )

    results = []

    for action in ACTIONS:

        train_action = train_df[
            train_df["initial_action"] == action
        ]

        calibration_action = calibration_df[
            calibration_df["initial_action"] == action
        ]

        test_action = test_df[
            test_df["initial_action"] == action
        ]

        X_train = train_action[FEATURE_COLS]
        y_train = train_action["recovered"].astype(int)

        X_calibration = calibration_action[FEATURE_COLS]
        y_calibration = calibration_action["recovered"].astype(int)

        X_test = test_action[FEATURE_COLS]
        y_test = test_action["recovered"].astype(int)

        # --------------------------------------------------------
        # RAW MODEL
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
        # CALIBRATED MODEL
        # --------------------------------------------------------

        # Fit the Random Forest on TRAIN and learn calibration
        # using the separate CALIBRATION dataset.
        #
        # CalibratedClassifierCV's cv parameter performs internal
        # calibration splits, so we use the development data here
        # and keep the final TEST set completely untouched.

        calibrated_model = CalibratedClassifierCV(
            estimator=make_base_model(),
            method="sigmoid",
            cv=5,
        )

        # Combine train + calibration ONLY for the calibration
        # experiment. Final test remains untouched.
        development_action = pd.concat(
            [train_action, calibration_action],
            ignore_index=True,
        )

        X_development = development_action[FEATURE_COLS]
        y_development = development_action["recovered"].astype(int)

        calibrated_model.fit(
            X_development,
            y_development,
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

        results.append(
            {
                "action": action,
                "cases": len(test_action),
                "actual_rate": y_test.mean(),
                "raw_brier": raw_brier,
                "calibrated_brier": calibrated_brier,
                "brier_improvement":
                    raw_brier - calibrated_brier,
                "raw_auc": raw_auc,
                "calibrated_auc": calibrated_auc,
                "auc_change":
                    calibrated_auc - raw_auc,
                "raw_mean_probability":
                    raw_probability.mean(),
                "calibrated_mean_probability":
                    calibrated_probability.mean(),
            }
        )

    result_df = pd.DataFrame(results)

    print()
    print("=" * 70)
    print("FINAL TEST RESULTS")
    print("=" * 70)

    print(
        result_df.to_string(
            index=False,
            formatters={
                "actual_rate": "{:.4f}".format,
                "raw_brier": "{:.4f}".format,
                "calibrated_brier": "{:.4f}".format,
                "brier_improvement": "{:+.4f}".format,
                "raw_auc": "{:.4f}".format,
                "calibrated_auc": "{:.4f}".format,
                "auc_change": "{:+.4f}".format,
                "raw_mean_probability": "{:.4f}".format,
                "calibrated_mean_probability": "{:.4f}".format,
            },
        )
    )

    print()
    print("=" * 70)
    print("DECISION GUIDE")
    print("=" * 70)

    for _, row in result_df.iterrows():

        if row["brier_improvement"] > 0:
            decision = "CALIBRATION HELPS"
        else:
            decision = "KEEP RAW"

        print(
            f"{row['action']:15s} "
            f"→ {decision}"
        )

    print()
    print(
        "The final test set was never used to fit the models "
        "or choose the calibration method."
    )

    print("=" * 70)
    print("FINAL CALIBRATION VALIDATION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()