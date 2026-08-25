import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Filter,
  Search,
  ShieldCheck,
  Webhook,
  XCircle,
} from "lucide-react";

import API_BASE from "../api";
const PAGE_SIZE = 25;

const statusStyles = {
  Success: "bg-[#ecf9f1] text-[#16a34a]",
  Approved: "bg-[#ecf9f1] text-[#16a34a]",
  Verified: "bg-[#eaf7fb] text-[#087ea4]",
  Decision: "bg-[#f2eafa] text-[#5f259f]",
  Pending: "bg-[#fff7e8] text-[#d97706]",
  Blocked: "bg-[#fff0f0] text-[#dc2626]",
};

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "All time", value: "all" },
];

function AuditTrail() {
  const [events, setEvents] = useState([]);

  const [summary, setSummary] = useState({
    total: 0,
    guardrails: 0,
    webhooks: 0,
    blocked: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    page_size: PAGE_SIZE,
    total: 0,
    total_pages: 1,
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [range, setRange] = useState("30");

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------------------------------------
  // LOAD AUDIT TRAIL
  // ---------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      async function loadAuditTrail() {
        try {
          setLoading(true);
          setError("");

          const params = new URLSearchParams();

          params.set("page", String(page));
          params.set("page_size", String(PAGE_SIZE));

          params.set(
            "category",
            categoryFilter === "All" ? "all" : categoryFilter
          );

          params.set(
            "status",
            statusFilter === "All" ? "all" : statusFilter
          );

          params.set("range", range);

          if (search.trim()) {
            params.set("search", search.trim());
          }

          const response = await fetch(
            `${API_BASE}/api/audit-trail?${params.toString()}`
          );

          if (!response.ok) {
            throw new Error(
              `Audit API returned ${response.status}`
            );
          }

          const data = await response.json();

          if (cancelled) {
            return;
          }

          setEvents(
            Array.isArray(data.events) ? data.events : []
          );

          setSummary({
            total: Number(data.summary?.total ?? 0),
            guardrails: Number(data.summary?.guardrails ?? 0),
            webhooks: Number(data.summary?.webhooks ?? 0),
            blocked: Number(data.summary?.blocked ?? 0),
          });

          setPagination({
            page: Number(data.pagination?.page ?? page),
            page_size: Number(
              data.pagination?.page_size ?? PAGE_SIZE
            ),
            total: Number(data.pagination?.total ?? 0),
            total_pages: Number(
              data.pagination?.total_pages ?? 1
            ),
          });
        } catch (err) {
          if (!cancelled) {
            setError(
              err?.message ||
                "Unable to load audit trail."
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      loadAuditTrail();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    search,
    categoryFilter,
    statusFilter,
    range,
    page,
  ]);

  // ---------------------------------------------------------
  // RESET PAGE WHEN FILTERS CHANGE
  // ---------------------------------------------------------

  useEffect(() => {
    setPage(1);
  }, [
    categoryFilter,
    statusFilter,
    range,
  ]);

  // ---------------------------------------------------------
  // PAGINATION
  // ---------------------------------------------------------

  function goToPage(nextPage) {
    const totalPages = pagination.total_pages || 1;

    const safePage = Math.min(
      Math.max(nextPage, 1),
      totalPages
    );

    setPage(safePage);
  }

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className="max-w-[1500px] p-4 sm:p-6 lg:p-[32px_34px_50px]">
      {/* Header */}
      <section className="mb-6">
        <p className="mb-2 text-[9px] font-extrabold tracking-[1.5px] text-[#5f259f]">
          MONITORING
        </p>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.7px] sm:text-[25px]">
              Audit Trail
            </h1>

            <p className="mt-2 text-[12px] text-[#6b6b75] sm:text-[13px]">
              Review every decision, guardrail check and
              recovery event.
            </p>
          </div>

          <RangeSelect
            value={range}
            onChange={(value) => {
              setRange(value);
              setPage(1);
            }}
          />
        </div>
      </section>

      {/* Summary */}
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Audit events"
          value={formatNumber(summary.total)}
          icon={Code2}
          iconClass="bg-[#f2eafa] text-[#5f259f]"
        />

        <SummaryCard
          label="Guardrail checks"
          value={formatNumber(summary.guardrails)}
          icon={ShieldCheck}
          iconClass="bg-[#eaf7fb] text-[#087ea4]"
        />

        <SummaryCard
          label="Verified webhooks"
          value={formatNumber(summary.webhooks)}
          icon={Webhook}
          iconClass="bg-[#ecf9f1] text-[#16a34a]"
        />

        <SummaryCard
          label="Blocked actions"
          value={formatNumber(summary.blocked)}
          icon={AlertCircle}
          iconClass="bg-[#fff0f0] text-[#dc2626]"
        />
      </section>

      {/* Integrity status */}
      <section className="mb-5 rounded-[11px] border border-[#e7e4ea] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[9px] bg-[#ecf9f1] text-[#16a34a]">
              <ShieldCheck size={19} />
            </div>

            <div>
              <h2 className="text-[13px] font-semibold">
                Audit logging operational
              </h2>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                Recovery decisions and live recovery
                events are being recorded.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium text-[#16a34a]">
            <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
            Integrity OK
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="mb-4 rounded-[11px] border border-[#e7e4ea] bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92909a]"
            />

            <input
              type="text"
              placeholder="Search event, payment ID or details..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-[7px] border border-[#e7e4ea] bg-[#fcfbfd] pl-9 pr-3 text-[12px] outline-none placeholder:text-[#aaa7b0] focus:border-[#b895d1] focus:ring-2 focus:ring-[#5f259f]/10"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <FilterSelect
              icon={Filter}
              value={categoryFilter}
              onChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
              options={[
                "All",
                "Recovery",
                "Tool",
                "Guardrail",
                "Engine",
                "Webhook",
              ]}
            />

            <FilterSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              options={[
                "All",
                "Success",
                "Approved",
                "Verified",
                "Decision",
                "Pending",
                "Blocked",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Audit table */}
      <section className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
        <div className="flex min-h-[68px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
          <div>
            <h2 className="text-[13px] font-semibold">
              Event history
            </h2>

            <p className="mt-1 text-[11px] text-[#6b6b75]">
              {loading
                ? "Loading audit events..."
                : `${formatNumber(
                    pagination.total
                  )} audit event${
                    pagination.total !== 1
                      ? "s"
                      : ""
                  }`}
            </p>
          </div>

          <div className="hidden items-center gap-2 text-[10px] text-[#6b6b75] sm:flex">
            <span className="h-[6px] w-[6px] rounded-full bg-[#16a34a]" />
            Live audit stream
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                {/* Header */}
                <div className="grid grid-cols-[1.15fr_1fr_1.35fr_2.1fr_1.3fr_0.9fr] items-center gap-4 border-b border-[#e7e4ea] bg-[#fcfbfd] px-5 py-3 text-[10px] font-bold tracking-[0.7px] text-[#85818c]">
                  <span>EVENT</span>
                  <span>CATEGORY</span>
                  <span>PAYMENT</span>
                  <span>DETAILS</span>
                  <span>TIME</span>
                  <span>STATUS</span>
                </div>

                {events.map((event) => (
                  <AuditRow
                    key={event.id}
                    event={event}
                  />
                ))}
              </div>
            </div>

            <Pagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              total={pagination.total}
              pageSize={pagination.page_size}
              onPageChange={goToPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

// =========================================================
// RANGE SELECT
// =========================================================

function RangeSelect({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-9 appearance-none rounded-[7px] border border-[#e7e4ea] bg-white pl-3 pr-9 text-[12px] text-[#45454f] outline-none transition focus:border-[#b895d1] focus:ring-2 focus:ring-[#5f259f]/10"
      >
        {RANGE_OPTIONS.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#85818c]"
      />
    </div>
  );
}

// =========================================================
// SUMMARY CARD
// =========================================================

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

// =========================================================
// FILTER SELECT
// =========================================================

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

// =========================================================
// AUDIT ROW
// =========================================================

function AuditRow({ event }) {
  const statusClass =
    statusStyles[event.status] ||
    "bg-[#f3eef7] text-[#5f259f]";

  return (
    <div className="grid min-h-[88px] grid-cols-[1.15fr_1fr_1.35fr_2.1fr_1.3fr_0.9fr] items-center gap-4 border-b border-[#f0edf2] px-5 py-3 text-[11px] last:border-b-0 hover:bg-[#fcfbfd]">
      {/* Event */}
      <div className="flex items-center gap-2">
        <EventIcon category={event.category} />

        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] font-semibold text-[#45454f]">
            {event.event}
          </div>

          <div className="mt-1 truncate text-[9px] text-[#92909a]">
            {event.id}
          </div>
        </div>
      </div>

      {/* Category */}
      <span className="text-[11px] text-[#6b6b75]">
        {event.category || "—"}
      </span>

      {/* Payment */}
      <span className="truncate font-mono text-[10px] font-medium text-[#45454f]">
        {event.paymentId || "—"}
      </span>

      {/* Details */}
      <div className="min-w-0">
        <div className="truncate font-medium text-[#45454f]">
          {event.description || "—"}
        </div>

        <div className="mt-1 truncate text-[10px] text-[#92909a]">
          {event.details || "—"}
        </div>
      </div>

      {/* Time */}
      <div>
        <div className="text-[10px] text-[#45454f]">
          {formatTimestamp(event.timestamp)}
        </div>

        <div className="mt-1 flex items-center gap-1 text-[9px] text-[#92909a]">
          <Clock3 size={10} />
          Audit event
        </div>
      </div>

      {/* Status */}
      <span
        className={`inline-flex w-fit items-center rounded-[5px] px-2 py-1 text-[10px] font-bold ${statusClass}`}
      >
        {event.status || "Unknown"}
      </span>
    </div>
  );
}

// =========================================================
// EVENT ICON
// =========================================================

function EventIcon({ category }) {
  if (category === "Guardrail") {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#eaf7fb] text-[#087ea4]">
        <ShieldCheck size={14} />
      </div>
    );
  }

  if (category === "Webhook") {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#ecf9f1] text-[#16a34a]">
        <Webhook size={14} />
      </div>
    );
  }

  if (category === "Engine") {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#f2eafa] text-[#5f259f]">
        <Code2 size={14} />
      </div>
    );
  }

  if (category === "Tool") {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#fff7e8] text-[#d97706]">
        <CheckCircle2 size={14} />
      </div>
    );
  }

  if (category === "Recovery") {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#f2eafa] text-[#5f259f]">
        <Activity size={14} />
      </div>
    );
  }

  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[#f3eef7] text-[#5f259f]">
      <Activity size={14} />
    </div>
  );
}

// =========================================================
// PAGINATION
// =========================================================

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}) {
  if (!total) {
    return null;
  }

  const start =
    (page - 1) * pageSize + 1;

  const end = Math.min(
    page * pageSize,
    total
  );

  const pages = getPaginationPages(
    page,
    totalPages
  );

  return (
    <div className="flex flex-col gap-3 border-t border-[#e7e4ea] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="text-[10px] text-[#6b6b75]">
        Showing{" "}
        <span className="font-semibold text-[#45454f]">
          {formatNumber(start)}
        </span>{" "}
        to{" "}
        <span className="font-semibold text-[#45454f]">
          {formatNumber(end)}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-[#45454f]">
          {formatNumber(total)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() =>
            onPageChange(page - 1)
          }
          className="grid h-8 w-8 place-items-center rounded-[6px] border border-[#e7e4ea] bg-white text-[#6b6b75] transition hover:bg-[#faf8fc] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((pageNumber, index) => {
          if (pageNumber === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="grid h-8 w-8 place-items-center text-[10px] text-[#85818c]"
              >
                ...
              </span>
            );
          }

          const active =
            pageNumber === page;

          return (
            <button
              key={pageNumber}
              type="button"
              onClick={() =>
                onPageChange(pageNumber)
              }
              className={`grid h-8 min-w-8 place-items-center rounded-[6px] px-2 text-[10px] font-medium transition ${
                active
                  ? "bg-[#5f259f] text-white"
                  : "border border-[#e7e4ea] bg-white text-[#6b6b75] hover:bg-[#faf8fc]"
              }`}
            >
              {pageNumber}
            </button>
          );
        })}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() =>
            onPageChange(page + 1)
          }
          className="grid h-8 w-8 place-items-center rounded-[6px] border border-[#e7e4ea] bg-white text-[#6b6b75] transition hover:bg-[#faf8fc] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// =========================================================
