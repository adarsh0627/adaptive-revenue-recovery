import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Filter,
  PieChart,
  Search,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const recoveryTrend = [
  { day: "01", failed: 8, recovered: 5 },
  { day: "02", failed: 10, recovered: 6 },
  { day: "03", failed: 7, recovered: 4 },
  { day: "04", failed: 12, recovered: 8 },
  { day: "05", failed: 9, recovered: 7 },
  { day: "06", failed: 14, recovered: 10 },
  { day: "07", failed: 11, recovered: 8 },
  { day: "08", failed: 15, recovered: 12 },
  { day: "09", failed: 13, recovered: 10 },
  { day: "10", failed: 17, recovered: 14 },
  { day: "11", failed: 16, recovered: 13 },
  { day: "12", failed: 19, recovered: 16 },
];

const actionPerformance = [
  {
    action: "Payment Link",
    attempts: 8,
    recovered: 6,
    rate: 75,
    revenue: 600,
  },
  {
    action: "Retry",
    attempts: 6,
    recovered: 4,
    rate: 67,
    revenue: 400,
  },
  {
    action: "Message",
    attempts: 4,
    recovered: 2,
    rate: 50,
    revenue: 200,
  },
  {
    action: "Merchant Escalation",
    attempts: 2,
    recovered: 0,
    rate: 0,
    revenue: 0,
  },
];

const failureTypes = [
  {
    label: "Network error",
    count: 12,
    percentage: 50,
  },
  {
    label: "Payment declined",
    count: 5,
    percentage: 21,
  },
  {
    label: "Timeout",
    count: 4,
    percentage: 17,
  },
  {
    label: "Insufficient funds",
    count: 3,
    percentage: 12,
  },
];

