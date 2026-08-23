import { useEffect, useState } from "react";
import { ArrowUpRight, WalletCards } from "lucide-react";

const API_BASE_URL = "http://127.0.0.1:8001";

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

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Unknown";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(
    0,
    Math.floor(diffMs / (1000 * 60))
  );

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ActivityTable() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchActivities() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE_URL}/api/recovery-activity`
        );

        if (!response.ok) {
          throw new Error(
            `API request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        setActivities(data.activities || []);
      } catch (err) {
        console.error("Recovery activity API error:", err);
        setError("Unable to load recovery activity.");
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, []);

  return (
    <div className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">

      {/* Header */}
      <div className="flex min-h-[70px] items-center justify-between border-b border-[#e7e4ea] px-4 py-4 sm:px-[19px] sm:py-[17px]">
        <div>
          <h2 className="text-[13px] font-semibold">
            Recent recovery activity
          </h2>

          <p className="mt-[5px] text-[10px] text-[#6b6b75]">
            Latest actions performed by the recovery agent
          </p>
        </div>

        <button className="flex shrink-0 items-center gap-1 border-0 bg-transparent text-[10px] text-[#5f259f]">
          View all
          <ArrowUpRight size={15} />
        </button>
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
          <div className="flex min-h-[150px] items-center justify-center">
            <span className="text-[11px] text-[#6b6b75]">
              No recovery activity yet.
            </span>
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
                <span>PAYMENT</span>
                <span>ACTION</span>
                <span>AMOUNT</span>
                <span>STATUS</span>
                <span>TIME</span>
              </div>

              {/* Rows */}
              {activities.slice(0, 5).map((item) => (
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
                      {item.id}
                    </span>
                  </div>

                  {/* Action */}
                  <span className="text-[#45454f]">
                    {item.action}
                  </span>

                  {/* Amount */}
                  <strong className="text-[10px] text-[#25232a]">
                    {formatCurrency(item.amount)}
                  </strong>

                  {/* Status */}
                  <span
                    className={`w-fit rounded-[5px] px-[7px] py-1 text-[8px] font-bold ${
                      statusStyles[item.status] ||
                      "bg-[#f5f3f6] text-[#6b6b75]"
                    }`}
                  >
                    {item.status}
                  </span>

                  {/* Time */}
                  <span className="text-[#85818c]">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

export default ActivityTable;