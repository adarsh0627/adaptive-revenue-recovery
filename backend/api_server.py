import csv
import json
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

PAYMENTS_FILE = DATA_DIR / "payments_v3.csv"
LIVE_STATE_FILE = DATA_DIR / "live_recovery_attempts.json"
RECOVERY_ATTEMPTS_FILE = DATA_DIR / "recovery_attempts_v3.csv"
GUARDRAILS_FILE = DATA_DIR / "adaptive_engine_v2_guardrails.csv"

HOST = "127.0.0.1"
PORT = 8001


# ---------------------------------------------------------
# DATA LOADERS
# ---------------------------------------------------------

def load_payments():
    if not PAYMENTS_FILE.exists():
        return []

    with PAYMENTS_FILE.open(
        "r",
        encoding="utf-8",
        newline="",
    ) as file:
        return list(csv.DictReader(file))


def load_live_state():
    if not LIVE_STATE_FILE.exists():
        return {}

    try:
        with LIVE_STATE_FILE.open(
            "r",
            encoding="utf-8",
        ) as file:
            return json.load(file)

    except (json.JSONDecodeError, OSError):
        return {}

def load_guardrails():
    if not GUARDRAILS_FILE.exists():
        return []

    try:
        with GUARDRAILS_FILE.open(
            "r",
            encoding="utf-8",
            newline="",
        ) as file:
            return list(csv.DictReader(file))
    except (OSError, csv.Error):
        return []

def load_recovery_attempts():
    if not RECOVERY_ATTEMPTS_FILE.exists():
        return []

    try:
        with RECOVERY_ATTEMPTS_FILE.open(
            "r",
            encoding="utf-8",
            newline="",
        ) as file:
            return list(csv.DictReader(file))
    except (OSError, csv.Error):
        return []

# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def format_action(action):
    labels = {
        "payment_link": "Payment Link",
        "retry": "Retry",
        "message": "Message",
        "escalate": "Merchant escalation",
        "stop": "Recovery stopped",
    }

    return labels.get(
        action,
        str(action).replace("_", " ").title(),
    )


def format_status(result):
    statuses = {
        "success": "Recovered",
        "pending": "Pending",
        "failed": "Failed",
        "stopped": "Stopped",
    }

    return statuses.get(
        result,
        str(result).replace("_", " ").title(),
    )


def calculate_probability(failure_reason):
    """
    Current V3 dashboard uses a 59% average recovery
    probability.

    Until per-payment probability is exposed by the
    recovery engine/API, use the same value for payment
    records.
    """
    return 59.0


def parse_timestamp(timestamp):
    if not timestamp:
        return datetime.min.replace(
            tzinfo=timezone.utc
        )

    try:
        # Historical CSV timestamps don't contain timezone.
        parsed = datetime.strptime(
            timestamp,
            "%Y-%m-%d %H:%M:%S",
        )

        return parsed.replace(
            tzinfo=timezone.utc
        )

    except ValueError:
        try:
            return datetime.fromisoformat(
                timestamp
            )
        except ValueError:
            return datetime.min.replace(
                tzinfo=timezone.utc
            )


# ---------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------

def build_dashboard():
    historical = load_payments()
    live_state = load_live_state()

    historical_failed = len(historical)

    historical_recovered = sum(
        1
        for payment in historical
        if str(
            payment.get("recovered", "")
        ).lower() == "true"
    )

    historical_revenue = sum(
        float(payment.get("amount") or 0)
        for payment in historical
        if str(
            payment.get("recovered", "")
        ).lower() == "true"
    )

    live_failed = len(live_state)

    live_recovered = 0
    live_pending = 0
    live_revenue = 0.0

    for attempts in live_state.values():

        if not attempts:
            continue

        last_attempt = attempts[-1]
        result = last_attempt.get("result")

        if result == "success":
            live_recovered += 1

            live_revenue += float(
                last_attempt.get(
                    "recovered_amount"
                ) or 0
            )

        elif result == "pending":
            live_pending += 1

    total_failed = (
        historical_failed +
        live_failed
    )

    total_recovered = (
        historical_recovered +
        live_recovered
    )

    recovered_revenue = (
        historical_revenue +
        live_revenue
    )

    recovery_rate = (
        (total_recovered / total_failed) * 100
        if total_failed
        else 0
    )

    return {
        "failed_payments": total_failed,
        "recovered_payments": total_recovered,
        "pending_recovery": live_pending,
        "recovered_revenue": round(
            recovered_revenue,
            2,
        ),
        "recovery_rate": round(
            recovery_rate,
            1,
        ),
        "avg_recovery_probability": 59.0,
        "source": {
            "historical_payments": historical_failed,
            "live_payments": live_failed,
        },
    }