// PAGINATION PAGE NUMBERS
// =========================================================

function getPaginationPages(
  currentPage,
  totalPages
) {
  if (totalPages <= 7) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1
    );
  }

  const pages = [];

  pages.push(1);

  if (currentPage > 4) {
    pages.push("...");
  }

  const start = Math.max(
    2,
    currentPage - 1
  );

  const end = Math.min(
    totalPages - 1,
    currentPage + 1
  );

  for (
    let page = start;
    page <= end;
    page++
  ) {
    pages.push(page);
  }

  if (currentPage < totalPages - 3) {
    pages.push("...");
  }

  pages.push(totalPages);

  return pages;
}

// =========================================================
// LOADING
// =========================================================

function LoadingState() {
  return (
    <div className="flex min-h-[220px] items-center justify-center px-6">
      <div className="flex items-center gap-3 text-[12px] text-[#6b6b75]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e7e4ea] border-t-[#5f259f]" />
        Loading audit events...
      </div>
    </div>
  );
}

// =========================================================
// ERROR
// =========================================================

function ErrorState({ message }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#fff0f0] text-[#dc2626]">
        <AlertCircle size={20} />
      </div>

      <h3 className="mt-3 text-[12px] font-semibold">
        Unable to load audit trail
      </h3>

      <p className="mt-1 max-w-[420px] text-[11px] text-[#6b6b75]">
        {message}
      </p>
    </div>
  );
}

// =========================================================
// EMPTY
// =========================================================

function EmptyState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f3eef7] text-[#5f259f]">
        <XCircle size={20} />
      </div>

      <h3 className="mt-3 text-[12px] font-semibold">
        No audit events found
      </h3>

      <p className="mt-1 max-w-[300px] text-[11px] text-[#6b6b75]">
        Try changing your search or filter criteria.
      </p>
    </div>
  );
}

// =========================================================
// FORMAT NUMBER
// =========================================================

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

// =========================================================
// FORMAT TIMESTAMP
// =========================================================

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "—";
  }

  const date = new Date(timestamp);

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

export default AuditTrail;