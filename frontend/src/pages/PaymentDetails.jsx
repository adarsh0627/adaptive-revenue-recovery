import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  XCircle,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8001";

const statusStyles = {
  Failed: "bg-[rgba(220,38,38,0.08)] text-[#dc2626]",
  Recovered: "bg-[rgba(22,163,74,0.09)] text-[#16a34a]",
  Pending: "bg-[rgba(245,158,11,0.1)] text-[#d97706]",
  Stopped: "bg-[rgba(112,112,122,0.08)] text-[#70707a]",
};

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

function formatDateTime(timestamp) {
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

function getTimelineIcon(event) {
  const status = event.status;

  if (event.event?.toLowerCase().includes("failure")) {
    return {
      icon: XCircle,
      danger: true,
      success: false,
    };
  }

  if (status === "success") {
    return {
      icon: CheckCircle2,
      danger: false,
      success: true,
    };
  }

  if (status === "pending") {
    return {
      icon: Clock3,
      danger: false,
      success: false,
    };
  }

  return {
    icon: Sparkles,
    danger: false,
    success: false,
  };
}

function PaymentDetails() {
  const { paymentId } = useParams();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPayment() {
      if (!paymentId) {
        setError("Payment ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/failed-payments/${encodeURIComponent(
            paymentId
          )}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Payment not found");
          }

          throw new Error(
            `Request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        if (!data.payment) {
          throw new Error("Payment data is missing");
        }

        setPayment(data.payment);
        setTimeline(data.timeline || []);
      } catch (err) {
        console.error("Payment details error:", err);

        setPayment(null);
        setTimeline([]);

        setError(
          err.message === "Payment not found"
            ? "This payment could not be found."
            : "Unable to load this payment. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    loadPayment();
  }, [paymentId]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-2 text-[11px] text-[#6b6b75]">
          <Loader2
            size={18}
            className="animate-spin text-[#5f259f]"
          />
          Loading payment details...
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="p-4 sm:p-6 lg:p-[32px_34px_50px]">
        <button
          onClick={() => navigate("/failed-payments")}
          className="mb-6 flex items-center gap-2 text-[11px] font-medium text-[#5f259f]"
        >
          <ArrowLeft size={15} />
          Back to failed payments
        </button>

        <div className="rounded-[11px] border border-[#e7e4ea] bg-white p-10 text-center">
          <XCircle
            size={32}
            className="mx-auto mb-3 text-[#dc2626]"
          />

          <h1 className="text-[15px] font-semibold text-[#25232a]">
            Payment not found
          </h1>

          <p className="mt-2 text-[11px] text-[#6b6b75]">
            {error}
          </p>
        </div>
      </div>
    );
  }

  const probability = Number(payment.probability || 0);

  const isRecovered = payment.status === "Recovered";

  return (
    <div className="max-w-[1500px] p-4 sm:p-6 lg:p-[32px_34px_50px]">
      {/* BACK */}

      <button
        onClick={() => navigate("/failed-payments")}
        className="mb-5 flex items-center gap-2 text-[11px] font-medium text-[#5f259f] hover:text-[#4b1f7a]"
      >
        <ArrowLeft size={15} />
        Back to failed payments
      </button>

      {/* HEADER */}

      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[9px] font-extrabold tracking-[1.5px] text-[#5f259f]">
            PAYMENT DETAILS
          </p>

          <h1 className="text-[22px] font-bold tracking-[-0.7px] sm:text-[25px]">
            Payment Recovery
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#6b6b75]">
            <WalletCards size={13} />

            <span className="font-mono">
              {payment.payment_id}
            </span>

            <span>•</span>

            <span>{formatDate(payment.timestamp)}</span>
          </div>
        </div>

        <span
          className={`w-fit rounded-[6px] px-3 py-1.5 text-[9px] font-bold ${
            statusStyles[payment.status] ||
            "bg-[#f5f3f6] text-[#70707a]"
          }`}
        >
          {payment.status}
        </span>
      </section>

      {/* TOP CARDS */}

      <section className="mb-[14px] grid grid-cols-1 gap-[14px] sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Payment amount"
          value={formatCurrency(payment.amount)}
          icon={WalletCards}
        />

        <InfoCard
          label="Recovery probability"
          value={`${probability.toFixed(1)}%`}
          icon={Sparkles}
          iconClass="bg-[rgba(95,37,159,0.08)] text-[#5f259f]"
        />

        <InfoCard
          label="Payment method"
          value={payment.payment_method}
          icon={ShieldCheck}
          iconClass="bg-[rgba(8,126,164,0.08)] text-[#087ea4]"
        />

        <InfoCard
          label="Recovery action"
          value={payment.action}
          icon={CheckCircle2}
          iconClass="bg-[rgba(22,163,74,0.09)] text-[#16a34a]"
        />
      </section>

      {/* MAIN CONTENT */}

      <section className="grid grid-cols-1 gap-[14px] xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,1fr)]">
        {/* PAYMENT INFORMATION */}

        <div className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
          <div className="border-b border-[#e7e4ea] px-4 py-4 sm:px-[19px] sm:py-[17px]">
            <h2 className="text-[13px] font-semibold">
              Payment information
            </h2>

            <p className="mt-[5px] text-[10px] text-[#6b6b75]">
              Original payment and failure information
            </p>
          </div>

          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
            <DetailRow
              label="Payment ID"
              value={payment.payment_id}
              mono
            />

            <DetailRow
              label="Customer ID"
              value={
                payment.customer_id || "Not available"
              }
            />

            <DetailRow
              label="Amount"
              value={formatCurrency(payment.amount)}
            />

            <DetailRow
              label="Payment method"
              value={payment.payment_method}
            />

            <DetailRow
              label="Failure reason"
              value={payment.failure_reason}
            />

            <DetailRow
              label="Payment timestamp"
              value={formatDateTime(payment.timestamp)}
            />

            <DetailRow
              label="Recovery action"
              value={payment.action}
            />

            <DetailRow
              label="Data source"
              value={
                payment.source === "live"
                  ? "Live Razorpay"
                  : "Historical dataset"
              }
            />
          </div>
        </div>

        {/* RECOVERY INTELLIGENCE */}

        <div className="overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
          <div className="border-b border-[#e7e4ea] px-4 py-4 sm:px-[19px] sm:py-[17px]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold">
                  Recovery intelligence
                </h2>

                <p className="mt-[5px] text-[10px] text-[#6b6b75]">
                  V3 engine decision
                </p>
              </div>

              <Sparkles
                size={18}
                className="text-[#5f259f]"
              />
            </div>
          </div>

          <div className="p-5">
            {/* PROBABILITY */}

            <div className="flex items-center gap-4">
              <div
                className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-full bg-[conic-gradient(#5f259f_var(--progress),#eeeaf1_0)]"
                style={{
                  "--progress": `${probability}%`,
                }}
              >
                <div className="grid h-[70px] w-[70px] place-items-center rounded-full bg-white text-center">
                  <div>
                    <strong className="block text-[18px] text-[#4b1f7a]">
                      {probability.toFixed(0)}%
                    </strong>

                    <span className="text-[8px] text-[#6b6b75]">
                      probability
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-[0.8px] text-[#85818c]">
                  Recommended action
                </p>

                <h3 className="mt-1 text-[17px] font-bold text-[#5f259f]">
                  {payment.action}
                </h3>

                <p className="mt-1.5 text-[10px] leading-[1.5] text-[#6b6b75]">
                  The recovery engine selected this action
                  based on the payment failure signals.
                </p>
              </div>
            </div>

            {/* SIGNAL */}

            <div className="mt-6 rounded-[8px] border border-[#eeeaf1] bg-[#faf8fc] p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck
                  size={15}
                  className="mt-0.5 shrink-0 text-[#5f259f]"
                />

                <div>
                  <p className="text-[10px] font-semibold text-[#45454f]">
                    Failure signal
                  </p>

                  <p className="mt-1 text-[9px] leading-[1.5] text-[#6b6b75]">
                    {payment.failure_reason}
                  </p>
                </div>
              </div>
            </div>

            {/* RESULT */}

            <div className="mt-3 flex items-center justify-between border-t border-[#eeeaf1] pt-4">
              <div className="flex items-center gap-2">
                {isRecovered ? (
                  <CheckCircle2
                    size={16}
                    className="text-[#16a34a]"
                  />
                ) : (
                  <Clock3
                    size={16}
                    className="text-[#d97706]"
                  />
                )}

                <span className="text-[10px] text-[#6b6b75]">
                  Current recovery status
                </span>
              </div>

              <strong
                className={`text-[10px] ${
                  isRecovered
                    ? "text-[#16a34a]"
                    : "text-[#d97706]"
                }`}
              >
                {payment.status}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* RECOVERY TIMELINE */}

      <section className="mt-[14px] overflow-hidden rounded-[11px] border border-[#e7e4ea] bg-white">
        <div className="border-b border-[#e7e4ea] px-4 py-4 sm:px-[19px] sm:py-[17px]">
          <h2 className="text-[13px] font-semibold">
            Recovery timeline
          </h2>

          <p className="mt-[5px] text-[10px] text-[#6b6b75]">
            Actual recovery events associated with this payment
          </p>
        </div>

        <div className="p-5">
          {timeline.length === 0 ? (
            <div className="py-8 text-center text-[10px] text-[#85818c]">
              No recovery events recorded.
            </div>
          ) : (
            timeline.map((event, index) => {
              const timelineIcon = getTimelineIcon(event);

              return (
                <TimelineItem
                  key={`${event.timestamp}-${index}`}
                  icon={timelineIcon.icon}
                  title={event.event}
                  description={event.description}
                  timestamp={event.timestamp}
                  danger={timelineIcon.danger}
                  success={timelineIcon.success}
                  last={index === timeline.length - 1}
                />
              );
            })
          )}
        </div>
      </section>

      {/* SOURCE */}

      <div className="mt-4 flex items-center gap-2 text-[9px] text-[#85818c]">
        <ExternalLink size={12} />

        <span>
          Source:{" "}
          {payment.source === "live"
            ? "Live Razorpay recovery state"
            : "Historical payments dataset"}
        </span>
      </div>
    </div>
  );
}

function InfoCard({
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

      <div className="mt-4 truncate text-[17px] font-bold tracking-[-0.3px] text-[#25232a]">
        {value}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}) {
  return (
    <div className="border-b border-[#f0edf2] px-4 py-4 sm:px-5">
      <p className="text-[8px] font-bold uppercase tracking-[0.7px] text-[#85818c]">
        {label}
      </p>

      <p
        className={`mt-1.5 text-[10px] text-[#45454f] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TimelineItem({
  icon: Icon,
  title,
  description,
  timestamp,
  danger = false,
  success = false,
  last = false,
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            danger
              ? "bg-[rgba(220,38,38,0.08)] text-[#dc2626]"
              : success
              ? "bg-[rgba(22,163,74,0.09)] text-[#16a34a]"
              : "bg-[rgba(95,37,159,0.08)] text-[#5f259f]"
          }`}
        >
          <Icon size={15} />
        </div>

        {!last && (
          <div className="mt-1 min-h-[40px] w-px bg-[#e7e4ea]" />
        )}
      </div>

      <div className="pb-6">
        <p className="text-[10px] font-semibold text-[#45454f]">
          {title}
        </p>

        <p className="mt-1 text-[9px] leading-[1.5] text-[#6b6b75]">
          {description}
        </p>

        <p className="mt-1.5 text-[8px] text-[#aaa6b0]">
          {formatDateTime(timestamp)}
        </p>
      </div>
    </div>
  );
}

export default PaymentDetails;