# ---------------------------------------------------------
# RECOVERY ACTIVITY
# ---------------------------------------------------------

def build_recovery_activity():
    live_state = load_live_state()
    activities = []

    for payment_id, attempts in live_state.items():

        if not attempts:
            continue

        for attempt in attempts:

            result = attempt.get(
                "result",
                "unknown",
            )

            activities.append(
                {
                    "id": payment_id,

                    "action": format_action(
                        attempt.get(
                            "action",
                            "unknown",
                        )
                    ),

                    "action_key": attempt.get(
                        "action",
                        "unknown",
                    ),

                    "amount": float(
                        attempt.get(
                            "recovered_amount"
                        ) or 0
                    ),

                    "status": format_status(
                        result
                    ),

                    "status_key": result,

                    "timestamp": attempt.get(
                        "timestamp"
                    ),

                    "attempt_number": attempt.get(
                        "attempt_number"
                    ),
                }
            )

    activities.sort(
        key=lambda item: parse_timestamp(
            item.get("timestamp")
        ),
        reverse=True,
    )

    return {
        "activities": activities,
        "count": len(activities),
    }


# ---------------------------------------------------------
# FAILED PAYMENTS
# ---------------------------------------------------------

def build_failed_payments(
    search="",
    status="all",
    method="all",
    page=1,
    page_size=25,
):
    historical = load_payments()
    live_state = load_live_state()

    records = []

    # -----------------------------------------------------
    # HISTORICAL PAYMENTS
    # -----------------------------------------------------

    for payment in historical:

        payment_id = payment.get(
            "payment_id",
            "",
        )

        failure_reason = payment.get(
            "failure_reason",
            "unknown",
        )

        payment_method = payment.get(
            "payment_method",
            "Unknown",
        )

        recovered = (
            str(
                payment.get(
                    "recovered",
                    "",
                )
            ).lower()
            == "true"
        )

        action = payment.get(
            "initial_action",
            "unknown",
        )

        record_status = (
            "Recovered"
            if recovered
            else "Failed"
        )

        record = {
            "payment_id": payment_id,

            "customer_id": payment.get(
                "customer_id"
            ),

            "amount": float(
                payment.get(
                    "amount"
                ) or 0
            ),

            "payment_method": payment_method,

            "failure_reason": failure_reason,

            "timestamp": payment.get(
                "timestamp"
            ),

            "probability": calculate_probability(
                failure_reason
            ),

            "action": format_action(
                action
            ),

            "action_key": action,

            "status": record_status,

            "status_key": (
                "success"
                if recovered
                else "failed"
            ),

            "source": "historical",
        }

        records.append(record)

    # -----------------------------------------------------
    # LIVE PAYMENTS
    # -----------------------------------------------------

    for payment_id, attempts in live_state.items():

        if not attempts:
            continue

        last_attempt = attempts[-1]

        result = last_attempt.get(
            "result",
            "pending",
        )

        action = last_attempt.get(
            "action",
            "unknown",
        )

        recovered_amount = float(
            last_attempt.get(
                "recovered_amount"
            ) or 0
        )

        live_status = format_status(result)

        # Live webhook currently stores recovery state,
        # not the complete original payment entity.
        record = {
            "payment_id": payment_id,

            "customer_id": None,

            "amount": recovered_amount,

            "payment_method": "Wallet",

            "failure_reason": "network_error",

            "timestamp": last_attempt.get(
                "timestamp"
            ),

            "probability": 59.0,

            "action": format_action(
                action
            ),

            "action_key": action,

            "status": live_status,

            "status_key": result,

            "source": "live",
        }

        records.append(record)

    # -----------------------------------------------------
    # SORT
    # -----------------------------------------------------

    records.sort(
        key=lambda item: parse_timestamp(
            item.get("timestamp")
        ),
        reverse=True,
    )

    # -----------------------------------------------------
    # FILTER
    # -----------------------------------------------------

    normalized_search = (
        search.strip().lower()
    )

    filtered = []

    for record in records:

        if normalized_search:

            searchable = " ".join(
                str(record.get(field) or "")
                for field in [
                    "payment_id",
                    "customer_id",
                    "payment_method",
                    "failure_reason",
                    "action",
                    "status",
                ]
            ).lower()

            if normalized_search not in searchable:
                continue

        if (
            status.lower() != "all"
            and record["status"].lower()
            != status.lower()
        ):
            continue

        if (
            method.lower() != "all"
            and record["payment_method"].lower()
            != method.lower()
        ):
            continue

        filtered.append(record)

    # -----------------------------------------------------
    # PAGINATION
    # -----------------------------------------------------

    total = len(filtered)

    try:
        page = max(
            int(page),
            1,
        )
    except (ValueError, TypeError):
        page = 1

    try:
        page_size = min(
            max(
                int(page_size),
                1,
            ),
            100,
        )
    except (ValueError, TypeError):
        page_size = 25

    total_pages = (
        (total + page_size - 1)
        // page_size
        if total
        else 1
    )

    if page > total_pages:
        page = total_pages

    start = (
        (page - 1)
        * page_size
    )

    end = start + page_size

    paginated = filtered[
        start:end
    ]

    return {
        "payments": paginated,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
        "filters": {
            "search": search,
            "status": status,
            "method": method,
        },
    }


