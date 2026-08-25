import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import KpiCard from "../components/KpiCard";
import RecoveryChart from "../components/RecoveryChart";
import EngineIntelligence from "../components/EngineIntelligence";
import ActivityTable from "../components/ActivityTable";

import API_BASE_URL from "../api";

function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE_URL}/api/dashboard`
        );

        if (!response.ok) {
          throw new Error(
            `API request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        setDashboardData(data);
      } catch (err) {
        console.error("Dashboard API error:", err);
        setError("Unable to load live dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-[32px_34px_50px]">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-[13px] text-[#6b6b75]">
            Loading dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="p-6 lg:p-[32px_34px_50px]">
        <div className="rounded-[11px] border border-[#f0d5d5] bg-white p-6">
          <h2 className="text-[15px] font-semibold text-[#25232a]">
            Dashboard unavailable
          </h2>

          <p className="mt-2 text-[11px] text-[#6b6b75]">
            {error || "No dashboard data was returned by the API."}
          </p>

          <p className="mt-3 text-[10px] text-[#85818c]">
            Make sure the backend API is running on port 8001.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] p-4 sm:p-6 lg:p-[32px_34px_50px]">
      {/* Page heading */}
      <section className="mb-6 flex flex-col gap-4 sm:mb-[27px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[9px] font-extrabold tracking-[1.5px] text-[#5f259f]">
            RECOVERY INTELLIGENCE
          </p>

          <h1 className="text-[22px] font-bold tracking-[-0.7px] sm:text-[25px]">
            Revenue Recovery Dashboard
          </h1>

          <p className="mt-[7px] max-w-[650px] text-[11px] leading-5 text-[#6b6b75] sm:text-[12px]">
            Monitor failed payments and adaptive recovery performance in
            real time.
          </p>
        </div>

        <button className="flex h-9 w-fit items-center gap-2 rounded-[7px] border border-[#e7e4ea] bg-white px-3 text-[11px] text-[#45454f] hover:bg-[#faf8fc]">
          Last 30 days
          <ChevronRight size={16} />
        </button>
      </section>

      {/* KPI cards */}
      <section className="mb-[14px] grid grid-cols-1 gap-[14px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Failed payments"
          value={dashboardData.failed_payments.toLocaleString("en-IN")}
          change={
            <>
              <ArrowUpRight size={14} />
              <span>
                {dashboardData.source.live_payments} live payments
              </span>
            </>
          }
          icon={AlertCircle}
        />

        <KpiCard
          label="Recovered payments"
          value={dashboardData.recovered_payments.toLocaleString("en-IN")}
          change={
            <>
              <ArrowUpRight size={14} />
              <span>
                {dashboardData.recovery_rate}% recovery rate
              </span>
            </>
          }
          icon={CheckCircle2}
          iconClass="bg-[rgba(22,163,74,0.09)] text-[#16a34a]"
        />

        <KpiCard
          label="Recovered revenue"
          value={formatCurrency(dashboardData.recovered_revenue)}
          change={
            <>
              <ArrowUpRight size={14} />
              <span>
                {dashboardData.pending_recovery} pending recovery
              </span>
            </>
          }
          icon={CircleDollarSign}
          iconClass="bg-[rgba(8,126,164,0.08)] text-[#087ea4]"
        />

        <KpiCard
          label="Avg. recovery probability"
          value={`${dashboardData.avg_recovery_probability.toFixed(1)}%`}
          change={
            <>
              <ArrowUpRight size={14} />
              <span>V3 engine prediction</span>
            </>
          }
          icon={Sparkles}
        />
      </section>

      {/* Recovery performance + engine intelligence */}
      <section className="mb-[14px] grid grid-cols-1 gap-[14px] xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,1fr)]">
        <RecoveryChart />

        <EngineIntelligence
          probability={dashboardData.avg_recovery_probability}
        />
      </section>

      {/* Activity */}
      <ActivityTable />
    </div>
  );
}

export default Dashboard;