import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import Dashboard from "./pages/Dashboard";
import FailedPayments from "./pages/FailedPayments";
import RecoveryActivity from "./pages/RecoveryActivity";
import AuditTrail from "./pages/AuditTrail";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import PaymentDetails from "./pages/PaymentDetails";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#f7f7fa] text-[#1a1a1a]">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="min-h-screen md:ml-[245px]">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/failed-payments" element={<FailedPayments />} />
            <Route
              path="/recovery-activity"
              element={<RecoveryActivity />}
            />
            <Route path="/audit-trail" element={<AuditTrail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/failed-payments/:paymentId"
              element={<PaymentDetails />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;