def build_payment_details(payment_id):
    historical = load_payments()
    live_state = load_live_state()

    # -----------------------------------------------------
    # LIVE PAYMENT
    # -----------------------------------------------------

    if payment_id in live_state:
        attempts = live_state.get(payment_id, [])

        if not attempts:
            return None

        first_attempt = attempts[0]
        last_attempt = attempts[-1]

        last_result = last_attempt.get(
            "result",
            "pending",
        )

        failure_reason = last_attempt.get(
            "failure_reason",
            "network_error",
        )

        probability = float(
            last_attempt.get(
                "probability",
                59.0,
            )
            or 59.0
        )

        action = last_attempt.get(
            "action",
            "unknown",
        )

        amount = float(
            last_attempt.get(
                "recovered_amount",
                0,
            )
            or 0
        )

        # Build actual recovery timeline from live attempts.
        timeline = []

        for index, attempt in enumerate(
            attempts,
            start=1,
        ):
            attempt_action = attempt.get(
                "action",
                "unknown",
            )

            result = attempt.get(
                "result",
                "pending",
            )

            timeline.append(
                {
                    "event": (
                        f"Recovery attempt #{index}"
                    ),
                    "description": (
                        f"{format_action(attempt_action)} "
                        f"executed by recovery engine."
                    ),
                    "timestamp": attempt.get(
                        "timestamp"
                    ),
                    "status": result,
                    "status_label": format_status(
                        result
                    ),
                    "action": format_action(
                        attempt_action
                    ),
                    "attempt_number": attempt.get(
                        "attempt_number",
                        index,
                    ),
                }
            )

        # Add a final recovery event when payment succeeds.
        if last_result == "success":
            timeline.append(
                {
                    "event": "Payment recovered",
                    "description": (
                        "Payment was successfully recovered "
                        "by the recovery engine."
                    ),
                    "timestamp": last_attempt.get(
                        "timestamp"
                    ),
                    "status": "success",
                    "status_label": "Recovered",
                    "action": format_action(
                        action
                    ),
                    "attempt_number": last_attempt.get(
                        "attempt_number"
                    ),
                }
            )

        return {
            "payment": {
                "payment_id": payment_id,
                "customer_id": None,
                "amount": amount,
                "payment_method": "Wallet",
                "failure_reason": failure_reason,
                "timestamp": first_attempt.get(
                    "timestamp"
                ),
                "probability": probability,
                "action": format_action(action),
                "action_key": action,
                "status": format_status(
                    last_result
                ),
                "status_key": last_result,
                "source": "live",
            },
            "timeline": timeline,
        }

    # -----------------------------------------------------
    # HISTORICAL PAYMENT
    # -----------------------------------------------------

    for payment in historical:
        if payment.get("payment_id") != payment_id:
            continue

        recovered = (
            str(
                payment.get(
                    "recovered",
                    "",
                )
            ).lower()
            == "true"
        )

        action = payment.get(
            "initial_action",
            "unknown",
        )

        failure_reason = payment.get(
            "failure_reason",
            "unknown",
        )

        timestamp = payment.get(
            "timestamp"
        )

        probability = calculate_probability(
            failure_reason
        )

        record_status = (
            "Recovered"
            if recovered
            else "Failed"
        )

        timeline = [
            {
                "event": "Payment failure detected",
                "description": (
                    f"Payment failed due to "
                    f"{failure_reason}."
                ),
                "timestamp": timestamp,
                "status": "failed",
                "status_label": "Failed",
                "action": None,
                "attempt_number": None,
            }
        ]

        if recovered:
            timeline.append(
                {
                    "event": "Recovery completed",
                    "description": (
                        f"Payment recovered using "
                        f"{format_action(action)}."
                    ),
                    "timestamp": timestamp,
                    "status": "success",
                    "status_label": "Recovered",
                    "action": format_action(action),
                    "attempt_number": None,
                }
            )

        return {
            "payment": {
                "payment_id": payment_id,
                "customer_id": payment.get(
                    "customer_id"
                ),
                "amount": float(
                    payment.get("amount") or 0
                ),
                "payment_method": payment.get(
                    "payment_method",
                    "Unknown",
                ),
                "failure_reason": failure_reason,
                "timestamp": timestamp,
                "probability": probability,
                "action": format_action(action),
                "action_key": action,
                "status": record_status,
                "status_key": (
                    "success"
                    if recovered
                    else "failed"
                ),
                "source": "historical",
            },
            "timeline": timeline,
        }

    return None


