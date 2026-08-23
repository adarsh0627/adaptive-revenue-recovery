import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

const API_BASE_URL = "http://127.0.0.1:8001";

function RecoveryChart() {
  const [values, setValues] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPerformance() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE_URL}/api/recovery-performance`
        );

        if (!response.ok) {
          throw new Error(
            `API request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        setValues(data.values || []);
        setLabels(data.labels || []);
      } catch (err) {
        console.error(
          "Recovery performance API error:",
          err
        );

        setError(
          "Unable to load recovery performance."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPerformance();
  }, []);

  return (
    <div className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
      {/* Header */}
      <div className="flex min-h-[70px] items-center justify-between border-b border-[#e7e4ea] px-4 py-4 sm:px-[19px] sm:py-[17px]">
        <div>
          <h2 className="text-[13px] font-semibold tracking-[-0.2px]">
            Recovery performance
          </h2>

          <p className="mt-[5px] text-[10px] text-[#6b6b75]">
            Recovery rate across available payment history
          </p>
        </div>

        <BarChart3
          size={19}
          className="shrink-0 text-[#8c8794]"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex h-[280px] items-center justify-center">
          <span className="text-[11px] text-[#6b6b75]">
            Loading performance...
          </span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex h-[280px] items-center justify-center">
          <span className="text-[11px] text-[#dc2626]">
            {error}
          </span>
        </div>
      )}

      {/* Empty */}
      {!loading &&
        !error &&
        values.length === 0 && (
          <div className="flex h-[280px] items-center justify-center">
            <span className="text-[11px] text-[#6b6b75]">
              No performance data available.
            </span>
          </div>
        )}

      {/* Chart */}
      {!loading &&
        !error &&
        values.length > 0 && (
          <div className="flex h-[250px] px-3 pb-4 pt-5 sm:h-[280px] sm:px-5 sm:pb-[18px] sm:pt-[25px]">

            {/* Y axis */}
            <div className="flex w-[32px] shrink-0 flex-col justify-between pb-[18px] text-[8px] text-[#85818c] sm:w-[42px] sm:text-[9px]">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>

            {/* Graph */}
            <div className="relative min-w-0 flex-1 pb-5">

              {/* Grid */}
              {[0, 25, 50, 75, 100].map(
                (position) => (
                  <div
                    key={position}
                    className="absolute left-0 right-0 border-t border-dashed border-[#e9e6ed]"
                    style={{
                      top: `${position}%`,
                    }}
                  />
                )
              )}

              {/* Bars */}
              <div className="relative z-10 flex h-full items-end justify-around gap-1 sm:gap-2">
                {values.map((value, index) => (
                  <div
                    key={labels[index] || index}
                    className="flex h-full min-w-0 max-w-[42px] flex-1 flex-col items-center justify-end"
                  >
                    <div
                      className="w-[65%] min-h-[7px] rounded-t-[5px] rounded-b-[2px] bg-gradient-to-b from-[#7b3fc6] to-[#5f259f] shadow-[0_5px_18px_rgba(95,37,159,0.14)]"
                      style={{
                        height: `${Math.min(
                          100,
                          Math.max(0, value)
                        )}%`,
                      }}
                    />

                    <span className="mt-2 text-[7px] text-[#85818c] sm:text-[8px]">
                      {labels[index]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default RecoveryChart;