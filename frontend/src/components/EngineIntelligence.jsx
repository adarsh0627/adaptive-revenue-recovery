import { Sparkles } from "lucide-react";

const actions = [
  ["Retry", "59.0%"],
  ["Payment Link", "52.1%"],
  ["Message", "45.6%"],
  ["Escalate", "49.7%"],
];

function EngineIntelligence({ probability = 59 }) {
  const safeProbability = Math.max(
    0,
    Math.min(100, Number(probability) || 0)
  );

  return (
    <div className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
      {/* Header */}
      <div className="flex min-h-[70px] items-center justify-between border-b border-[#e7e4ea] px-4 py-4 sm:px-[19px] sm:py-[17px]">
        <div>
          <h2 className="text-[13px] font-semibold tracking-[-0.2px]">
            Engine intelligence
          </h2>

          <p className="mt-[5px] text-[10px] text-[#6b6b75]">
            Current V3 recovery signals
          </p>
        </div>

        <Sparkles
          size={19}
          className="shrink-0 text-[#8c8794]"
        />
      </div>

      {/* Main intelligence */}
      <div className="flex flex-col items-center gap-5 px-4 py-6 sm:flex-row sm:px-5 sm:py-[22px]">

        {/* Probability ring */}
        <div
          className="grid h-[105px] w-[105px] shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(
              #5f259f ${safeProbability}%,
              #eeeaf1 0
            )`,
          }}
        >
          <div className="grid h-[84px] w-[84px] place-items-center rounded-full bg-white text-center">
            <div>
              <strong className="block text-[21px] text-[#4b1f7a]">
                {safeProbability.toFixed(0)}%
              </strong>

              <span className="text-[8px] text-[#6b6b75]">
                probability
              </span>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="min-w-0 text-center sm:text-left">
          <div className="text-[9px] uppercase tracking-[0.8px] text-[#6b6b75]">
            Recommended action
          </div>

          <div className="mt-1.5 text-[17px] font-bold text-[#5f259f]">
            Payment Link
          </div>

          <p className="mt-1.5 max-w-[230px] text-[10px] leading-[1.5] text-[#6b6b75]">
            Adaptive fallback selected after retry was unavailable.
          </p>
        </div>
      </div>

      {/* Action probabilities */}
      <div className="mx-4 border-t border-[#e7e4ea] sm:mx-5">
        {actions.map(([action, actionProbability]) => (
          <div
            key={action}
            className={`flex min-h-[38px] items-center justify-between border-b border-[#f0edf2] text-[10px] ${
              action === "Payment Link"
                ? "font-semibold text-[#5f259f]"
                : "text-[#6b6b75]"
            }`}
          >
            <span>{action}</span>
            <strong>{actionProbability}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EngineIntelligence;