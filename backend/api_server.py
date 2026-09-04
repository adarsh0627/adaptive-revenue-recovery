import csv
import json
import os
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from config import API_HOST, API_PORT, CORS_ORIGIN


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

PAYMENTS_FILE = DATA_DIR / "payments_v3.csv"
LIVE_STATE_FILE = DATA_DIR / "live_recovery_attempts.json"
RECOVERY_ATTEMPTS_FILE = DATA_DIR / "recovery_attempts_v3.csv"
GUARDRAILS_FILE = DATA_DIR / "adaptive_engine_v2_guardrails.csv"

HOST = API_HOST
PORT = API_PORT

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


LIVE_STATE_URL = os.getenv("LIVE_STATE_URL", "").strip().rstrip("/")
LIVE_STATE_API_TOKEN = os.getenv("LIVE_STATE_API_TOKEN", "").strip()

def load_live_state():
    """Load live recovery state from the webhook service in production.

    The API and webhook services run as separate Render services, so they
    cannot share a local JSON file. In local development, or when the remote
    URL is not configured, fall back to the local file.
    """
    if LIVE_STATE_URL:
        try:
            headers = {"Accept": "application/json"}
            if LIVE_STATE_API_TOKEN:
                headers["X-Internal-Token"] = LIVE_STATE_API_TOKEN
            request = Request(
                f"{LIVE_STATE_URL}/api/live-state",
                headers=headers,
                method="GET",
            )
            with urlopen(request, timeout=3) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if isinstance(payload, dict) and isinstance(payload.get("live_state"), dict):
                return payload["live_state"]
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError):
            pass
        return {}

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
    Estimate recovery probability based on the payment failure reason.

    Higher probabilities are assigned to transient failures that are more
    likely to succeed on retry. Lower probabilities indicate failures that
    usually require customer intervention or a different payment method.
    """

    probabilities = {
        "network_error": 82.0,
        "bank_timeout": 76.0,
        "insufficient_balance": 54.0,
        "limit_exceeded": 41.0,
        "card_declined": 32.0,
        "expired_card": 18.0,
    }

    return probabilities.get(
        str(failure_reason or "").strip().lower(),
        50.0,
    )


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
# DATE RANGE HELPERS
# ---------------------------------------------------------

DATE_RANGE_DELTAS = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
}

def normalize_date_range(value, default="30d"):
    value = str(value or default).strip().lower()
    aliases = {"24": "24h", "1d": "24h", "7": "7d", "30": "30d", "90": "90d"}
    value = aliases.get(value, value)
    return value if value in DATE_RANGE_DELTAS or value == "all" else default

def get_date_cutoff(date_range, now=None):
    date_range = normalize_date_range(date_range)
    if date_range == "all":
        return None
    return (now or datetime.now(timezone.utc)) - DATE_RANGE_DELTAS[date_range]

def in_date_range(timestamp, date_range, now=None):
    cutoff = get_date_cutoff(date_range, now)
    return cutoff is None or parse_timestamp(timestamp) >= cutoff

# ---------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------

def build_dashboard(date_range="30d"):
    date_range = normalize_date_range(date_range)
    historical = [p for p in load_payments() if in_date_range(p.get("timestamp"), date_range)]
    live_state = load_live_state()
    live_filtered = {}
    for payment_id, attempts in live_state.items():
        if not attempts:
            continue
        latest = max(attempts, key=lambda a: parse_timestamp(a.get("timestamp")))
        if in_date_range(latest.get("timestamp"), date_range):
            live_filtered[payment_id] = attempts

    historical_failed = len(historical)
    historical_recovered = sum(1 for p in historical if str(p.get("recovered", "")).lower() == "true")
    historical_revenue = sum(float(p.get("amount") or 0) for p in historical if str(p.get("recovered", "")).lower() == "true")

    historical_probabilities = [
        calculate_probability(p.get("failure_reason", "unknown"))
        for p in historical
    ]

    live_failed = len(live_filtered)
    live_recovered = 0
    live_pending = 0
    live_revenue = 0.0
    for attempts in live_filtered.values():
        last = max(attempts, key=lambda a: parse_timestamp(a.get("timestamp")))
        result = last.get("result")
        if result == "success":
            live_recovered += 1
            live_revenue += float(last.get("recovered_amount") or 0)
        elif result == "pending":
            live_pending += 1

    all_probabilities = historical_probabilities

    avg_recovery_probability = (
        sum(all_probabilities) / len(all_probabilities)
        if all_probabilities else 0
    )

    total_failed = historical_failed + live_failed
    total_recovered = historical_recovered + live_recovered
    recovered_revenue = historical_revenue + live_revenue
    recovery_rate = (total_recovered / total_failed) * 100 if total_failed else 0
    return {
        "failed_payments": total_failed,
        "recovered_payments": total_recovered,
        "pending_recovery": live_pending,
        "recovered_revenue": round(recovered_revenue, 2),
        "recovery_rate": round(recovery_rate, 1),
        "avg_recovery_probability": round(avg_recovery_probability, 1),
        "source": {"historical_payments": historical_failed, "live_payments": live_failed},
        "filters": {"date_range": date_range},
    }


def build_recovery_activity(search="", status="all", action="all", date_range="30d", page=1, page_size=25):
    date_range = normalize_date_range(date_range)

    payment_lookup = {
        payment.get("payment_id"): payment
        for payment in load_payments()
        if payment.get("payment_id")
    }

    historical_attempts = []
    if RECOVERY_ATTEMPTS_FILE.exists():
        with RECOVERY_ATTEMPTS_FILE.open("r", encoding="utf-8", newline="") as file:
            for attempt in csv.DictReader(file):
                payment_id = attempt.get("payment_id", "")
                payment = payment_lookup.get(payment_id, {})

                action_key = attempt.get("action", "unknown")
                result = attempt.get("result", "unknown")

                failure_reason = payment.get("failure_reason", "unknown")
                probability = calculate_probability(failure_reason)
                try: amount = float(attempt.get("recovered_amount", 0) or 0)
                except (ValueError, TypeError): amount = 0.0
                try: attempt_number = int(attempt.get("attempt_number", 1) or 1)
                except (ValueError, TypeError): attempt_number = 1
                historical_attempts.append({
                    "id": attempt.get("attempt_id") or f"{payment_id}-ATTEMPT-{attempt_number}",
                    "payment_id": payment_id,
                    "action": format_action(action_key),
                    "action_key": action_key,
                    "amount": amount,
                    "probability": probability,
                    "status": format_status(result),
                    "status_key": result,
                    "timestamp": attempt.get("timestamp"),
                    "attempt_number": attempt_number,
                    "source": "historical",
                })
    live_activities = []
    for payment_id, attempts in load_live_state().items():
        payment = payment_lookup.get(payment_id, {})

        for attempt in attempts or []:
            result = attempt.get("result", "unknown")
            action_key = attempt.get("action", "unknown")

            failure_reason = payment.get("failure_reason", "unknown")
            probability = calculate_probability(failure_reason)
            try: amount = float(attempt.get("recovered_amount") or 0)
            except (ValueError, TypeError): amount = 0.0
            live_activities.append({
                "id": f"{payment_id}-LIVE-ATTEMPT-{attempt.get('attempt_number', 1)}", "payment_id": payment_id,
                "action": format_action(action_key), "action_key": action_key, "amount": amount,
                "probability": probability,"status": format_status(result), "status_key": result, "timestamp": attempt.get("timestamp"),
                "attempt_number": attempt.get("attempt_number"), "source": "live",
            })
    live_payment_ids = {x["payment_id"] for x in live_activities if x.get("payment_id")}
    activities = [x for x in historical_attempts if x.get("payment_id") not in live_payment_ids] + live_activities
    activities.sort(key=lambda x: parse_timestamp(x.get("timestamp")), reverse=True)
    date_filtered = [x for x in activities if in_date_range(x.get("timestamp"), date_range)]

    q = str(search or "").strip().lower(); st = str(status or "all").strip().lower(); act = str(action or "all").strip().lower()
    filtered = []
    for item in date_filtered:
        if q:
            searchable = " ".join(str(item.get(f) or "") for f in ["id","payment_id","action","action_key","status","status_key","source"]).lower()
            if q not in searchable: continue
        if st != "all" and str(item.get("status_key", "")).lower() != st: continue
        if act != "all" and str(item.get("action_key", "")).lower() != act: continue
        filtered.append(item)

    successful = sum(1 for x in filtered if x.get("status_key") == "success")
    recovered_revenue = sum(float(x.get("amount") or 0) for x in filtered if x.get("status_key") == "success")
    total = len(filtered)
    try: page = max(int(page), 1)
    except (ValueError, TypeError): page = 1
    try: page_size = min(max(int(page_size), 1), 100)
    except (ValueError, TypeError): page_size = 25
    total_pages = ((total + page_size - 1) // page_size) if total else 1
    page = min(page, total_pages); start = (page - 1) * page_size
    return {
        "activities": filtered[start:start + page_size],
        "summary": {"total": total, "successful": successful, "success_rate": round((successful / total) * 100, 1) if total else 0, "recovered_revenue": round(recovered_revenue, 2)},
        "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages},
        "filters": {"search": search, "status": status, "action": action, "date_range": date_range},
    }


def build_failed_payments(search="", status="all", method="all", date_range="30d", page=1, page_size=25):
    date_range = normalize_date_range(date_range)
    records = []
    for payment in load_payments():
        recovered = str(payment.get("recovered", "")).lower() == "true"
        action = payment.get("initial_action", "unknown")
        failure_reason = payment.get("failure_reason", "unknown")
        records.append({
            "payment_id": payment.get("payment_id", ""), "customer_id": payment.get("customer_id"),
            "amount": float(payment.get("amount") or 0), "payment_method": payment.get("payment_method", "Unknown"),
            "failure_reason": failure_reason, "timestamp": payment.get("timestamp"),
            "probability": calculate_probability(failure_reason), "action": format_action(action), "action_key": action,
            "status": "Recovered" if recovered else "Failed", "status_key": "success" if recovered else "failed", "source": "historical",
        })
    for payment_id, attempts in load_live_state().items():
        if not attempts: continue
        last = max(attempts, key=lambda a: parse_timestamp(a.get("timestamp"))); result = last.get("result", "pending"); action = last.get("action", "unknown")
        records.append({
            "payment_id": payment_id, "customer_id": None, "amount": float(last.get("recovered_amount") or 0), "payment_method": "Wallet",
            "failure_reason": "network_error", "timestamp": last.get("timestamp"), "probability": 59.0,
            "action": format_action(action), "action_key": action, "status": format_status(result), "status_key": result, "source": "live",
        })
    records.sort(key=lambda x: parse_timestamp(x.get("timestamp")), reverse=True)
    q = str(search or "").strip().lower(); st = str(status or "all").strip().lower(); method = str(method or "all").strip().lower()
    filtered = []
    for record in records:
        if not in_date_range(record.get("timestamp"), date_range): continue
        if q:
            searchable = " ".join(str(record.get(f) or "") for f in ["payment_id","customer_id","payment_method","failure_reason","action","status"]).lower()
            if q not in searchable: continue
        if st != "all" and str(record.get("status", "")).lower() != st: continue
        if method != "all" and str(record.get("payment_method", "")).lower() != method: continue
        filtered.append(record)
    total = len(filtered); recovered = sum(1 for x in filtered if x.get("status_key") == "success"); failed = sum(1 for x in filtered if x.get("status_key") == "failed"); pending = sum(1 for x in filtered if x.get("status_key") == "pending")
    try: page = max(int(page), 1)
    except (ValueError, TypeError): page = 1
    try: page_size = min(max(int(page_size), 1), 100)
    except (ValueError, TypeError): page_size = 25
    total_pages = ((total + page_size - 1) // page_size) if total else 1; page = min(page, total_pages); start = (page - 1) * page_size
    return {
        "payments": filtered[start:start + page_size],
        "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages},
        "summary": {"total": total, "failed": failed, "recovered": recovered, "pending": pending, "recovery_rate": round((recovered / total) * 100, 1) if total else 0},
        "filters": {"search": search, "status": status, "method": method, "date_range": date_range},
    }


def build_recovery_performance():
    """
    Build recovery-rate performance data.

    Includes:
    - Historical payment records
    - Live recovery records

    Groups records by month and calculates:

        recovered payments / total payments * 100
    """

    payments = load_payments()
    live_state = load_live_state()

    monthly = {}

    total = 0
    recovered_total = 0

    # -------------------------------------------------
    # HISTORICAL PAYMENTS
    # -------------------------------------------------

    for payment in payments:
        timestamp = str(payment.get("timestamp") or "")

        if not timestamp:
            continue

        month_key = timestamp[:7]

        if len(month_key) != 7:
            continue

        if month_key not in monthly:
            monthly[month_key] = {
                "total": 0,
                "recovered": 0,
            }

        monthly[month_key]["total"] += 1
        total += 1

        recovered = str(
            payment.get("recovered", "")
        ).lower()

        if recovered in ("true", "1", "yes"):
            monthly[month_key]["recovered"] += 1
            recovered_total += 1

    # -------------------------------------------------
    # LIVE RECOVERY RECORDS
    # -------------------------------------------------

    for payment_id, attempts in live_state.items():

        if not attempts:
            continue

        # One payment should count only once.
        total += 1

        latest_attempt = attempts[-1]

        timestamp = str(
            latest_attempt.get("timestamp")
            or latest_attempt.get("created_at")
            or ""
        )

        month_key = timestamp[:7]

        if len(month_key) == 7:

            if month_key not in monthly:
                monthly[month_key] = {
                    "total": 0,
                    "recovered": 0,
                }

            monthly[month_key]["total"] += 1

        result = str(
            latest_attempt.get("result")
            or latest_attempt.get("status")
            or ""
        ).lower()

        is_recovered = result in (
            "success",
            "recovered",
            "completed",
        )

        if is_recovered:
            recovered_total += 1

            if len(month_key) == 7:
                monthly[month_key]["recovered"] += 1

    # -------------------------------------------------
    # SORT MONTHS
    # -------------------------------------------------

    sorted_months = sorted(monthly.items())

    labels = []
    values = []
    buckets = []

    month_names = [
        "Jan", "Feb", "Mar", "Apr",
        "May", "Jun", "Jul", "Aug",
        "Sep", "Oct", "Nov", "Dec",
    ]

    for month_key, data in sorted_months:

        bucket_total = data["total"]
        bucket_recovered = data["recovered"]

        recovery_rate = (
            (bucket_recovered / bucket_total) * 100
            if bucket_total > 0
            else 0
        )

        try:
            _, month = month_key.split("-")
            label = month_names[int(month) - 1]
        except Exception:
            label = month_key

        value = round(recovery_rate, 1)

        labels.append(label)
        values.append(value)

        buckets.append({
            "label": label,
            "total": bucket_total,
            "recovered": bucket_recovered,
            "value": value,
        })

    # -------------------------------------------------
    # FINAL RESULT
    # -------------------------------------------------

    return {
        "total": total,
        "recovered": recovered_total,
        "labels": labels,
        "values": values,
        "buckets": buckets,
    }

def build_audit_trail(
    search="",
    category="all",
    status="all",
    date_range="30d",
    page=1,
    page_size=25,
):
    date_range = normalize_date_range(date_range)
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

    date_range = normalize_date_range(date_range)
    date_filtered = [
        event for event in events
        if in_date_range(event.get("timestamp"), date_range)
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
        CORS_ORIGIN,
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
            CORS_ORIGIN,
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

                date_range = query.get("range", ["30d"])[0]
                json_response(
                    self,
                    200,
                    build_dashboard(date_range=date_range),
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
                search = query.get("search", [""])[0]
                status = query.get("status", ["all"])[0]
                action = query.get("action", ["all"])[0]
                date_range = query.get("range", ["30d"])[0]
                page = query.get("page", ["1"])[0]
                page_size = query.get("page_size", ["25"])[0]

                result = build_recovery_activity(
                    search=search,
                    status=status,
                    action=action,
                    date_range=date_range,
                    page=page,
                    page_size=page_size,
                )

                json_response(self, 200, result)

            except Exception as exc:
                json_response(
                    self,
                    500,
                    {
                        "error": "recovery_activity_failed",
                        "message": str(exc),
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

                date_range = query.get("range", ["30d"])[0]

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