function Analytics() {
  const [period, setPeriod] = useState("Last 30 days");

  const totals = useMemo(() => {
    const failed = recoveryTrend.reduce(
      (total, item) => total + item.failed,
      0,
    );

    const recovered = recoveryTrend.reduce(
      (total, item) => total + item.recovered,
      0,
    );

    const rate = Math.round((recovered / failed) * 100);

    const revenue = actionPerformance.reduce(
      (total, item) => total + item.revenue,
      0,
    );

    return {
      failed,
      recovered,
      rate,
      revenue,
    };
  }, []);

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
              Understand recovery performance and revenue impact.
            </p>
          </div>

          <button className="flex h-9 w-fit items-center gap-2 rounded-[7px] border border-[#e7e4ea] bg-white px-3 text-[12px] text-[#45454f] hover:bg-[#faf8fc]">
            {period}
            <ChevronDown size={15} />
          </button>
        </div>
      </section>

      {/* KPI cards */}
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Failed payments"
          value={totals.failed}
          helper="Across selected period"
          icon={Activity}
          iconClass="bg-[#f2eafa] text-[#5f259f]"
        />

        <MetricCard
          label="Recovered payments"
          value={totals.recovered}
          helper={`${totals.rate}% recovery rate`}
          icon={TrendingUp}
          iconClass="bg-[#ecf9f1] text-[#16a34a]"
        />

        <MetricCard
          label="Recovered revenue"
          value={`₹${totals.revenue.toLocaleString("en-IN")}`}
          helper="Revenue recovered"
          icon={CircleDollarSign}
          iconClass="bg-[#eaf7fb] text-[#087ea4]"
        />

        <MetricCard
          label="Avg. recovery probability"
          value="59.0%"
          helper="V3 engine prediction"
          icon={WalletCards}
          iconClass="bg-[#f2eafa] text-[#5f259f]"
        />
      </section>

      {/* Main chart */}
      <section className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-[11px] border border-[#e7e4ea] bg-white">
          <div className="flex min-h-[76px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
            <div>
              <h2 className="text-[13px] font-semibold">
                Recovery performance
              </h2>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                Failed vs recovered payments
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
                label="Failed"
                className="bg-[#ddd9e2]"
              />

              <Legend
                label="Recovered"
                className="bg-[#5f259f]"
              />
            </div>

            <RecoveryChart />
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
            <div
              className="relative grid h-40 w-40 place-items-center rounded-full"
              style={{
                background:
                  "conic-gradient(#5f259f 0deg 216deg, #eeeaf1 216deg 360deg)",
              }}
            >
              <div className="grid h-[116px] w-[116px] place-items-center rounded-full bg-white">
                <div className="text-center">
                  <div className="text-[27px] font-bold">
                    60%
                  </div>

                  <div className="mt-1 text-[10px] text-[#6b6b75]">
                    recovery rate
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 text-center">
              <p className="text-[11px] text-[#6b6b75]">
                {totals.recovered} of {totals.failed} failed payments
                recovered.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Action performance + failure breakdown */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Action performance */}
        <div className="rounded-[11px] border border-[#e7e4ea] bg-white">
          <div className="flex min-h-[76px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
            <div>
              <h2 className="text-[13px] font-semibold">
                Recovery action performance
              </h2>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                Which recovery actions perform best
              </p>
            </div>

            <TrendingUp
              size={17}
              className="text-[#85818c]"
            />
          </div>

          <div className="divide-y divide-[#f0edf2]">
            {actionPerformance.map((item) => (
              <div
                key={item.action}
                className="px-4 py-4 sm:px-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold">
                      {item.action}
                    </div>

                    <div className="mt-1 text-[10px] text-[#92909a]">
                      {item.attempts} attempts · {item.recovered} recovered
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[12px] font-bold text-[#5f259f]">
                      {item.rate}%
                    </div>

                    <div className="mt-1 text-[9px] text-[#92909a]">
                      ₹{item.revenue.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-1.5 rounded-full bg-[#eeeaf1]">
                  <div
                    className="h-full rounded-full bg-[#5f259f]"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Failure breakdown */}
        <div className="rounded-[11px] border border-[#e7e4ea] bg-white">
          <div className="flex min-h-[76px] items-center justify-between border-b border-[#e7e4ea] px-4 sm:px-5">
            <div>
              <h2 className="text-[13px] font-semibold">
                Failure breakdown
              </h2>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                Most common payment failure reasons
              </p>
            </div>

            <Filter
              size={17}
              className="text-[#85818c]"
            />
          </div>

          <div className="p-4 sm:p-5">
            <div className="space-y-5">
              {failureTypes.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-medium">
                      {item.label}
                    </span>

                    <span className="text-[10px] text-[#6b6b75]">
                      {item.count} · {item.percentage}%
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-[#eeeaf1]">
                    <div
                      className="h-full rounded-full bg-[#5f259f]"
                      style={{
                        width: `${item.percentage}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Insight */}
      <section className="mt-4 rounded-[11px] border border-[#e1d5eb] bg-[#faf7fd] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#f2eafa] text-[#5f259f]">
            <TrendingUp size={17} />
          </div>

          <div>
            <h3 className="text-[12px] font-semibold">
              Recovery insight
            </h3>

            <p className="mt-1 text-[11px] leading-5 text-[#6b6b75]">
              Payment Link recovery is currently the strongest recovery
              action, recovering 75% of the attempts shown in the selected
              period.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

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

      <p className="mt-2 text-[10px] text-[#16a34a]">
        ↗ {helper}
      </p>
    </div>
  );
}

function Legend({ label, className }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </div>
  );
}

function RecoveryChart() {
  const maxValue = Math.max(
    ...recoveryTrend.map((item) => item.failed),
  );

  return (
    <div>
      <div className="flex h-[270px] gap-3">
        {/* Y axis */}
        <div className="flex flex-col justify-between py-1 text-[9px] text-[#92909a]">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue * 0.75)}</span>
          <span>{Math.round(maxValue * 0.5)}</span>
          <span>{Math.round(maxValue * 0.25)}</span>
          <span>0</span>
        </div>

        {/* Chart */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4].map((line) => (
              <div
                key={line}
                className="border-t border-dashed border-[#ece9ee]"
              />
            ))}
          </div>

          <div className="relative z-10 flex h-full items-end justify-between gap-1 px-1">
            {recoveryTrend.map((item) => {
              const failedHeight =
                (item.failed / maxValue) * 100;

              const recoveredHeight =
                (item.recovered / maxValue) * 100;

              return (
                <div
                  key={item.day}
                  className="flex h-full flex-1 items-end justify-center gap-[2px]"
                >
                  <div
                    className="w-[42%] rounded-t-[4px] bg-[#ddd9e2]"
                    style={{
                      height: `${failedHeight}%`,
                    }}
                  />

                  <div
                    className="w-[42%] rounded-t-[4px] bg-[#5f259f]"
                    style={{
                      height: `${recoveredHeight}%`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ml-7 mt-2 flex justify-between text-[9px] text-[#92909a]">
        {recoveryTrend.map((item) => (
          <span key={item.day}>{item.day}</span>
        ))}
      </div>
    </div>
  );
}

export default Analytics;