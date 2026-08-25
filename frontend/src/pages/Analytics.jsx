import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  Clock3,
  PieChart,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import API_BASE from "../api";

function Analytics() {
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [period, setPeriod] = useState("All available data");

  // ---------------------------------------------------------
  // LOAD REAL RECOVERY PERFORMANCE
  // ---------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadPerformance() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE}/api/recovery-performance`
        );

        if (!response.ok) {
          throw new Error(
            `Recovery performance API returned ${response.status}`
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setPerformance(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
              "Unable to load recovery performance."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPerformance();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------
  // DERIVED METRICS
  // ---------------------------------------------------------

  const totals = useMemo(() => {
    const recovered = Number(
      performance?.recovered ?? 0
    );

    const total = Number(
      performance?.total ?? 0
    );

    const failed = Math.max(
      total - recovered,
      0
    );

    const rate =
      total > 0
        ? (recovered / total) * 100
        : 0;

    return {
      recovered,
      total,
      failed,
      rate,
    };
  }, [performance]);

  const buckets = useMemo(() => {
    if (!Array.isArray(performance?.buckets)) {
      return [];
    }

    return performance.buckets;
  }, [performance]);

  const populatedBuckets = useMemo(
    () =>
      buckets.filter(
        (bucket) =>
          Number(bucket.total || 0) > 0
      ),
    [buckets]
  );

  const averageBucketRate = useMemo(() => {
    if (!populatedBuckets.length) {
      return 0;
    }

    const weightedRecovered =
      populatedBuckets.reduce(
        (sum, bucket) =>
          sum + Number(bucket.recovered || 0),
        0
      );

    const weightedTotal =
      populatedBuckets.reduce(
        (sum, bucket) =>
          sum + Number(bucket.total || 0),
        0
      );

    return weightedTotal > 0
      ? (weightedRecovered / weightedTotal) * 100
      : 0;
  }, [populatedBuckets]);

  const bestBucket = useMemo(() => {
    if (!populatedBuckets.length) {
      return null;
    }

    return populatedBuckets.reduce(
      (best, current) =>
        Number(current.value || 0) >
        Number(best.value || 0)
          ? current
          : best
    );
  }, [populatedBuckets]);

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className="max-w-[1500px] p-4 sm:p-6 lg:p-[32px_34px_50px]">
      {/* Header */}
      <section className="mb-6">
        <p className="mb-2 text-[9px] font-extrabold tracking-[1.5px] text-[#5f259f]">
          PERFORMANCE
        </p>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.7px] sm:text-[25px]">
              Analytics
            </h1>

            <p className="mt-2 text-[12px] text-[#6b6b75] sm:text-[13px]">
              Understand recovery performance and
              revenue impact from the recovery engine.
            </p>
          </div>

          <div className="flex h-9 w-fit items-center gap-2 rounded-[7px] border border-[#e7e4ea] bg-white px-3 text-[11px] text-[#45454f]">
            <Clock3
              size={14}
              className="text-[#85818c]"
            />

            {period}
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <section className="mb-5 rounded-[11px] border border-[#f0d0d0] bg-[#fff8f8] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-[7px] bg-[#fff0f0] text-[#dc2626]">
              <RefreshCw size={15} />
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#45454f]">
                Analytics data unavailable
              </p>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                {error}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* KPI cards */}
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total failed payments"
          value={
            loading
              ? "—"
              : formatNumber(totals.total)
          }
          helper="Payments evaluated"
          icon={Activity}
          iconClass="bg-[#f2eafa] text-[#5f259f]"
        />

        <MetricCard
          label="Recovered payments"
          value={
            loading
              ? "—"
              : formatNumber(totals.recovered)
          }
          helper={
            loading
              ? "Loading performance"
              : `${formatPercent(
                  totals.rate
                )} recovery rate`
          }
          icon={TrendingUp}
          iconClass="bg-[#ecf9f1] text-[#16a34a]"
        />

        <MetricCard
          label="Unrecovered payments"
          value={
            loading
              ? "—"
              : formatNumber(totals.failed)
          }
          helper="Not recovered"
          icon={CircleDollarSign}
          iconClass="bg-[#fff0f0] text-[#dc2626]"
        />

        <MetricCard
          label="Overall recovery rate"
          value={
            loading
              ? "—"
              : `${formatPercent(
                  averageBucketRate
                )}`
          }
          helper="Observed recovery rate"
          icon={WalletCards}
          iconClass="bg-[#eaf7fb] text-[#087ea4]"
        />
      </section>

      {/* Main analytics */}
      <section className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        {/* Recovery performance */}
        <div className="rounded-[11px] border border-[#e7e4ea] bg-white">
          <div className="flex min-h-[76px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
            <div>
              <h2 className="text-[13px] font-semibold">
                Recovery performance
              </h2>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                Recovery rate across the available
                performance buckets.
              </p>
            </div>

            <BarChart3
              size={17}
              className="text-[#85818c]"
            />
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-end gap-4 text-[10px] text-[#6b6b75]">
              <Legend
                label="Total"
                className="bg-[#ddd9e2]"
              />

              <Legend
                label="Recovered"
                className="bg-[#5f259f]"
              />
            </div>

            {loading ? (
              <ChartLoading />
            ) : buckets.length ? (
              <RecoveryChart buckets={buckets} />
            ) : (
              <ChartEmpty />
            )}
          </div>
        </div>

        {/* Recovery rate */}
        <div className="rounded-[11px] border border-[#e7e4ea] bg-white">
          <div className="flex min-h-[76px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
            <div>
              <h2 className="text-[13px] font-semibold">
                Recovery rate
              </h2>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                Overall payment recovery
              </p>
            </div>

            <PieChart
              size={17}
              className="text-[#85818c]"
            />
          </div>

          <div className="flex flex-col items-center justify-center p-6">
            <RecoveryDonut
              rate={totals.rate}
              loading={loading}
            />

            <div className="mt-5 text-center">
              {loading ? (
                <p className="text-[11px] text-[#6b6b75]">
                  Calculating recovery performance...
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-[#6b6b75]">
                    <span className="font-semibold text-[#45454f]">
                      {formatNumber(
                        totals.recovered
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#45454f]">
                      {formatNumber(
                        totals.total
                      )}
                    </span>{" "}
                    failed payments recovered.
                  </p>

                  <p className="mt-2 text-[10px] text-[#92909a]">
                    Based on currently available
                    recovery-performance data.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bucket details */}
      <section className="mb-5 rounded-[11px] border border-[#e7e4ea] bg-white">
        <div className="flex min-h-[76px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
          <div>
            <h2 className="text-[13px] font-semibold">
              Performance buckets
            </h2>

            <p className="mt-1 text-[10px] text-[#6b6b75]">
              Detailed recovery results returned by the
              engine.
            </p>
          </div>

          <Activity
            size={17}
            className="text-[#85818c]"
          />
        </div>

        {loading ? (
          <div className="flex min-h-[150px] items-center justify-center text-[11px] text-[#6b6b75]">
            Loading performance data...
          </div>
        ) : buckets.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[1fr_1.2fr_1.2fr_1.2fr] border-b border-[#e7e4ea] bg-[#fcfbfd] px-5 py-3 text-[9px] font-bold tracking-[0.7px] text-[#85818c]">
                <span>BUCKET</span>
                <span>TOTAL</span>
                <span>RECOVERED</span>
                <span>RECOVERY RATE</span>
              </div>

              {buckets.map((bucket) => (
                <BucketRow
                  key={bucket.label}
                  bucket={bucket}
                />
              ))}
            </div>
          </div>
        ) : (
          <ChartEmpty />
        )}
      </section>

      {/* Insight */}
      <section className="rounded-[11px] border border-[#e1d5eb] bg-[#faf7fd] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#f2eafa] text-[#5f259f]">
            <TrendingUp size={17} />
          </div>

          <div>
            <h3 className="text-[12px] font-semibold">
              Recovery insight
            </h3>

            {loading ? (
              <p className="mt-1 text-[11px] leading-5 text-[#6b6b75]">
                Loading recovery insights...
              </p>
            ) : bestBucket ? (
              <p className="mt-1 text-[11px] leading-5 text-[#6b6b75]">
                Bucket{" "}
                <span className="font-semibold text-[#45454f]">
                  {bestBucket.label}
                </span>{" "}
                currently has the strongest observed
                recovery rate at{" "}
                <span className="font-semibold text-[#5f259f]">
                  {formatPercent(
                    Number(
                      bestBucket.value || 0
                    )
                  )}
                </span>
                . Across all populated buckets, the
                observed recovery rate is{" "}
                <span className="font-semibold text-[#45454f]">
                  {formatPercent(
                    averageBucketRate
                  )}
                </span>
                .
              </p>
            ) : (
              <p className="mt-1 text-[11px] leading-5 text-[#6b6b75]">
                No populated recovery-performance buckets
                are currently available.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// =========================================================
// METRIC CARD
// =========================================================

function MetricCard({
  label,
  value,
  helper,
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

      <p className="mt-2 text-[10px] text-[#6b6b75]">
        {helper}
      </p>
    </div>
  );
}

// =========================================================
// LEGEND
// =========================================================

function Legend({ label, className }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 rounded-full ${className}`}
      />
      {label}
    </div>
  );
}

// =========================================================
// RECOVERY CHART
// =========================================================

function RecoveryChart({ buckets }) {
  const maxValue = Math.max(
    ...buckets.map((item) =>
      Number(item.total || 0)
    ),
    1
  );

  return (
    <div>
      <div className="flex h-[270px] gap-3">
        {/* Y axis */}
        <div className="flex flex-col justify-between py-1 text-[9px] text-[#92909a]">
          <span>{formatCompact(maxValue)}</span>
          <span>
            {formatCompact(
              maxValue * 0.75
            )}
          </span>
          <span>
            {formatCompact(
              maxValue * 0.5
            )}
          </span>
          <span>
            {formatCompact(
              maxValue * 0.25
            )}
          </span>
          <span>0</span>
        </div>

        {/* Chart */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4].map(
              (line) => (
                <div
                  key={line}
                  className="border-t border-dashed border-[#ece9ee]"
                />
              )
            )}
          </div>

          <div className="relative z-10 flex h-full items-end justify-between gap-1 px-1">
            {buckets.map((item) => {
              const total = Number(
                item.total || 0
              );

              const recovered = Number(
                item.recovered || 0
              );

              const totalHeight =
                (total / maxValue) * 100;

              const recoveredHeight =
                (recovered / maxValue) * 100;

              return (
                <div
                  key={item.label}
                  className="flex h-full flex-1 items-end justify-center gap-[2px]"
                >
                  <div
                    title={`Total: ${formatNumber(
                      total
                    )}`}
                    className="w-[42%] rounded-t-[4px] bg-[#ddd9e2]"
                    style={{
                      height: `${totalHeight}%`,
                      minHeight:
                        total > 0
                          ? "3px"
                          : "0px",
                    }}
                  />

                  <div
                    title={`Recovered: ${formatNumber(
                      recovered
                    )}`}
                    className="w-[42%] rounded-t-[4px] bg-[#5f259f]"
                    style={{
                      height: `${recoveredHeight}%`,
                      minHeight:
                        recovered > 0
                          ? "3px"
                          : "0px",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ml-7 mt-2 flex justify-between text-[9px] text-[#92909a]">
        {buckets.map((item) => (
          <span
            key={item.label}
            className="flex-1 text-center"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// =========================================================
// DONUT
// =========================================================

function RecoveryDonut({
  rate,
  loading,
}) {
  const safeRate = Math.min(
    Math.max(rate, 0),
    100
  );

  const degrees =
    (safeRate / 100) * 360;

  return (
    <div
      className="relative grid h-40 w-40 place-items-center rounded-full"
      style={{
        background: loading
          ? "#eeeaf1"
          : `conic-gradient(
              #5f259f 0deg ${degrees}deg,
              #eeeaf1 ${degrees}deg 360deg
            )`,
      }}
    >
      <div className="grid h-[116px] w-[116px] place-items-center rounded-full bg-white">
        <div className="text-center">
          <div className="text-[27px] font-bold">
            {loading
              ? "—"
              : formatPercent(rate)}
          </div>

          <div className="mt-1 text-[10px] text-[#6b6b75]">
            recovery rate
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// BUCKET ROW
// =========================================================

function BucketRow({ bucket }) {
  const total = Number(
    bucket.total || 0
  );

  const recovered = Number(
    bucket.recovered || 0
  );

  const rate = Number(
    bucket.value || 0
  );

  return (
    <div className="grid min-h-[58px] grid-cols-[1fr_1.2fr_1.2fr_1.2fr] items-center border-b border-[#f0edf2] px-5 text-[11px] last:border-b-0 hover:bg-[#fcfbfd]">
      <span className="font-semibold text-[#45454f]">
        {bucket.label}
      </span>

      <span className="text-[#6b6b75]">
        {formatNumber(total)}
      </span>

      <span className="font-medium text-[#16a34a]">
        {formatNumber(recovered)}
      </span>

      <div className="flex items-center gap-3">
        <div className="h-1.5 w-[100px] rounded-full bg-[#eeeaf1]">
          <div
            className="h-full rounded-full bg-[#5f259f]"
            style={{
              width: `${Math.min(
                Math.max(rate, 0),
                100
              )}%`,
            }}
          />
        </div>

        <span className="font-semibold text-[#5f259f]">
          {formatPercent(rate)}
        </span>
      </div>
    </div>
  );
}

// =========================================================
// LOADING
// =========================================================

function ChartLoading() {
  return (
    <div className="flex h-[300px] items-center justify-center">
      <div className="flex items-center gap-2 text-[11px] text-[#6b6b75]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e7e4ea] border-t-[#5f259f]" />
        Loading recovery performance...
      </div>
    </div>
  );
}

// =========================================================
// EMPTY
// =========================================================

function ChartEmpty() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center text-center">
      <Activity
        size={22}
        className="text-[#92909a]"
      />

      <p className="mt-3 text-[12px] font-semibold text-[#45454f]">
        No performance data
      </p>

      <p className="mt-1 text-[10px] text-[#92909a]">
        The recovery engine has not returned any
        populated buckets yet.
      </p>
    </div>
  );
}

// =========================================================
// NUMBER FORMATTING
// =========================================================

function formatNumber(value) {
  return Number(value || 0).toLocaleString(
    "en-IN"
  );
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatCompact(value) {
  const number = Number(value || 0);

  if (number >= 1000000) {
    return `${(number / 1000000).toFixed(1)}M`;
  }

  if (number >= 1000) {
    return `${(number / 1000).toFixed(1)}k`;
  }

  return Math.round(number);
}

export default Analytics;