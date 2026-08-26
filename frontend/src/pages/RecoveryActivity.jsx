import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";

import API_URL from "../api";

const PAGE_SIZE = 20;

const DATE_RANGES = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All available" },
];

const statusStyles = {
  Recovered: "bg-[#ecf9f1] text-[#16a34a]",
  Pending: "bg-[#fff7e8] text-[#d97706]",
  Failed: "bg-[#fff0f0] text-[#dc2626]",
  Stopped: "bg-[#f1f1f4] text-[#70707a]",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "—";

  const normalized = timestamp.includes("T")
    ? timestamp
    : timestamp.replace(" ", "T");

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RecoveryActivity() {
  const [activities, setActivities] = useState([]);

  const [summary, setSummary] = useState({
    total: 0,
    successful: 0,
    success_rate: 0,
    recovered_revenue: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    page_size: PAGE_SIZE,
    total: 0,
    total_pages: 1,
  });

  const [range, setRange] = useState("30d");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [range, search, statusFilter, actionFilter]);

  useEffect(() => {
    async function loadActivities() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        params.set("range", range);
        params.set("search", search);
        params.set("status", statusFilter);
        params.set("action", actionFilter);
        params.set("page", String(page));
        params.set("page_size", String(PAGE_SIZE));

        const response = await fetch(
          `${API_URL}/api/recovery-activity?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(
            `Request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        setActivities(data.activities || []);

        setSummary(
          data.summary || {
            total: 0,
            successful: 0,
            success_rate: 0,
            recovered_revenue: 0,
          }
        );

        setPagination(
          data.pagination || {
            page: 1,
            page_size: PAGE_SIZE,
            total: 0,
            total_pages: 1,
          }
        );
      } catch (err) {
        console.error("Recovery activity error:", err);
        setError(
          "Unable to load recovery activity. Make sure the backend API is running."
        );
        setActivities([]);
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, [
    range,
    search,
    statusFilter,
    actionFilter,
    page,
  ]);

  return (
    <div className="max-w-[1500px] p-4 sm:p-6 lg:p-[32px_34px_50px]">
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
              Track decisions and actions performed by the recovery engine.
            </p>
          </div>

          <div className="relative">
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="h-9 w-full appearance-none rounded-[7px] border border-[#e7e4ea] bg-white pl-3 pr-9 text-[11px] text-[#45454f] outline-none hover:bg-[#faf8fc] focus:border-[#b895d1] sm:w-[155px]"
              aria-label="Recovery activity date range"
            >
              {DATE_RANGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#85818c]"
            />
          </div>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Recovery attempts"
          value={summary.total.toLocaleString("en-IN")}
          icon={Activity}
          iconClass="bg-[#f2eafa] text-[#5f259f]"
        />

        <SummaryCard
          label="Successful"
          value={summary.successful.toLocaleString("en-IN")}
          icon={CheckCircle2}
          iconClass="bg-[#ecf9f1] text-[#16a34a]"
        />

        <SummaryCard
          label="Success rate"
          value={`${summary.success_rate}%`}
          icon={ShieldCheck}
          iconClass="bg-[#eaf7fb] text-[#087ea4]"
        />

        <SummaryCard
          label="Recovered revenue"
          value={formatCurrency(summary.recovered_revenue)}
          icon={WalletCards}
          iconClass="bg-[#f2eafa] text-[#5f259f]"
        />
      </section>

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
                Adaptive Recovery Engine V3 is operational.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium text-[#16a34a]">
            <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
            Live
          </div>
        </div>
      </section>

      <section className="mb-4 rounded-[11px] border border-[#e7e4ea] bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92909a]"
            />

            <input
              type="text"
              placeholder="Search payment ID, action or activity..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full rounded-[7px] border border-[#e7e4ea] bg-[#fcfbfd] pl-9 pr-3 text-[12px] outline-none placeholder:text-[#aaa7b0] focus:border-[#b895d1] focus:ring-2 focus:ring-[#5f259f]/10"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <FilterSelect
              icon={Filter}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                ["all", "All statuses"],
                ["success", "Recovered"],
                ["pending", "Pending"],
                ["failed", "Failed"],
                ["stopped", "Stopped"],
              ]}
            />

            <FilterSelect
              value={actionFilter}
              onChange={setActionFilter}
              options={[
                ["all", "All actions"],
                ["payment_link", "Payment Link"],
                ["retry", "Retry"],
                ["message", "Message"],
                ["escalate", "Merchant escalation"],
                ["stop", "Recovery stopped"],
              ]}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
        <div className="flex min-h-[68px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
          <div>
            <h2 className="text-[13px] font-semibold">
              Recovery attempts
            </h2>

            <p className="mt-1 text-[11px] text-[#6b6b75]">
              {pagination.total.toLocaleString("en-IN")} activity records
            </p>
          </div>

          <div className="hidden items-center gap-2 text-[10px] text-[#6b6b75] sm:flex">
            <span className="h-[6px] w-[6px] rounded-full bg-[#16a34a]" />
            Engine activity
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex items-center gap-2 text-[11px] text-[#6b6b75]">
              <Loader2
                size={17}
                className="animate-spin text-[#5f259f]"
              />
              Loading recovery activity...
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[300px] items-center justify-center px-6">
            <div className="text-center">
              <XCircle
                size={28}
                className="mx-auto mb-3 text-[#dc2626]"
              />

              <p className="text-[12px] font-semibold text-[#25232a]">
                Unable to load activity
              </p>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                {error}
              </p>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-[2fr_1.4fr_1fr_1fr_1fr_1fr_0.9fr] items-center gap-4 border-b border-[#e7e4ea] bg-[#fcfbfd] px-5 py-3 text-[10px] font-bold tracking-[0.7px] text-[#85818c]">
                  <span>PAYMENT</span>
                  <span>ACTION</span>
                  <span>PROBABILITY</span>
                  <span>AMOUNT</span>
                  <span>RECOVERED</span>
                  <span>TIME</span>
                  <span>STATUS</span>
                </div>

                {activities.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#e7e4ea] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="text-[9px] text-[#85818c]">
                Showing{" "}
                <span className="font-semibold text-[#45454f]">
                  {pagination.total === 0
                    ? 0
                    : (pagination.page - 1) *
                        pagination.page_size +
                      1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-[#45454f]">
                  {Math.min(
                    pagination.page * pagination.page_size,
                    pagination.total
                  )}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[#45454f]">
                  {pagination.total.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={pagination.page === 1}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#e7e4ea] bg-white text-[#6b6b75] disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#faf8fc]"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="px-2 text-[9px] text-[#6b6b75]">
                  Page {pagination.page} of {pagination.total_pages}
                </span>

                <button
                  disabled={
                    pagination.page === pagination.total_pages
                  }
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        pagination.total_pages,
                        current + 1
                      )
                    )
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#e7e4ea] bg-white text-[#6b6b75] disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#faf8fc]"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

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
        onChange={(event) => onChange(event.target.value)}
        className={`h-9 w-full appearance-none rounded-[7px] border border-[#e7e4ea] bg-white pr-8 text-[11px] text-[#45454f] outline-none focus:border-[#b895d1] sm:w-[165px] ${
          Icon ? "pl-8" : "pl-3"
        }`}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
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

function ActivityRow({ activity }) {
  const probability = Number(activity.probability ?? 59);
  const amount = Number(activity.amount || 0);
  const recovered =
    activity.status_key === "success" ? amount : 0;

  return (
    <div className="grid min-h-[82px] grid-cols-[2fr_1.4fr_1fr_1fr_1fr_1fr_0.9fr] items-center gap-4 border-b border-[#f0edf2] px-5 py-3 text-[11px] last:border-b-0 hover:bg-[#fcfbfd]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#f3eef7] text-[#5f259f]">
            <WalletCards size={14} />
          </div>

          <div className="min-w-0">
            <div className="truncate font-mono text-[11px] font-semibold text-[#45454f]">
              {activity.payment_id}
            </div>

            <div className="mt-1 truncate text-[10px] text-[#92909a]">
              Attempt #{activity.attempt_number ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ActionIcon action={activity.action_key} />

        <span className="text-[11px] font-medium text-[#5f259f]">
          {activity.action}
        </span>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold text-[#5f259f]">
          {probability.toFixed(1)}%
        </div>

        <div className="h-1.5 w-full rounded-full bg-[#eeeaf1]">
          <div
            className="h-full rounded-full bg-[#5f259f]"
            style={{
              width: `${Math.min(100, Math.max(0, probability))}%`,
            }}
          />
        </div>
      </div>

      <strong className="text-[11px]">
        {formatCurrency(amount)}
      </strong>

      <div>
        {recovered > 0 ? (
          <span className="font-semibold text-[#16a34a]">
            {formatCurrency(recovered)}
          </span>
        ) : (
          <span className="text-[#92909a]">—</span>
        )}
      </div>

      <div>
        <div className="flex items-center gap-1 text-[10px] text-[#45454f]">
          <Clock3 size={10} />
          {formatTimestamp(activity.timestamp)}
        </div>
      </div>

      <span
        className={`inline-flex w-fit items-center rounded-[5px] px-2 py-1 text-[10px] font-bold ${
          statusStyles[activity.status] ||
          "bg-[#f5f3f6] text-[#70707a]"
        }`}
      >
        {activity.status}
      </span>
    </div>
  );
}

function ActionIcon({ action }) {
  if (action === "retry") {
    return (
      <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#eaf7fb] text-[#087ea4]">
        <RotateCcw size={13} />
      </div>
    );
  }

  if (action === "stop") {
    return (
      <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#f1f1f4] text-[#70707a]">
        <XCircle size={13} />
      </div>
    );
  }

  if (action === "escalate") {
    return (
      <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#fff7e8] text-[#d97706]">
        <ShieldCheck size={13} />
      </div>
    );
  }

  return (
    <div className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#f2eafa] text-[#5f259f]">
      <WalletCards size={13} />
    </div>
  );
}

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
        Try changing your date range, search or filter criteria.
      </p>
    </div>
  );
}

export default RecoveryActivity;
