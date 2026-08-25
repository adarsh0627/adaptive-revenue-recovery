import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  CircleCheck,
  KeyRound,
  Save,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Webhook,
} from "lucide-react";

const DEFAULT_SETTINGS = {
  merchantName: "RevenueRecover",
  email: "merchant@example.com",
  minProbability: "0.50",
  maxAttempts: "2",
  contactLimit: "2",
  approvalThreshold: "10000",
  webhookEnabled: true,
  notifications: true,
};

const STORAGE_KEY = "revenue-recover-settings";

function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);

        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
        });
      }
    } catch {
      // Keep default settings if local storage is unavailable/corrupted.
    }
  }, []);

  const updateSetting = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);
    } catch {
      setSaved(false);
    }
  };

  return (
    <div className="max-w-[1500px] p-4 sm:p-6 lg:p-[32px_34px_50px]">
      {/* Header */}
      <section className="mb-7">
        <p className="mb-2 text-[9px] font-extrabold tracking-[1.5px] text-[#5f259f]">
          SYSTEM
        </p>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.7px] sm:text-[25px]">
              Settings
            </h1>

            <p className="mt-2 text-[12px] text-[#6b6b75] sm:text-[13px]">
              Configure your merchant account and recovery engine.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="flex h-9 w-fit items-center gap-2 rounded-[7px] bg-[#5f259f] px-4 text-[11px] font-semibold text-white transition hover:bg-[#512087]"
          >
            {saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? "Saved" : "Save changes"}
          </button>
        </div>
      </section>

      {/* System status */}
      <section className="mb-5 rounded-[11px] border border-[#dcefe3] bg-[#f8fcf9] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-[#e8f7ed] text-[#16a34a]">
              <CircleCheck size={19} />
            </div>

            <div>
              <h2 className="text-[12px] font-semibold">
                Recovery engine operational
              </h2>

              <p className="mt-1 text-[10px] text-[#6b6b75]">
                Adaptive Recovery Engine V3 is running normally.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#16a34a]">
            <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
            Live
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Merchant profile */}
        <SettingsCard
          icon={User}
          title="Merchant profile"
          description="Basic information about your recovery account."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Merchant name"
              value={settings.merchantName}
              onChange={(value) => updateSetting("merchantName", value)}
            />

            <Field
              label="Email address"
              type="email"
              value={settings.email}
              onChange={(value) => updateSetting("email", value)}
            />
          </div>
        </SettingsCard>

        {/* Razorpay */}
        <SettingsCard
          icon={KeyRound}
          title="Razorpay connection"
          description="Payment provider configuration and connection status."
        >
          <div className="rounded-[9px] border border-[#e7e4ea] bg-[#faf9fb] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold">Razorpay API</p>

                <p className="mt-1 text-[10px] text-[#6b6b75]">
                  Connected using configured API credentials.
                </p>
              </div>

              <StatusBadge label="Connected" green />
            </div>
          </div>

          <div className="mt-3 rounded-[9px] border border-[#e7e4ea] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6b6b75]">
                Environment
              </span>

              <span className="text-[11px] font-semibold">Test mode</span>
            </div>
          </div>
        </SettingsCard>

        {/* Recovery engine */}
        <SettingsCard
          icon={SlidersHorizontal}
          title="Recovery engine"
          description="Configure recovery policy values used by the console."
        >
          <div className="space-y-5">
            <NumberSetting
              label="Minimum recovery probability"
              description="Actions below this probability are blocked."
              value={settings.minProbability}
              suffix="%"
              displayValue={`${Number(settings.minProbability) * 100}%`}
              min="0"
              max="1"
              step="0.01"
              onChange={(value) => updateSetting("minProbability", value)}
            />

            <NumberSetting
              label="Maximum recovery attempts"
              description="Maximum executable attempts for a payment."
              value={settings.maxAttempts}
              suffix="attempts"
              min="1"
              max="10"
              step="1"
              onChange={(value) => updateSetting("maxAttempts", value)}
            />

            <NumberSetting
              label="Contact limit"
              description="Maximum customer contacts allowed in the period."
              value={settings.contactLimit}
              suffix="contacts"
              min="1"
              max="10"
              step="1"
              onChange={(value) => updateSetting("contactLimit", value)}
            />

            <NumberSetting
              label="Merchant approval threshold"
              description="Amounts above this threshold require approval."
              value={settings.approvalThreshold}
              suffix="INR"
              min="0"
              step="100"
              onChange={(value) => updateSetting("approvalThreshold", value)}
            />
          </div>
        </SettingsCard>

        {/* Webhook */}
        <SettingsCard
          icon={Webhook}
          title="Webhook"
          description="Monitor incoming Razorpay payment events."
        >
          <div className="space-y-3">
            <ToggleRow
              label="Webhook receiver"
              description="Accept verified Razorpay webhook events."
              enabled={settings.webhookEnabled}
              onChange={(value) => updateSetting("webhookEnabled", value)}
            />

            <div className="rounded-[9px] border border-[#e7e4ea] bg-[#faf9fb] p-4">
              <div className="flex items-start gap-3">
                <Server
                  size={17}
                  className="mt-0.5 shrink-0 text-[#5f259f]"
                />

                <div className="min-w-0">
                  <p className="text-[10px] font-semibold">Endpoint</p>

                  <p className="mt-1 break-all font-mono text-[9px] text-[#6b6b75]">
                    /webhooks/razorpay
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[9px] border border-[#e7e4ea] p-4">
              <div>
                <p className="text-[10px] font-semibold">
                  Signature verification
                </p>

                <p className="mt-1 text-[9px] text-[#6b6b75]">
                  HMAC signature verification is enabled.
                </p>
              </div>

              <StatusBadge label="Verified" green />
            </div>
          </div>
        </SettingsCard>

        {/* Security */}
        <SettingsCard
          icon={ShieldCheck}
          title="Security"
          description="Security controls protecting recovery actions."
        >
          <div className="space-y-3">
            <SecurityRow
              title="Webhook signatures"
              description="Reject requests with invalid signatures."
            />

            <SecurityRow
              title="Guardrails"
              description="Block unsafe or unauthorized recovery actions."
            />

            <SecurityRow
              title="Audit logging"
              description="Record engine decisions and tool results."
            />
          </div>
        </SettingsCard>

        {/* Notifications */}
        <SettingsCard
          icon={Bell}
          title="Notifications"
          description="Choose when system notifications are enabled."
        >
          <ToggleRow
            label="Recovery notifications"
            description="Receive notifications for important recovery events."
            enabled={settings.notifications}
            onChange={(value) => updateSetting("notifications", value)}
          />

          <div className="mt-3 rounded-[9px] border border-[#e7e4ea] bg-[#faf9fb] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6b6b75]">
                Recovery completed
              </span>

              <span className="text-[10px] font-medium text-[#16a34a]">
                Enabled
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] text-[#6b6b75]">
                Merchant approval required
              </span>

              <span className="text-[10px] font-medium text-[#16a34a]">
                Enabled
              </span>
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* Bottom security notice */}
      <section className="mt-5 rounded-[11px] border border-[#e1d5eb] bg-[#faf7fd] p-4 sm:p-5">
        <div className="flex gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#f2eafa] text-[#5f259f]">
            <ShieldCheck size={17} />
          </div>

          <div>
            <h3 className="text-[12px] font-semibold">
              Guardrails remain active
            </h3>

            <p className="mt-1 max-w-[800px] text-[10px] leading-5 text-[#6b6b75]">
              Settings displayed here represent the recovery controls used by
              the console. High-value payments, low-probability actions,
              maximum attempts and contact limits remain protected by
              guardrails.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}) {
  return (
    <section className="rounded-[11px] border border-[#e7e4ea] bg-white">
      <div className="flex items-start gap-3 border-b border-[#e7e4ea] p-4 sm:p-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#f2eafa] text-[#5f259f]">
          <Icon size={17} />
        </div>

        <div>
          <h2 className="text-[13px] font-semibold">{title}</h2>

          <p className="mt-1 text-[10px] leading-4 text-[#6b6b75]">
            {description}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-medium text-[#55515b]">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-[7px] border border-[#e1dde5] bg-white px-3 text-[11px] outline-none transition focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/10"
      />
    </label>
  );
}

function NumberSetting({
  label,
  description,
  value,
  onChange,
  suffix,
  displayValue,
  min,
  max,
  step,
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium">{label}</p>

          <p className="mt-1 text-[9px] leading-4 text-[#85818c]">
            {description}
          </p>
        </div>

        <div className="flex shrink-0 items-center rounded-[7px] border border-[#e1dde5] bg-white">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-[78px] bg-transparent px-3 text-right text-[11px] font-semibold outline-none"
          />

          <span className="pr-3 text-[9px] text-[#85818c]">
            {displayValue || suffix}
          </span>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onChange,
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[9px] border border-[#e7e4ea] p-4">
      <div>
        <p className="text-[10px] font-semibold">{label}</p>

        <p className="mt-1 text-[9px] leading-4 text-[#6b6b75]">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          enabled ? "bg-[#5f259f]" : "bg-[#d8d4dc]"
        }`}
        aria-label={`Toggle ${label}`}
        aria-pressed={enabled}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function StatusBadge({
  label,
  green = false,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-semibold ${
        green
          ? "bg-[#eaf8ef] text-[#16a34a]"
          : "bg-[#f2eafa] text-[#5f259f]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          green ? "bg-[#16a34a]" : "bg-[#5f259f]"
        }`}
      />

      {label}
    </span>
  );
}

function SecurityRow({
  title,
  description,
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[9px] border border-[#e7e4ea] p-4">
      <div>
        <p className="text-[10px] font-semibold">{title}</p>

        <p className="mt-1 text-[9px] leading-4 text-[#6b6b75]">
          {description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 text-[9px] font-semibold text-[#16a34a]">
        <CircleCheck size={14} />
        Active
      </div>
    </div>
  );
}

export default Settings;