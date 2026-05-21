import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Bell } from "lucide-react";
import { AccountMenu } from "@/components/portal/AccountMenu";
import { PortalSidebar, PortalMobileTopBar, type NavKey } from "@/components/portal/PortalSidebar";
import { PORTAL_MOCK as MOCK } from "@/components/portal/portalMock";
import DashboardPage from "@/components/portal/pages/DashboardPage";
import VehiclesPage from "@/components/portal/pages/VehiclesPage";
import OffersPage from "@/components/portal/pages/OffersPage";
import ActivityPage from "@/components/portal/pages/ActivityPage";
import MessagesPage from "@/components/portal/pages/MessagesPage";
import DocumentsPage from "@/components/portal/pages/DocumentsPage";
import AnalyticsPage from "@/components/portal/pages/AnalyticsPage";
import PaymentsPage from "@/components/portal/pages/PaymentsPage";
import PickupPage from "@/components/portal/pages/PickupPage";
import SettingsPage from "@/components/portal/pages/SettingsPage";

/* /portal-preview shell:
   • Sidebar + mobile top bar stay mounted across navigation.
   • Main content swaps in via Framer Motion AnimatePresence keyed by activeNav.
   • Sidebar links never open right-side drawers — drawers are reserved for
     secondary actions inside each page (edit, upload, accept, etc). */

const PortalPreview = () => {
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");

  const renderPage = () => {
    switch (activeNav) {
      case "dashboard": return <DashboardPage key="dashboard" onNavigate={setActiveNav} />;
      case "vehicles":  return <VehiclesPage  key="vehicles"  onNavigate={setActiveNav} />;
      case "offers":    return <OffersPage    key="offers"    onNavigate={setActiveNav} />;
      case "activity":  return <ActivityPage  key="activity"  />;
      case "messages":  return <MessagesPage  key="messages"  />;
      case "documents": return <DocumentsPage key="documents" />;
      case "analytics": return <AnalyticsPage key="analytics" />;
      case "payments":  return <PaymentsPage  key="payments"  />;
      case "pickup":    return <PickupPage    key="pickup"    />;
      case "settings":  return <SettingsPage  key="settings"  />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#06194A] flex">
      <PortalSidebar active={activeNav} onChange={setActiveNav} customer={MOCK.customer} />

      <div className="flex-1 min-w-0 flex flex-col">
        <PortalMobileTopBar active={activeNav} onChange={setActiveNav} customer={MOCK.customer} />

        {/* Desktop persistent user bar (search + bell + profile).
            Lives outside the page so it stays put across transitions. */}
        <div className="hidden lg:flex items-center justify-end gap-3 px-8 pt-5 pb-1">
          <button aria-label="Search" className="w-9 h-9 rounded-full hover:bg-white grid place-items-center text-[#53627A]">
            <Search className="w-[18px] h-[18px]" />
          </button>
          <button aria-label="Notifications" className="w-9 h-9 rounded-full hover:bg-white grid place-items-center text-[#53627A] relative">
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-[#F7F8FB]" />
          </button>
          <div className="flex items-center gap-2.5 pl-3 border-l border-[#E6EAF0]">
            <div className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#4F46E5] grid place-items-center text-xs font-semibold">
              {MOCK.customer.initials}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold text-[#06194A]">{MOCK.customer.name}</div>
              <div className="text-[11px] text-[#53627A]">{MOCK.customer.dealer}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#53627A]" />
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-[1320px] p-5 sm:p-7 lg:px-8 lg:pt-4 lg:pb-10">
            <AnimatePresence mode="wait">
              {renderPage()}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalPreview;