# ---------------------------------------------------------
# RECOVERY PERFORMANCE
# ---------------------------------------------------------

def build_recovery_performance():
    payments = load_payments()

    buckets = {}

    for payment in payments:

        timestamp = payment.get(
            "timestamp"
        )

        parsed = parse_timestamp(
            timestamp
        )

        month = parsed.month

        if month not in buckets:
            buckets[month] = {
                "total": 0,
                "recovered": 0,
            }

        buckets[month]["total"] += 1

        if str(
            payment.get(
                "recovered",
                "",
            )
        ).lower() == "true":

            buckets[month]["recovered"] += 1

    labels = []
    values = []
    bucket_data = []

    for month in range(1, 13):

        data = buckets.get(
            month,
            {
                "total": 0,
                "recovered": 0,
            },
        )

        total = data["total"]
        recovered = data["recovered"]

        value = (
            (recovered / total) * 100
            if total
            else 0
        )

        labels.append(
            str(month)
        )

        values.append(
            round(value, 1)
        )

        bucket_data.append(
            {
                "label": str(month),
                "value": round(
                    value,
                    1,
                ),
                "recovered": recovered,
                "total": total,
            }
        )

    total = len(payments)

    recovered = sum(
        1
        for payment in payments
        if str(
            payment.get(
                "recovered",
                "",
            )
        ).lower() == "true"
    )

    return {
        "labels": labels,
        "values": values,
        "buckets": bucket_data,
        "recovered": recovered,
        "total": total,
    }


# ---------------------------------------------------------
# AUDIT TRAIL
# ---------------------------------------------------------

