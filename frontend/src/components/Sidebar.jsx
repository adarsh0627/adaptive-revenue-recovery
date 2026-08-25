import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import API_BASE_URL from "../api";

const navigation = [
  {
    section: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Failed Payments",
        icon: CreditCard,
      },
      {
        label: "Recovery Activity",
        icon: Activity,
      },
    ],
  },
  {
    section: "MONITORING",
    items: [
      {
        label: "Audit Trail",
        icon: ShieldCheck,
      },
      {
        label: "Analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      {
        label: "Settings",
        icon: Settings,
      },
    ],
  },
];

function Sidebar({ open = false, onClose }) {
  const [failedPaymentCount, setFailedPaymentCount] = useState(null);

  useEffect(() => {
    async function loadFailedPaymentCount() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/failed-payments?status=failed&page=1&page_size=1`
        );

        if (!response.ok) {
          throw new Error("Failed to load failed payment count");
        }

        const data = await response.json();

        setFailedPaymentCount(data.pagination?.total ?? 0);
      } catch (error) {
        console.error(
          "Failed to load sidebar payment count:",
          error
        );

        setFailedPaymentCount(null);
      }
    }

    loadFailedPaymentCount();
  }, []);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex min-h-screen w-[245px] flex-col border-r border-[#e7e4ea] bg-white transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-[76px] items-center justify-between border-b border-[#e7e4ea] px-[22px]">
          <div className="flex items-center gap-3">
            <div className="grid h-[35px] w-[35px] place-items-center rounded-[10px] bg-gradient-to-br from-[#5f259f] to-[#7b3fc6] text-white shadow-[0_7px_20px_rgba(95,37,159,0.22)]">
              <Sparkles size={19} />
            </div>

            <div>
              <div className="text-[14px] font-bold tracking-[-0.2px]">
                RevenueRecover
              </div>

              <div className="mt-0.5 text-[10px] text-[#6b6b75]">
                Adaptive Engine
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#6b6b75] hover:bg-[#f7f5f9] md:hidden"
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-[13px] py-[25px]">
          {navigation.map((group) => (
            <div key={group.section}>
              <div
                className={`mb-[9px] px-[11px] text-[9px] font-bold tracking-[1.2px] text-[#8a8791] ${
                  group.section !== "OVERVIEW" ? "mt-[25px]" : ""
                }`}
              >
                {group.section}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;

                const paths = {
                  Dashboard: "/",
                  "Failed Payments": "/failed-payments",
                  "Recovery Activity": "/recovery-activity",
                  "Audit Trail": "/audit-trail",
                  Analytics: "/analytics",
                  Settings: "/settings",
                };

                return (
                  <NavLink
                    to={paths[item.label]}
                    key={item.label}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `mb-1 flex h-[42px] items-center gap-[11px] rounded-lg px-[11px] text-[13px] no-underline transition ${
                        isActive
                          ? "border-l-[3px] border-[#5f259f] bg-[rgba(95,37,159,0.09)] pl-[8px] text-[#5f259f]"
                          : "text-[#6b6b75] hover:bg-[#faf8fc] hover:text-[#4b1f7a]"
                      }`
                    }
                  >
                    <Icon size={18} />

                    <span>{item.label}</span>

                    {/* Dynamic failed payment count */}
                    {item.label === "Failed Payments" &&
                      failedPaymentCount !== null && (
                        <span className="ml-auto grid min-w-[22px] place-items-center rounded-[5px] bg-[#f0edf4] px-1.5 py-1 text-[10px] text-[#6b6b75]">
                          {failedPaymentCount.toLocaleString("en-IN")}
                        </span>
                      )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Engine status */}
        <div className="mt-auto border-t border-[#e7e4ea] p-[15px]">
          <div className="flex items-center gap-2 rounded-[9px] border border-[#e7e4ea] bg-[#faf9fb] p-3">
            <span className="h-[7px] w-[7px] rounded-full bg-[#16a34a] shadow-[0_0_8px_rgba(22,163,74,0.45)]" />

            <div>
              <div className="text-[11px] text-[#45454f]">
                Recovery engine
              </div>

              <div className="mt-0.5 text-[10px] text-[#16a34a]">
                Operational
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;