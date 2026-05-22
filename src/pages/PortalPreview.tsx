// /portal-preview AND /my-submission/:token shell — the new premium
// customer portal experience.
//
// SAME COMPONENT serves two routes:
//
//   /portal-preview               → unauthenticated demo (no token in URL)
//   /my-submission/:token         → live customer portal after Sign In
//                                   lookup or Accept-Offer redirect
//
// • Sidebar + mobile top bar stay mounted across navigation.
// • Main content swaps in via Framer Motion AnimatePresence keyed by activeNav.
// • Sidebar links never open right-side drawers — drawers are reserved for
//   secondary actions inside each page (edit, upload, accept, etc).
//
// The shell wraps the whole tree in `PortalTokenProvider` so every
// page below can call `useSubmissionPortal()` (and friends) without
// re-reading the param. The shell itself ALSO calls the hook to
// drive the sidebar / topbar / AccountMenu customer chips — that
// guarantees the dealer name and customer identity match across
// every page, even ones that haven't been wired yet.
import { useState } from "react";
import { useParams } from "react-router-dom";
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
import SEO from "@/components/SEO";
import { PortalTokenProvider } from "@/contexts/PortalTokenContext";
import { useSubmissionPortal } from "@/hooks/portal/useSubmissionPortal";

// Inner shell — has access to usePortalToken / useSubmissionPortal
// because it's mounted under PortalTokenProvider.
const PortalShell = () => {
  const [activeNav, setActiveNavRaw] = useState<NavKey>("dashboard");

  // Wrap setActiveNav so every in-body navigation snaps the viewport
  // to the top before the new page mounts. Per PO direction: "no
  // lazy pages." Side slide-overs never change activeNav so they
  // never trigger the scroll.
  const setActiveNav = (next: NavKey) => {
    setActiveNavRaw(next);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    }
  };

  const { data: portalData } = useSubmissionPortal();

  // Sidebar / topbar / AccountMenu Customer shape. Falls back to MOCK
  // while the query is in flight so the chrome never flashes empty.
  // The downstream `Customer` type doesn't allow null email — coerce
  // to empty string. Email and dealer are display-only.
  const sidebarCustomer = portalData
    ? {
        name: portalData.customer.name,
        initials: portalData.customer.initials,
        dealer: portalData.customer.dealer,
        email: portalData.customer.email ?? "",
      }
    : MOCK.customer;

  const renderPage = () => {
    switch (activeNav) {
      case "dashboard": return <DashboardPage key="dashboard" onNavigate={setActiveNav} />;
      case "vehicles":  return <VehiclesPage  key="vehicles"  onNavigate={setActiveNav} />;
      case "offers":    return <OffersPage    key="offers"    onNavigate={setActiveNav} />;
      case "activity":  return <ActivityPage  key="activity"  onNavigate={setActiveNav} />;
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
      <PortalSidebar active={activeNav} onChange={setActiveNav} customer={sidebarCustomer} />

      <div className="flex-1 min-w-0 flex flex-col">
        <PortalMobileTopBar active={activeNav} onChange={setActiveNav} customer={sidebarCustomer} />

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
          <AccountMenu customer={sidebarCustomer} variant="desktop" onNavigate={(k) => setActiveNav(k as NavKey)} />
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

const PortalPreview = () => {
  const { token } = useParams<{ token: string }>();

  return (
    <PortalTokenProvider token={token}>
      <SEO
        title="Customer portal"
        description="Internal portal experience — not indexed."
        path={token ? `/my-submission/${token}` : "/portal-preview"}
        noindex
      />
      <PortalShell />
    </PortalTokenProvider>
  );
};

export default PortalPreview;