def build_audit_trail(
    search="",
    category="all",
    status="all",
    date_range="30d",
    page=1,
    page_size=25,
):
    historical = load_payments()
    recovery_attempts = load_recovery_attempts()
    live_state = load_live_state()
    guardrails = load_guardrails()

    events = []

    # -----------------------------------------------------
    # HISTORICAL ENGINE DECISIONS
    # -----------------------------------------------------

    for payment in historical:
        payment_id = payment.get("payment_id", "")
        timestamp = payment.get("timestamp")
        action = payment.get("initial_action", "unknown")
        probability = calculate_probability(
            payment.get("failure_reason", "unknown")
        )

        events.append({
            "id": f"AUD-HIST-{payment_id}-ENGINE",
            "event": "ENGINE_RECOMMENDATION",
            "category": "Engine",
            "paymentId": payment_id,
            "description": (
                f"Recovery Engine V3 selected "
                f"{format_action(action)}."
            ),
            "details": (
                f"Recovery probability: "
                f"{probability:.1f}%."
            ),
            "status": "Decision",
            "timestamp": timestamp,
            "source": "historical",
        })

    # -----------------------------------------------------
    # HISTORICAL RECOVERY ATTEMPTS
    # -----------------------------------------------------

    payment_lookup = {
        str(payment.get("payment_id", "")): payment
        for payment in historical
    }

    for attempt in recovery_attempts:
        attempt_id = attempt.get("attempt_id", "")
        payment_id = attempt.get("payment_id", "")
        action = attempt.get("action", "unknown")
        result = str(
            attempt.get("result", "pending")
        ).lower()

        timestamp = attempt.get("timestamp")

        result_labels = {
            "success": "Success",
            "failed": "Failed",
            "pending": "Pending",
            "stopped": "Stopped",
        }

        status_label = result_labels.get(
            result,
            str(result).replace("_", " ").title(),
        )

        payment = payment_lookup.get(
            str(payment_id),
            {},
        )

        amount = float(
            payment.get("amount") or 0
        )

        events.append({
            "id": (
                f"AUD-HIST-{attempt_id}-ATTEMPT"
            ),
            "event": "RECOVERY_ATTEMPT",
            "category": "Recovery",
            "paymentId": payment_id,
            "description": (
                f"{format_action(action)} "
                f"executed by recovery engine."
            ),
            "details": (
                f"Recovery attempt #"
                f"{attempt.get('attempt_number', 1)}"
                f" · Amount ₹{amount:,.2f}"
            ),
            "status": status_label,
            "timestamp": timestamp,
            "source": "historical",
        })

        if result == "success":
            recovered_amount = float(
                attempt.get("recovered_amount") or 0
            )

            events.append({
                "id": (
                    f"AUD-HIST-{attempt_id}"
                    f"-COMPLETED"
                ),
                "event": "RECOVERY_COMPLETED",
                "category": "Recovery",
                "paymentId": payment_id,
                "description": (
                    "Payment recovery completed."
                ),
                "details": (
                    f"Recovered using "
                    f"{format_action(action)}"
                    f" · ₹{recovered_amount:,.2f}"
                ),
                "status": "Success",
                "timestamp": timestamp,
                "source": "historical",
            })

    # -----------------------------------------------------
    # HISTORICAL GUARDRAIL DECISIONS
    # -----------------------------------------------------

    for guardrail in guardrails:
        payment_id = guardrail.get(
            "payment_id",
            "",
        )

        final_action = guardrail.get(
            "final_action",
            "",
        )

        reason = guardrail.get(
            "guardrail_reason",
            "",
        )

        automated = str(
            guardrail.get(
                "automated",
                "",
            )
        ).lower() == "true"

        probability_raw = guardrail.get(
            "recommended_probability",
            "",
        )

        try:
            probability = (
                float(probability_raw) * 100
            )
        except (
            ValueError,
            TypeError,
        ):
            probability = None

        blocked = (
            final_action == "stop"
            or (
                bool(reason)
                and not automated
            )
        )

        event_status = (
            "Blocked"
            if blocked
            else "Approved"
        )

        if blocked:
            description = (
                "Recovery action blocked "
                "by guardrail."
            )
            details = (
                reason.replace("_", " ").title()
                if reason
                else "Recovery policy prevented "
                     "automated execution."
            )
        else:
            description = (
                "Recovery action approved "
                "by guardrail."
            )
            details = (
                "Recovery action satisfied "
                "the configured guardrails."
            )

        if probability is not None:
            details += (
                f" · Probability "
                f"{probability:.1f}%"
            )

        events.append({
            "id": (
                f"AUD-HIST-{payment_id}"
                f"-GUARDRAIL"
            ),
            "event": "GUARDRAIL_CHECK",
            "category": "Guardrail",
            "paymentId": payment_id,
            "description": description,
            "details": details,
            "status": event_status,
            "timestamp": (
                payment_lookup
                .get(str(payment_id), {})
                .get("timestamp")
            ),
            "source": "historical",
        })

    # -----------------------------------------------------
    # LIVE RECOVERY EVENTS
    # -----------------------------------------------------

    for payment_id, attempts in live_state.items():

        if not attempts:
            continue

        for attempt in attempts:

            result = str(
                attempt.get(
                    "result",
                    "pending",
                )
            ).lower()

            action = attempt.get(
                "action",
                "unknown",
            )

            attempt_number = attempt.get(
                "attempt_number",
                1,
            )

            timestamp = attempt.get(
                "timestamp"
            )

            status_labels = {
                "success": "Success",
                "failed": "Failed",
                "pending": "Pending",
                "stopped": "Stopped",
            }

            status_label = status_labels.get(
                result,
                str(result).replace(
                    "_",
                    " ",
                ).title(),
            )

            events.append({
                "id": (
                    f"AUD-LIVE-{payment_id}"
                    f"-ATTEMPT-{attempt_number}"
                ),
                "event": "RECOVERY_ATTEMPT",
                "category": "Recovery",
                "paymentId": payment_id,
                "description": (
                    f"{format_action(action)} "
                    f"executed by recovery engine."
                ),
                "details": (
                    f"Live recovery attempt #"
                    f"{attempt_number}."
                ),
                "status": status_label,
                "timestamp": timestamp,
                "source": "live",
            })

            if result == "success":
                recovered_amount = float(
                    attempt.get(
                        "recovered_amount"
                    ) or 0
                )

                events.append({
                    "id": (
                        f"AUD-LIVE-{payment_id}"
                        f"-COMPLETED-{attempt_number}"
                    ),
                    "event": "RECOVERY_COMPLETED",
                    "category": "Recovery",
                    "paymentId": payment_id,
                    "description": (
                        "Payment recovery completed."
                    ),
                    "details": (
                        f"Recovered using "
                        f"{format_action(action)}"
                        f" · ₹{recovered_amount:,.2f}"
                    ),
                    "status": "Success",
                    "timestamp": timestamp,
                    "source": "live",
                })

    # -----------------------------------------------------
    # SORT
    # -----------------------------------------------------

    events.sort(
        key=lambda item: parse_timestamp(
            item.get("timestamp")
        ),
        reverse=True,
    )

    # -----------------------------------------------------
    # DATE RANGE
    # -----------------------------------------------------

    date_filtered = events

    if date_range != "all" and events:

        latest_timestamp = max(
            (
                parse_timestamp(
                    event.get("timestamp")
                )
                for event in events
            ),
            default=datetime.now(
                timezone.utc
            ),
        )

        days_map = {
            "24h": 1,
            "7d": 7,
            "30d": 30,
            "90d": 90,
        }

        days = days_map.get(
            date_range,
            30,
        )

        cutoff = (
            latest_timestamp
            - timedelta(days=days)
        )

        date_filtered = [
            event
            for event in events
            if parse_timestamp(
                event.get("timestamp")
            ) >= cutoff
        ]

    # -----------------------------------------------------
    # SUMMARY
    #
    # IMPORTANT:
    # "Blocked actions" only counts actual
    # guardrail-blocked events.
    # It does NOT count payment failures.
    # -----------------------------------------------------

    summary = {
        "total": len(date_filtered),
        "guardrails": sum(
            1
            for event in date_filtered
            if event["category"] == "Guardrail"
        ),
        "webhooks": sum(
            1
            for event in date_filtered
            if event["category"] == "Webhook"
            and event["status"] == "Verified"
        ),
        "blocked": sum(
            1
            for event in date_filtered
            if (
                event["category"] == "Guardrail"
                and event["status"] == "Blocked"
            )
        ),
    }

    # -----------------------------------------------------
    # SEARCH + FILTERS
    # -----------------------------------------------------

    normalized_search = (
        str(search or "")
        .strip()
        .lower()
    )

    normalized_category = (
        str(category or "all")
        .strip()
        .lower()
    )

    normalized_status = (
        str(status or "all")
        .strip()
        .lower()
    )

    filtered = []

    for event in date_filtered:

        if normalized_search:
            searchable = " ".join(
                str(
                    event.get(field) or ""
                )
                for field in [
                    "id",
                    "event",
                    "category",
                    "paymentId",
                    "description",
                    "details",
                    "status",
                ]
            ).lower()

            if normalized_search not in searchable:
                continue

        if (
            normalized_category != "all"
            and event["category"].lower()
            != normalized_category
        ):
            continue

        if (
            normalized_status != "all"
            and event["status"].lower()
            != normalized_status
        ):
            continue

        filtered.append(event)

    # -----------------------------------------------------
    # PAGINATION
    # -----------------------------------------------------

    try:
        page = max(
            int(page),
            1,
        )
    except (
        ValueError,
        TypeError,
    ):
        page = 1

    try:
        page_size = min(
            max(
                int(page_size),
                1,
            ),
            100,
        )
    except (
        ValueError,
        TypeError,
    ):
        page_size = 25

    total = len(filtered)

    total_pages = (
        (total + page_size - 1)
        // page_size
        if total
        else 1
    )

    if page > total_pages:
        page = total_pages

    start = (
        (page - 1)
        * page_size
    )

    end = start + page_size

    return {
        "events": filtered[start:end],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
        "summary": summary,
        "filters": {
            "search": search,
            "category": category,
            "status": status,
            "date_range": date_range,
        },
    }

