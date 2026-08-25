import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Search,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import API_URL from "../api";

const PAGE_SIZE = 20;

const statusStyles = {
  Failed: "bg-[rgba(220,38,38,0.08)] text-[#dc2626]",
  Recovered: "bg-[rgba(22,163,74,0.09)] text-[#16a34a]",
  Pending: "bg-[rgba(245,158,11,0.1)] text-[#d97706]",
  Stopped: "bg-[rgba(112,112,122,0.08)] text-[#70707a]",
};

const PAYMENT_METHODS = [
  "Card",
  "UPI",
  "NetBanking",
  "Wallet",
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(timestamp) {
  if (!timestamp) return "—";

  const normalized = timestamp.includes("T")
    ? timestamp
    : timestamp.replace(" ", "T");

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timestamp) {
  if (!timestamp) return "";

  const normalized = timestamp.includes("T")
    ? timestamp
    : timestamp.replace(" ", "T");

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function FailedPayments() {
  const [payments, setPayments] = useState([]);

  const [dashboard, setDashboard] = useState({
    failed_payments: 0,
    recovered_payments: 0,
    recovery_rate: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    page_size: PAGE_SIZE,
    total: 0,
    total_pages: 1,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // -------------------------------------------------------
  // LOAD DASHBOARD SUMMARY
  // -------------------------------------------------------

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch(
          `${API_URL}/api/dashboard`
        );

        if (!response.ok) {
          throw new Error(
            `Dashboard request failed: ${response.status}`
          );
        }

        const data = await response.json();

        setDashboard(data);
      } catch (err) {
        console.error(
          "Dashboard summary error:",
          err
        );
      }
    }

    loadDashboard();
  }, []);

  // -------------------------------------------------------
  // LOAD FAILED PAYMENTS
  // -------------------------------------------------------

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        params.set(
          "page",
          String(page)
        );

        params.set(
          "page_size",
          String(PAGE_SIZE)
        );

        params.set(
          "search",
          search
        );

        params.set(
          "status",
          statusFilter
        );

        params.set(
          "method",
          methodFilter
        );

        const response = await fetch(
          `${API_URL}/api/failed-payments?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(
            `Request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        setPayments(
          data.payments || []
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
        console.error(
          "Failed payments loading error:",
          err
        );

        setError(
          "Unable to load failed payments. Make sure the backend API is running."
        );

        setPayments([]);
      } finally {
        setLoading(false);
      }
    }

    loadPayments();
  }, [
    page,
    search,
    statusFilter,
    methodFilter,
  ]);

  // -------------------------------------------------------
  // RESET PAGE WHEN FILTER CHANGES
  // -------------------------------------------------------

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    methodFilter,
  ]);

  // -------------------------------------------------------
  // PAGINATION DISPLAY
  // -------------------------------------------------------

  const startItem =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          pagination.page_size +
        1;

  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(
          pagination.page *
            pagination.page_size,
          pagination.total
        );

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------

  return (
    <div className="max-w-[1500px] p-4 sm:p-6 lg:p-[32px_34px_50px]">
      {/* PAGE HEADING */}

      <section className="mb-6 flex flex-col gap-4 sm:mb-[27px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[9px] font-extrabold tracking-[1.5px] text-[#5f259f]">
            PAYMENT MONITORING
          </p>

          <h1 className="text-[22px] font-bold tracking-[-0.7px] sm:text-[25px]">
            Failed Payments
          </h1>

          <p className="mt-[7px] max-w-[650px] text-[11px] leading-5 text-[#6b6b75] sm:text-[12px]">
            Review failed payments and monitor recovery
            opportunities.
          </p>
        </div>

        <button className="flex h-9 w-fit items-center gap-2 rounded-[7px] border border-[#e7e4ea] bg-white px-3 text-[11px] text-[#45454f] hover:bg-[#faf8fc]">
          Last 30 days
          <ChevronRight size={16} />
        </button>
      </section>

      {/* SUMMARY CARDS */}

      <section className="mb-[14px] grid grid-cols-1 gap-[14px] sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total payments"
          value={dashboard.failed_payments.toLocaleString(
            "en-IN"
          )}
          icon={WalletCards}
        />

        <SummaryCard
          label="Failed payments"
          value={(
            dashboard.failed_payments -
            dashboard.recovered_payments
          ).toLocaleString("en-IN")}
          icon={AlertCircle}
          iconClass="bg-[rgba(220,38,38,0.08)] text-[#dc2626]"
        />

        <SummaryCard
          label="Recovered payments"
          value={dashboard.recovered_payments.toLocaleString(
            "en-IN"
          )}
          icon={CheckCircle2}
          iconClass="bg-[rgba(22,163,74,0.09)] text-[#16a34a]"
        />

        <SummaryCard
          label="Recovery rate"
          value={`${dashboard.recovery_rate}%`}
          icon={ArrowUpRight}
          iconClass="bg-[rgba(8,126,164,0.08)] text-[#087ea4]"
        />
      </section>

      {/* MAIN TABLE */}

      <section className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
        {/* HEADER */}

        <div className="border-b border-[#e7e4ea] px-4 py-4 sm:px-[19px] sm:py-[17px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[13px] font-semibold">
                Payment history
              </h2>

              <p className="mt-[5px] text-[10px] text-[#6b6b75]">
                Failed payment events and recovery status
              </p>
            </div>

            <div className="text-[10px] text-[#85818c]">
              {pagination.total.toLocaleString(
                "en-IN"
              )}{" "}
              results
            </div>
          </div>
        </div>

        {/* FILTERS */}

        <div className="border-b border-[#e7e4ea] bg-[#fcfbfd] px-4 py-3 sm:px-[19px]">
          <div className="flex flex-col gap-2 lg:flex-row">
            {/* SEARCH */}

            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#85818c]"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value
                  );
                }}
                placeholder="Search payment ID, failure, method..."
                className="h-9 w-full rounded-[7px] border border-[#e7e4ea] bg-white pl-9 pr-3 text-[10px] text-[#45454f] outline-none placeholder:text-[#aaa6b0] focus:border-[#5f259f]"
              />
            </div>

            {/* STATUS */}

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target.value
                );
              }}
              className="h-9 rounded-[7px] border border-[#e7e4ea] bg-white px-3 text-[10px] text-[#45454f] outline-none"
            >
              <option value="all">
                All statuses
              </option>

              <option value="Failed">
                Failed
              </option>

              <option value="Recovered">
                Recovered
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Stopped">
                Stopped
              </option>
            </select>

            {/* PAYMENT METHOD */}

            <select
              value={methodFilter}
              onChange={(event) => {
                setMethodFilter(
                  event.target.value
                );
              }}
              className="h-9 rounded-[7px] border border-[#e7e4ea] bg-white px-3 text-[10px] text-[#45454f] outline-none"
            >
              <option value="all">
                All methods
              </option>

              {PAYMENT_METHODS.map(
                (method) => (
                  <option
                    key={method}
                    value={method}
                  >
                    {method}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* LOADING */}

        {loading && (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex items-center gap-2 text-[11px] text-[#6b6b75]">
              <Loader2
                size={17}
                className="animate-spin text-[#5f259f]"
              />

              Loading payment data...
            </div>
          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="flex min-h-[300px] items-center justify-center px-6">
            <div className="text-center">
              <XCircle
                size={28}
                className="mx-auto mb-3 text-[#dc2626]"
              />

              <p className="text-[12px] font-semibold text-[#25232a]">
                Unable to load payments
              </p>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* EMPTY */}

        {!loading &&
          !error &&
          payments.length === 0 && (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Search
                  size={26}
                  className="mx-auto mb-3 text-[#aaa6b0]"
                />

                <p className="text-[12px] font-semibold text-[#25232a]">
                  No payments found
                </p>

                <p className="mt-1 text-[10px] text-[#6b6b75]">
                  Try changing your search or filters.
                </p>
              </div>
            </div>
          )}

        {/* TABLE */}

        {!loading &&
          !error &&
          payments.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <div className="min-w-[1050px]">
                  {/* COLUMN HEADINGS */}

                  <div className="grid min-h-[38px] grid-cols-[1.7fr_1.1fr_1fr_1.4fr_0.9fr_1.1fr_1fr] items-center gap-[15px] border-b border-[#e7e4ea] px-[19px] text-[8px] font-bold tracking-[0.8px] text-[#85818c]">
                    <span>PAYMENT</span>
                    <span>METHOD</span>
                    <span>AMOUNT</span>
                    <span>FAILURE</span>
                    <span>PROBABILITY</span>
                    <span>ACTION</span>
                    <span>STATUS</span>
                  </div>

                  {/* ROWS */}

                  {payments.map(
                    (payment) => (
                      <div
                        key={`${payment.payment_id}-${payment.timestamp}`}
                        onClick={() =>
                            navigate(
                            `/failed-payments/${payment.payment_id}`
                            )
                        }
                        className="grid min-h-[65px] cursor-pointer grid-cols-[1.7fr_1.1fr_1fr_1.4fr_0.9fr_1.1fr_1fr] items-center gap-[15px] border-b border-[#f0edf2] px-[19px] text-[10px] text-[#45454f] transition-colors last:border-b-0 hover:bg-[#faf8fc]"
                        >
                        {/* PAYMENT */}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#f3edf9] text-[#5f259f]">
                              <WalletCards size={14} />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate font-mono text-[9px] text-[#45454f]">
                                {
                                  payment.payment_id
                                }
                              </div>

                              <div className="mt-1 flex items-center gap-1 text-[8px] text-[#85818c]">
                                <Clock3 size={10} />

                                <span>
                                  {formatDate(
                                    payment.timestamp
                                  )}
                                </span>

                                <span>·</span>

                                <span>
                                  {formatTime(
                                    payment.timestamp
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* METHOD */}

                        <span className="text-[10px]">
                          {payment.payment_method ||
                            "—"}
                        </span>

                        {/* AMOUNT */}

                        <strong className="text-[10px] text-[#25232a]">
                          {formatCurrency(
                            payment.amount
                          )}
                        </strong>

                        {/* FAILURE */}

                        <div>
                          <div className="text-[10px] text-[#45454f]">
                            {payment.failure_reason ||
                              "Unknown"}
                          </div>
                        </div>

                        {/* PROBABILITY */}

                        <div>
                          {payment.probability !==
                            null &&
                          payment.probability !==
                            undefined ? (
                            <div>
                              <div className="text-[10px] font-semibold text-[#5f259f]">
                                {Number(
                                  payment.probability
                                ).toFixed(1)}
                                %
                              </div>

                              <div className="mt-1 h-1 w-[55px] overflow-hidden rounded-full bg-[#eeeaf1]">
                                <div
                                  className="h-full rounded-full bg-[#5f259f]"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        Number(
                                          payment.probability
                                        )
                                      )
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#aaa6b0]">
                              —
                            </span>
                          )}
                        </div>

                        {/* ACTION */}

                        <span className="text-[10px]">
                          {payment.action ||
                            "—"}
                        </span>

                        {/* STATUS */}

                        <span
                          className={`w-fit rounded-[5px] px-[7px] py-1 text-[8px] font-bold ${
                            statusStyles[
                              payment.status
                            ] ||
                            "bg-[#f5f3f6] text-[#70707a]"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* PAGINATION */}

              <div className="flex flex-col gap-3 border-t border-[#e7e4ea] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-[19px]">
                <div className="text-[9px] text-[#85818c]">
                  Showing{" "}
                  <span className="font-semibold text-[#45454f]">
                    {startItem.toLocaleString(
                      "en-IN"
                    )}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-[#45454f]">
                    {endItem.toLocaleString(
                      "en-IN"
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#45454f]">
                    {pagination.total.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={
                      pagination.page === 1
                    }
                    onClick={() => {
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      );
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#e7e4ea] bg-white text-[#6b6b75] disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#faf8fc]"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span className="px-2 text-[9px] text-[#6b6b75]">
                    Page{" "}
                    {pagination.page} of{" "}
                    {pagination.total_pages}
                  </span>

                  <button
                    disabled={
                      pagination.page ===
                      pagination.total_pages
                    }
                    onClick={() => {
                      setPage(
                        (current) =>
                          Math.min(
                            pagination.total_pages,
                            current + 1
                          )
                      );
                    }}
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
  iconClass = "bg-[rgba(95,37,159,0.08)] text-[#5f259f]",
}) {
  return (
    <div className="rounded-[11px] border border-[#e7e4ea] bg-white p-4 sm:p-[17px_19px]">
      <div className="flex items-start justify-between">
        <span className="text-[10px] text-[#6b6b75]">
          {label}
        </span>

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-[7px] ${iconClass}`}
        >
          <Icon size={16} />
        </div>
      </div>

      <div className="mt-4 text-[22px] font-bold tracking-[-0.5px] text-[#25232a]">
        {value}
      </div>
    </div>
  );
}

export default FailedPayments;