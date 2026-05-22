// /portal-preview AND /my-submission/:token shell — the new premium
// customer portal experience.
//
// SAME COMPONENT serves two routes:
//
//   /portal-preview               → unauthenticated demo (no token in URL)
//   /my-submission/:token         → live customer portal after Sign In
//                                   lookup or Accept-Offer redirect
//
// Both render identical mock-driven UI today. The token is read from
// useParams and stashed (currently unused) so that when the data-wire
// PR lands, every page below this shell receives the token via context
// without a structural refactor.
//
// • Sidebar + mobile top bar stay mounted across navigation.
// • Main content swaps in via Framer Motion AnimatePresence keyed by activeNav.
// • Sidebar links never open right-side drawers — drawers are reserved for
//   secondary actions inside each page (edit, upload, accept, etc).
//
// IMPORTANT (mock data warning):
// This route renders fully static mock customer data (Alex Morgan /
// Liberty Automotive / fake VIN + bank details from
// src/components/portal/portalMock.ts). The technical review's P0 #1
// flagged this — the product owner accepted the trade-off and chose
// to ship the new portal experience for all tenants while real data
// wiring is in flight. Per CustomerPortal.tsx the route is already
// `noindex`'d so it doesn't leak via search.
//
// The legacy submission-aware portal stays available at
// /my-submission-legacy/:token (renders the same `CustomerPortalLegacy`
// component this file replaces in the live dispatch).
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

const PortalPreview = () => {
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");

  // Plumbed for the data-wire PR. When real data lands every page
  // below this shell will switch from `PORTAL_MOCK` to a token-scoped
  // query (`useSubmissionPortal(token)` etc.). For now the token is
  // read here so that route changes always re-render the shell and
  // the React tree stays consistent between demo and live routes.
  const { token } = useParams<{ token: string }>();

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
      <SEO
        title="Customer portal"
        description="Internal portal experience — not indexed."
        path={token ? `/my-submission/${token}` : "/portal-preview"}
        noindex
      />
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
          <AccountMenu customer={MOCK.customer} variant="desktop" onNavigate={(k) => setActiveNav(k as NavKey)} />

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