# ---------------------------------------------------------
# JSON RESPONSE
# ---------------------------------------------------------

def json_response(
    handler,
    status_code,
    payload,
):
    body = json.dumps(
        payload
    ).encode("utf-8")

    handler.send_response(
        status_code
    )

    handler.send_header(
        "Content-Type",
        "application/json",
    )

    handler.send_header(
        "Content-Length",
        str(len(body)),
    )

    handler.send_header(
        "Access-Control-Allow-Origin",
        "http://localhost:5173",
    )

    handler.send_header(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS",
    )

    handler.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type",
    )

    handler.end_headers()

    handler.wfile.write(
        body
    )


# ---------------------------------------------------------
# API HANDLER
# ---------------------------------------------------------

class APIHandler(
    BaseHTTPRequestHandler
):

    def do_OPTIONS(self):

        self.send_response(204)

        self.send_header(
            "Access-Control-Allow-Origin",
            "http://localhost:5173",
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, OPTIONS",
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )

        self.end_headers()

    def do_GET(self):

        parsed_url = urlparse(
            self.path
        )

        path = parsed_url.path

        query = parse_qs(
            parsed_url.query
        )

        # -------------------------------------------------
        # HEALTH
        # -------------------------------------------------

        if path == "/health":

            json_response(
                self,
                200,
                {
                    "status": "ok",
                    "service":
                        "revenue-recovery-api",
                },
            )

            return

        # -------------------------------------------------
        # DASHBOARD
        # -------------------------------------------------

        if path == "/api/dashboard":

            try:

                json_response(
                    self,
                    200,
                    build_dashboard(),
                )

            except Exception as exc:

                json_response(
                    self,
                    500,
                    {
                        "error":
                            "dashboard_data_failed",

                        "message":
                            str(exc),
                    },
                )

            return

        # -------------------------------------------------
        # RECOVERY ACTIVITY
        # -------------------------------------------------

        if path == "/api/recovery-activity":

            try:

                json_response(
                    self,
                    200,
                    build_recovery_activity(),
                )

            except Exception as exc:

                json_response(
                    self,
                    500,
                    {
                        "error":
                            "recovery_activity_failed",

                        "message":
                            str(exc),
                    },
                )

            return

        # -------------------------------------------------
        # FAILED PAYMENTS
        # -------------------------------------------------

        if path == "/api/failed-payments":

            try:

                search = query.get(
                    "search",
                    [""],
                )[0]

                status = query.get(
                    "status",
                    ["all"],
                )[0]

                method = query.get(
                    "method",
                    ["all"],
                )[0]

                page = query.get(
                    "page",
                    ["1"],
                )[0]

                page_size = query.get(
                    "page_size",
                    ["25"],
                )[0]

                result = build_failed_payments(
                    search=search,
                    status=status,
                    method=method,
                    page=page,
                    page_size=page_size,
                )

                json_response(
                    self,
                    200,
                    result,
                )

            except Exception as exc:

                json_response(
                    self,
                    500,
                    {
                        "error":
                            "failed_payments_data_failed",

                        "message":
                            str(exc),
                    },
                )

            return

        # -------------------------------------------------
        # RECOVERY PERFORMANCE
        # -------------------------------------------------

        if path == "/api/recovery-performance":

            try:
                json_response(
                    self,
                    200,
                    build_recovery_performance(),
                )

            except Exception as exc:

                json_response(
                    self,
                    500,
                    {
                        "error":
                            "recovery_performance_failed",

                        "message":
                            str(exc),
                    },
                )

            return

        # -------------------------------------------------
        # AUDIT TRAIL
        # -------------------------------------------------

        if path == "/api/audit-trail":

            try:
                search = query.get(
                    "search",
                    [""],
                )[0]

                category = query.get(
                    "category",
                    ["all"],
                )[0]

                status = query.get(
                    "status",
                    ["all"],
                )[0]

                date_range = query.get(
                    "range",
                    ["30d"],
                )[0]

                page = query.get(
                    "page",
                    ["1"],
                )[0]

                page_size = query.get(
                    "page_size",
                    ["25"],
                )[0]

                result = build_audit_trail(
                    search=search,
                    category=category,
                    status=status,
                    date_range=date_range,
                    page=page,
                    page_size=page_size,
                )

                json_response(
                    self,
                    200,
                    result,
                )

            except Exception as exc:

                json_response(
                    self,
                    500,
                    {
                        "error":
                            "audit_trail_data_failed",
                        "message": str(exc),
                    },
                )

            return

        # -------------------------------------------------
        # PAYMENT DETAILS
        # -------------------------------------------------

        if path.startswith("/api/failed-payments/"):

            payment_id = path.split(
                "/api/failed-payments/",
                1,
            )[1]

            if not payment_id:
                json_response(
                    self,
                    400,
                    {
                        "error": "payment_id_required",
                    },
                )
                return

            try:
                details = build_payment_details(
                    payment_id
                )

                if details is None:
                    json_response(
                        self,
                        404,
                        {
                            "error": "payment_not_found",
                            "payment_id": payment_id,
                        },
                    )
                    return

                json_response(
                    self,
                    200,
                    details,
                )

            except Exception as exc:
                json_response(
                    self,
                    500,
                    {
                        "error": "payment_details_failed",
                        "message": str(exc),
                    },
                )

            return

            try:

                json_response(
                    self,
                    200,
                    build_recovery_performance(),
                )

            except Exception as exc:

                json_response(
                    self,
                    500,
                    {
                        "error":
                            "recovery_performance_failed",

                        "message":
                            str(exc),
                    },
                )

            return

            if path.startswith("/api/failed-payments/"):
                payment_id = path.split(
                "/api/failed-payments/",
                1,
            )[1]

            if not payment_id:
                json_response(
                    self,
                    400,
                    {
                        "error": "payment_id_required",
                    },
                )
                return

            try:
                details = build_payment_details(
                    payment_id
                )

                if details is None:
                    json_response(
                        self,
                        404,
                        {
                            "error": "payment_not_found",
                            "payment_id": payment_id,
                        },
                    )
                    return

                json_response(
                    self,
                    200,
                    details,
                )

            except Exception as exc:
                json_response(
                    self,
                    500,
                    {
                        "error": "payment_details_failed",
                        "message": str(exc),
                    },
                )

            return

        # -------------------------------------------------
        # NOT FOUND
        # -------------------------------------------------

        json_response(
            self,
            404,
            {
                "error": "not_found",
            },
        )

    def log_message(
        self,
        format,
        *args,
    ):
        return


# ---------------------------------------------------------
# SERVER
# ---------------------------------------------------------

def main():

    server = ThreadingHTTPServer(
        (
            HOST,
            PORT,
        ),
        APIHandler,
    )

    print("=" * 60)
    print("REVENUE RECOVERY API")
    print("=" * 60)

    print(
        f"Listening on: "
        f"http://{HOST}:{PORT}"
    )

    print(
        f"Dashboard API: "
        f"http://{HOST}:{PORT}"
        f"/api/dashboard"
    )

    print(
        "Activity API: "
        f"http://{HOST}:{PORT}"
        f"/api/recovery-activity"
    )

    print(
        "Failed Payments API: "
        f"http://{HOST}:{PORT}"
        f"/api/failed-payments"
    )

    print(
        "Recovery Performance API: "
        f"http://{HOST}:{PORT}"
        f"/api/recovery-performance"
    )

    print(
        "Audit Trail API: "
        f"http://{HOST}:{PORT}"
        f"/api/audit-trail"
    )

    print(
        "Press Ctrl+C to stop."
    )

    try:
        server.serve_forever()

    except KeyboardInterrupt:

        print(
            "\nStopping API server..."
        )

    finally:

        server.server_close()


if __name__ == "__main__":
    main()