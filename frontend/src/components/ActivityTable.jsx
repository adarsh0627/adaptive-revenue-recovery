import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  WalletCards,
} from "lucide-react";

import API_BASE_URL from "../api";

const PAGE_SIZE = 5;

const statusStyles = {
  Recovered:
    "bg-[rgba(22,163,74,0.09)] text-[#16a34a]",
  Stopped:
    "bg-[rgba(112,112,122,0.08)] text-[#70707a]",
  Pending:
    "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]",
  Failed:
    "bg-[rgba(239,68,68,0.09)] text-[#dc2626]",
};

const dateRanges = [
  {
    label: "Last 24 hours",
    value: "24h",
  },
  {
    label: "Last 7 days",
    value: "7d",
  },
  {
    label: "Last 30 days",
    value: "30d",
  },
  {
    label: "All available",
    value: "all",
  },
];

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return "Unknown";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMs = Date.now() - date.getTime();

  const diffMinutes = Math.max(
    0,
    Math.floor(
      diffMs / (1000 * 60)
    )
  );

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(
    diffMinutes / 60
  );

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(
    diffHours / 24
  );

  if (diffDays < 7) {
    return `${diffDays} day${
      diffDays === 1 ? "" : "s"
    } ago`;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function ActivityTable() {
  const [activities, setActivities] =
    useState([]);

  const [pagination, setPagination] =
    useState({
      page: 1,
      page_size: PAGE_SIZE,
      total: 0,
      total_pages: 1,
    });

  const [dateRange, setDateRange] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadActivities = async (
    selectedPage = 1,
    selectedRange = dateRange
  ) => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(selectedPage),
        page_size: String(PAGE_SIZE),
        range: selectedRange,
      });

      const response = await fetch(
        `${API_BASE_URL}/api/recovery-activity?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(
          `API request failed with status ${response.status}`
        );
      }

      const data = await response.json();

      setActivities(
        Array.isArray(data.activities)
          ? data.activities
          : []
      );

      setPagination(
        data.pagination || {
          page: selectedPage,
          page_size: PAGE_SIZE,
          total: 0,
          total_pages: 1,
        }
      );
    } catch (err) {
      console.error(
        "Recovery activity API error:",
        err
      );

      setActivities([]);

      setPagination({
        page: 1,
        page_size: PAGE_SIZE,
        total: 0,
        total_pages: 1,
      });

      setError(
        "Unable to load recovery activity."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities(1, dateRange);
  }, [dateRange]);

  const handleRangeChange = (
    event
  ) => {
    const nextRange =
      event.target.value;

    setDateRange(nextRange);
  };

  const handlePrevious = () => {
    if (
      pagination.page <= 1 ||
      loading
    ) {
      return;
    }

    loadActivities(
      pagination.page - 1,
      dateRange
    );
  };

  const handleNext = () => {
    if (
      pagination.page >=
        pagination.total_pages ||
      loading
    ) {
      return;
    }

    loadActivities(
      pagination.page + 1,
      dateRange
    );
  };

  const totalPages =
    Math.max(
      pagination.total_pages || 1,
      1
    );

  const currentPage =
    Math.min(
      Math.max(
        pagination.page || 1,
        1
      ),
      totalPages
    );

  const startItem =
    pagination.total === 0
      ? 0
      : (currentPage - 1) *
          PAGE_SIZE +
        1;

  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(
          currentPage * PAGE_SIZE,
          pagination.total
        );

  return (
    <div className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">

      {/* Header */}
      <div className="flex min-h-[70px] flex-col justify-between gap-3 border-b border-[#e7e4ea] px-4 py-4 sm:flex-row sm:items-center sm:px-[19px] sm:py-[17px]">

        <div>
          <h2 className="text-[13px] font-semibold">
            Recent recovery activity
          </h2>

          <p className="mt-[5px] text-[10px] text-[#6b6b75]">
            Latest actions performed by
            the recovery agent
          </p>
        </div>

        <div className="flex items-center gap-2">

          <select
            value={dateRange}
            onChange={
              handleRangeChange
            }
            disabled={loading}
            className="h-8 rounded-[7px] border border-[#e7e4ea] bg-white px-2.5 text-[10px] text-[#45454f] outline-none transition hover:bg-[#faf8fc] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Recovery activity date range"
          >
            {dateRanges.map(
              (range) => (
                <option
                  key={range.value}
                  value={range.value}
                >
                  {range.label}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            className="flex shrink-0 items-center gap-1 border-0 bg-transparent text-[10px] text-[#5f259f]"
          >
            View all
            <ArrowUpRight
              size={15}
            />
          </button>

        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex min-h-[150px] items-center justify-center">
          <span className="text-[11px] text-[#6b6b75]">
            Loading recovery activity...
          </span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex min-h-[150px] items-center justify-center px-4 text-center">
          <span className="text-[11px] text-[#dc2626]">
            {error}
          </span>
        </div>
      )}

      {/* Empty state */}
      {!loading &&
        !error &&
        activities.length === 0 && (
          <div className="flex min-h-[150px] items-center justify-center px-4 text-center">
            <div>
              <p className="text-[11px] text-[#6b6b75]">
                No recovery activity
                found.
              </p>

              <p className="mt-1 text-[9px] text-[#9a97a0]">
                Try another date range.
              </p>
            </div>
          </div>
        )}

      {/* Table */}
      {!loading &&
        !error &&
        activities.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">

              {/* Header row */}
              <div className="grid min-h-[35px] grid-cols-[2fr_1.4fr_1fr_1.1fr_0.9fr] items-center gap-[15px] border-b border-[#e7e4ea] px-[19px] text-[8px] font-bold tracking-[0.8px] text-[#85818c]">
                <span>
                  PAYMENT
                </span>

                <span>
                  ACTION
                </span>

                <span>
                  AMOUNT
                </span>

                <span>
                  STATUS
                </span>

                <span>
                  TIME
                </span>
              </div>

              {/* Rows */}
              {activities.map(
                (item) => (
                  <div
                    key={`${item.id}-${item.attempt_number}-${item.timestamp}`}
                    className="grid min-h-[49px] grid-cols-[2fr_1.4fr_1fr_1.1fr_0.9fr] items-center gap-[15px] border-b border-[#f0edf2] px-[19px] text-[10px] text-[#45454f] last:border-b-0"
                  >

                    {/* Payment */}
                    <div className="flex items-center gap-2">

                      <WalletCards
                        size={16}
                        className="shrink-0 text-[#8c8794]"
                      />

                      <span className="font-mono text-[9px] text-[#6b6b75]">
                        {item.payment_id ||
                          item.id}
                      </span>

                    </div>

                    {/* Action */}
                    <span className="text-[#45454f]">
                      {item.action ||
                        "Unknown"}
                    </span>

                    {/* Amount */}
                    <strong className="text-[10px] text-[#25232a]">
                      {formatCurrency(
                        item.amount
                      )}
                    </strong>

                    {/* Status */}
                    <span
                      className={`w-fit rounded-[5px] px-[7px] py-1 text-[8px] font-bold ${
                        statusStyles[
                          item.status
                        ] ||
                        "bg-[#f5f3f6] text-[#6b6b75]"
                      }`}
                    >
                      {item.status ||
                        "Unknown"}
                    </span>

                    {/* Time */}
                    <span className="text-[#85818c]">
                      {formatRelativeTime(
                        item.timestamp
                      )}
                    </span>

                  </div>
                )
              )}

            </div>
          </div>
        )}

      {/* Pagination */}
      {!loading &&
        !error &&
        pagination.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#e7e4ea] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-[19px]">

            <span className="text-[9px] text-[#85818c]">
              Showing{" "}
              <span className="font-semibold text-[#45454f]">
                {startItem}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-[#45454f]">
                {endItem}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#45454f]">
                {pagination.total.toLocaleString(
                  "en-IN"
                )}
              </span>{" "}
              activities
            </span>

            <div className="flex items-center gap-1.5">

              <button
                type="button"
                onClick={
                  handlePrevious
                }
                disabled={
                  currentPage <=
                    1 || loading
                }
                className="flex h-7 items-center gap-1 rounded-[6px] border border-[#e7e4ea] bg-white px-2 text-[9px] text-[#6b6b75] transition hover:bg-[#faf8fc] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft
                  size={12}
                />

                <span className="hidden sm:inline">
                  Previous
                </span>
              </button>

              <div className="flex h-7 min-w-[28px] items-center justify-center rounded-[6px] bg-[rgba(95,37,159,0.09)] px-2 text-[9px] font-semibold text-[#5f259f]">
                {currentPage}
              </div>

              <span className="px-0.5 text-[9px] text-[#9a97a0]">
                of
              </span>

              <span className="min-w-[28px] text-center text-[9px] text-[#6b6b75]">
                {totalPages}
              </span>

              <button
                type="button"
                onClick={
                  handleNext
                }
                disabled={
                  currentPage >=
                    totalPages ||
                  loading
                }
                className="flex h-7 items-center gap-1 rounded-[6px] border border-[#e7e4ea] bg-white px-2 text-[9px] text-[#6b6b75] transition hover:bg-[#faf8fc] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="hidden sm:inline">
                  Next
                </span>

                <ArrowRight
                  size={12}
                />
              </button>

            </div>
          </div>
        )}

    </div>
  );
}

export default ActivityTable;
