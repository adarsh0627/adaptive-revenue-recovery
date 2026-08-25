import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";

import API_BASE_URL from "../api";

function RecoveryActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");

  // ---------------------------------------------------------
  // LOAD RECOVERY ACTIVITY
  // ---------------------------------------------------------

  useEffect(() => {
    async function loadActivities() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE_URL}/api/recovery-activity`,
        );

        if (!response.ok) {
          throw new Error(
            `Request failed with status ${response.status}`,
          );
        }

        const data = await response.json();

        setActivities(
          Array.isArray(data.activities)
            ? data.activities
            : [],
        );
      } catch (err) {
        console.error(
          "Recovery activity error:",
          err,
        );

        setError(
          "Unable to load recovery activity.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, []);

  // ---------------------------------------------------------
  // FILTER ACTIVITIES
  // ---------------------------------------------------------

  const filteredActivities = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return activities.filter((activity) => {
      const paymentId =
        activity.payment_id ||
        activity.paymentId ||
        activity.id ||
        "";

      const action =
        activity.action ||
        "";

      const description =
        activity.description ||
        "";

      const status =
        activity.status ||
        "";

      const matchesSearch =
        !searchValue ||
        paymentId
          .toLowerCase()
          .includes(searchValue) ||
        action
          .toLowerCase()
          .includes(searchValue) ||
        description
          .toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        statusFilter === "All" ||
        status === statusFilter;

      const matchesAction =
        actionFilter === "All" ||
        action === actionFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesAction
      );
    });
  }, [
    activities,
    search,
    statusFilter,
    actionFilter,
  ]);

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------

  const successful = activities.filter(
    (activity) =>
      normalizeStatus(activity.status) ===
      "Recovered",
  ).length;

  const totalRecovered = activities.reduce(
    (total, activity) => {
      const recoveredAmount =
        activity.recovered_amount ??
        activity.recovered ??
        (
          normalizeStatus(activity.status) ===
          "Recovered"
            ? activity.amount
            : 0
        ) ??
        0;

      return (
        total +
        Number(recoveredAmount || 0)
      );
    },
    0,
  );

  const successRate = activities.length
    ? Math.round(
        (successful / activities.length) *
          100,
      )
    : 0;

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className="max-w-[1500px] p-4 sm:p-6 lg:p-[32px_34px_50px]">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <section className="mb-6">
        <p className="mb-2 text-[9px] font-extrabold tracking-[1.5px] text-[#5f259f]">
          RECOVERY ENGINE
        </p>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.7px] sm:text-[25px]">
              Recovery Activity
            </h1>

            <p className="mt-2 text-[12px] text-[#6b6b75] sm:text-[13px]">
              Track decisions and actions performed
              by the recovery engine.
            </p>
          </div>

          <button className="flex h-9 w-fit items-center gap-2 rounded-[7px] border border-[#e7e4ea] bg-white px-3 text-[12px] text-[#45454f] hover:bg-[#faf8fc]">
            Last 30 days
            <ChevronDown size={15} />
          </button>
        </div>
      </section>

      {/* =====================================================
          SUMMARY
      ====================================================== */}

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Recovery attempts"
          value={activities.length}
          icon={Activity}
          iconClass="bg-[#f2eafa] text-[#5f259f]"
        />

        <SummaryCard
          label="Successful"
          value={successful}
          icon={CheckCircle2}
          iconClass="bg-[#ecf9f1] text-[#16a34a]"
        />

        <SummaryCard
          label="Success rate"
          value={`${successRate}%`}
          icon={ShieldCheck}
          iconClass="bg-[#eaf7fb] text-[#087ea4]"
        />

        <SummaryCard
          label="Recovered revenue"
          value={`₹${totalRecovered.toLocaleString(
            "en-IN",
          )}`}
          icon={WalletCards}
          iconClass="bg-[#f2eafa] text-[#5f259f]"
        />
      </section>

      {/* =====================================================
          ENGINE STATUS
      ====================================================== */}

      <section className="mb-5 rounded-[11px] border border-[#e7e4ea] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[9px] bg-[#f2eafa] text-[#5f259f]">
              <Activity size={19} />
            </div>

            <div>
              <h2 className="text-[13px] font-semibold">
                Recovery engine
              </h2>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                Adaptive Recovery Engine V3 is
                operational.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium text-[#16a34a]">
            <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
            Live
          </div>
        </div>
      </section>

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <section className="mb-4 rounded-[11px] border border-[#e7e4ea] bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          {/* Search */}

          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92909a]"
            />

            <input
              type="text"
              placeholder="Search payment ID, action or activity..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="h-9 w-full rounded-[7px] border border-[#e7e4ea] bg-[#fcfbfd] pl-9 pr-3 text-[12px] outline-none placeholder:text-[#aaa7b0] focus:border-[#b895d1] focus:ring-2 focus:ring-[#5f259f]/10"
            />
          </div>

          {/* Filters */}

          <div className="flex flex-col gap-2 sm:flex-row">
            <FilterSelect
              icon={Filter}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                "All",
                "Recovered",
                "Pending",
                "Failed",
                "Stopped",
              ]}
            />

            <FilterSelect
              value={actionFilter}
              onChange={setActionFilter}
              options={[
                "All",
                ...getUniqueActions(activities),
              ]}
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          ACTIVITY TABLE
      ====================================================== */}

      <section className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
        {/* Table heading */}

        <div className="flex min-h-[68px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
          <div>
            <h2 className="text-[13px] font-semibold">
              Recovery attempts
            </h2>

            <p className="mt-1 text-[11px] text-[#6b6b75]">
              {filteredActivities.length} activity
              {filteredActivities.length !== 1
                ? " records"
                : " record"}
            </p>
          </div>

          <div className="hidden items-center gap-2 text-[10px] text-[#6b6b75] sm:flex">
            <span className="h-[6px] w-[6px] rounded-full bg-[#16a34a]" />
            Engine activity
          </div>
        </div>

        {/* Loading */}

        {loading && (
          <LoadingState />
        )}

        {/* Error */}

        {!loading && error && (
          <ErrorState message={error} />
        )}

        {/* Empty */}

        {!loading &&
          !error &&
          filteredActivities.length === 0 && (
            <EmptyState />
          )}

        {/* Data */}

        {!loading &&
          !error &&
          filteredActivities.length > 0 && (
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                {/* Header */}

                <div className="grid grid-cols-[2fr_1.4fr_1fr_1fr_1fr_1fr_0.9fr] items-center gap-4 border-b border-[#e7e4ea] bg-[#fcfbfd] px-5 py-3 text-[10px] font-bold tracking-[0.7px] text-[#85818c]">
                  <span>PAYMENT</span>
                  <span>ACTION</span>
                  <span>PROBABILITY</span>
                  <span>AMOUNT</span>
                  <span>RECOVERED</span>
                  <span>TIME</span>
                  <span>STATUS</span>
                </div>

                {/* Rows */}

                {filteredActivities.map(
                  (activity, index) => (
                    <ActivityRow
                      key={
                        getPaymentId(
                          activity,
                        ) ||
                        `${index}-${activity.timestamp}`
                      }
                      activity={activity}
                    />
                  ),
                )}
              </div>
            </div>
          )}
      </section>
    </div>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconClass,
}) {
  return (
    <div className="rounded-[11px] border border-[#e7e4ea] bg-white p-4">
      <div className="flex items-start justify-between">
        <span className="text-[11px] text-[#6b6b75]">
          {label}
        </span>

        <div
          className={`grid h-8 w-8 place-items-center rounded-[8px] ${iconClass}`}
        >
          <Icon size={16} />
        </div>
      </div>

      <div className="mt-4 text-[22px] font-bold tracking-[-0.6px]">
        {value}
      </div>
    </div>
  );
}

// ============================================================
// FILTER SELECT
// ============================================================

function FilterSelect({
  icon: Icon,
  value,
  onChange,
  options,
}) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#85818c]"
        />
      )}

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={`h-9 w-full appearance-none rounded-[7px] border border-[#e7e4ea] bg-white pr-8 text-[11px] text-[#45454f] outline-none focus:border-[#b895d1] sm:w-[165px] ${
          Icon ? "pl-8" : "pl-3"
        }`}
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>

      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#85818c]"
      />
    </div>
  );
}

// ============================================================
// ACTIVITY ROW
// ============================================================

function ActivityRow({ activity }) {
  const paymentId =
    activity.payment_id ||
    activity.paymentId ||
    activity.id ||
    "Unknown";

  const action =
    activity.action ||
    "Unknown";

  const amount = Number(
    activity.amount || 0,
  );

  const recoveredAmount = Number(
    activity.recovered_amount ??
      activity.recovered ??
      (
        normalizeStatus(
          activity.status,
        ) === "Recovered"
          ? amount
          : 0
      ),
  );

  const probability =
    activity.probability ??
    activity.recovery_probability ??
    activity.avg_recovery_probability ??
    null;

  const status =
    activity.status ||
    "Unknown";

  const attemptNumber =
    activity.attempt_number ||
    activity.attemptNumber ||
    1;

  return (
    <div className="grid min-h-[82px] grid-cols-[2fr_1.4fr_1fr_1fr_1fr_1fr_0.9fr] items-center gap-4 border-b border-[#f0edf2] px-5 py-3 text-[11px] last:border-b-0 hover:bg-[#fcfbfd]">
      {/* Payment */}

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#f3eef7] text-[#5f259f]">
            <WalletCards size={14} />
          </div>

          <div className="min-w-0">
            <div className="truncate font-mono text-[11px] font-semibold text-[#45454f]">
              {paymentId}
            </div>

            <div className="mt-1 truncate text-[10px] text-[#92909a]">
              Recovery attempt #
              {attemptNumber}
            </div>
          </div>
        </div>
      </div>

      {/* Action */}

      <div className="flex items-center gap-2">
        <ActionIcon action={action} />

        <span className="text-[11px] font-medium text-[#5f259f]">
          {action}
        </span>
      </div>

      {/* Probability */}

      <div>
        {probability !== null &&
        probability !== undefined ? (
          <>
            <div className="mb-1.5 text-[11px] font-semibold text-[#5f259f]">
              {Number(probability).toFixed(
                1,
              )}
              %
            </div>

            <div className="h-1.5 w-full rounded-full bg-[#eeeaf1]">
              <div
                className="h-full rounded-full bg-[#5f259f]"
                style={{
                  width: `${Math.min(
                    Math.max(
                      Number(probability),
                      0,
                    ),
                    100,
                  )}%`,
                }}
              />
            </div>
          </>
        ) : (
          <span className="text-[11px] text-[#92909a]">
            —
          </span>
        )}
      </div>

      {/* Amount */}

      <strong className="text-[11px]">
        ₹
        {amount.toLocaleString(
          "en-IN",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )}
      </strong>

      {/* Recovered */}

      <div>
        {recoveredAmount > 0 ? (
          <span className="font-semibold text-[#16a34a]">
            ₹
            {recoveredAmount.toLocaleString(
              "en-IN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}
          </span>
        ) : (
          <span className="text-[#92909a]">
            —
          </span>
        )}
      </div>

      {/* Time */}

      <div>
        <div className="text-[10px] text-[#45454f]">
          {formatTimestamp(
            activity.timestamp,
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 text-[9px] text-[#92909a]">
          <Clock3 size={10} />
          Attempt #{attemptNumber}
        </div>
      </div>

      {/* Status */}

      <span
        className={`inline-flex w-fit items-center rounded-[5px] px-2 py-1 text-[10px] font-bold ${getStatusStyle(
          status,
        )}`}
      >
        {status}
      </span>
    </div>
  );
}

// ============================================================
// ACTION ICON
// ============================================================

function ActionIcon({ action }) {
  const normalizedAction =
    String(action || "")
      .trim()
      .toLowerCase();

  if (
    normalizedAction ===
      "retry" ||
    normalizedAction.includes(
      "retry",
    )
  ) {
    return (
      <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#eaf7fb] text-[#087ea4]">
        <RotateCcw size={13} />
      </div>
    );
  }

  if (
    normalizedAction.includes(
      "stop",
    )
  ) {
    return (
      <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#f1f1f4] text-[#70707a]">
        <XCircle size={13} />
      </div>
    );
  }

  if (
    normalizedAction.includes(
      "escalat",
    )
  ) {
    return (
      <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#fff7e8] text-[#d97706]">
        <ShieldCheck size={13} />
      </div>
    );
  }

  if (
    normalizedAction.includes(
      "message",
    )
  ) {
    return (
      <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#eaf7fb] text-[#087ea4]">
        <Activity size={13} />
      </div>
    );
  }

  return (
    <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#f2eafa] text-[#5f259f]">
      <WalletCards size={13} />
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getPaymentId(activity) {
  return (
    activity?.payment_id ||
    activity?.paymentId ||
    activity?.id ||
    ""
  );
}

function normalizeStatus(status) {
  const value = String(
    status || "",
  )
    .trim()
    .toLowerCase();

  if (
    value === "success" ||
    value === "recovered"
  ) {
    return "Recovered";
  }

  if (
    value === "pending" ||
    value === "processing"
  ) {
    return "Pending";
  }

  if (
    value === "failed" ||
    value === "failure"
  ) {
    return "Failed";
  }

  if (
    value === "stopped" ||
    value === "stop recovery"
  ) {
    return "Stopped";
  }

  return status || "Unknown";
}

function getStatusStyle(status) {
  const normalized =
    normalizeStatus(status);

  const styles = {
    Recovered:
      "bg-[#ecf9f1] text-[#16a34a]",

    Pending:
      "bg-[#fff7e8] text-[#d97706]",

    Failed:
      "bg-[#fff0f0] text-[#dc2626]",

    Stopped:
      "bg-[#f1f1f4] text-[#70707a]",

    Unknown:
      "bg-[#f1f1f4] text-[#70707a]",
  };

  return (
    styles[normalized] ||
    styles.Unknown
  );
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "Unknown time";
  }

  const date = new Date(
    timestamp,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(timestamp);
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

function getUniqueActions(
  activities,
) {
  const actions = activities
    .map(
      (activity) =>
        activity.action,
    )
    .filter(Boolean);

  return [
    ...new Set(actions),
  ];
}

// ============================================================
// LOADING STATE
// ============================================================

function LoadingState() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e7e4ea] border-t-[#5f259f]" />

      <h3 className="mt-4 text-[12px] font-semibold">
        Loading recovery activity
      </h3>

      <p className="mt-1 max-w-[300px] text-[11px] text-[#6b6b75]">
        Fetching the latest recovery
        engine activity.
      </p>
    </div>
  );
}

// ============================================================
// ERROR STATE
// ============================================================

function ErrorState({
  message,
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#fff0f0] text-[#dc2626]">
        <XCircle size={20} />
      </div>

      <h3 className="mt-3 text-[12px] font-semibold">
        Unable to load activity
      </h3>

      <p className="mt-1 max-w-[350px] text-[11px] text-[#6b6b75]">
        {message}
      </p>

      <p className="mt-2 text-[10px] text-[#92909a]">
        Make sure the recovery API is
        running on port 8001.
      </p>
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f3eef7] text-[#5f259f]">
        <XCircle size={20} />
      </div>

      <h3 className="mt-3 text-[12px] font-semibold">
        No activity found
      </h3>

      <p className="mt-1 max-w-[300px] text-[11px] text-[#6b6b75]">
        Try changing your search or
        filter criteria.
      </p>
    </div>
  );
}

export default RecoveryActivity;