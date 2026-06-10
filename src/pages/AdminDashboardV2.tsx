/**
 * Admin V2 — the sleek/minimal next-generation dealer admin.
 *
 * Built alongside the classic AdminDashboard (V1) as its eventual
 * replacement. It reuses the *same* data layer (useAdminDashboard) and
 * the *same* content renderer (AdminSectionRenderer), so every classic
 * left-bar link and all existing functionality is retained verbatim —
 * only the chrome (sidebar, header, landing) is new. V1 is untouched and
 * remains the default at /admin; V2 lives at /admin/v2 for beta testers.
 *
 * The Command Center (a V2-only landing) renders for the synthetic
 * `command-center` section; every other section falls through to the
 * shared AdminSectionRenderer exactly as in V1.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformProvider } from "@/contexts/PlatformContext";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import TenantViewBanner from "@/components/admin/TenantViewBanner";
import AdminBreadcrumbNav from "@/components/admin/AdminBreadcrumb";
import AdminSectionRenderer from "@/components/admin/AdminSectionRenderer";
import AdminSidebarV2 from "@/components/admin/v2/AdminSidebarV2";
import AdminHeaderV2 from "@/components/admin/v2/AdminHeaderV2";
import AdminOverlays from "@/components/admin/v2/AdminOverlays";
import CommandCenter from "@/components/admin/v2/CommandCenter";
import AnalyticsView from "@/components/admin/v2/AnalyticsView";
import AvailabilityCenter from "@/components/admin/v2/AvailabilityCenter";
import MyBusiness from "@/components/admin/v2/MyBusiness";
import LaneDashboard from "@/components/admin/v2/LaneDashboard";
import ReleaseCenter from "@/components/admin/v2/ReleaseCenter";
import DealerNetwork from "@/components/admin/v2/DealerNetwork";
import ServiceDrive from "@/components/admin/v2/ServiceDrive";
import WebsiteWidget from "@/components/admin/v2/WebsiteWidget";
import VehicleCheckIn from "@/components/admin/v2/VehicleCheckIn";
import AppointmentsView from "@/components/admin/v2/AppointmentsView";
import StoreSettings from "@/components/admin/v2/StoreSettings";
import ReEngagement from "@/components/admin/v2/ReEngagement";
import AllLeadsV2 from "@/components/admin/v2/AllLeadsV2";
import AppraiserQueueV2 from "@/components/admin/v2/AppraiserQueueV2";
import BdcQueueV2 from "@/components/admin/v2/BdcQueueV2";
import PerformanceV2 from "@/components/admin/v2/PerformanceV2";
import ReportsV2 from "@/components/admin/v2/ReportsV2";
import { COMMAND_CENTER_KEY, ANALYTICS_KEY } from "@/components/admin/v2/adminNavV2";

const AdminDashboardV2 = () => {
  const db = useAdminDashboard();
  const { config: siteConfig } = useSiteConfig();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const contentRef = useRef<HTMLDivElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Land on the Command Center. The hook defaults to "submissions"; we
  // flip to the synthetic landing key once on mount.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    db.setActiveSection(COMMAND_CENTER_KEY);
  }, [db]);

  const baseSectionId = db.activeSection.includes(":")
    ? db.activeSection.split(":")[0]
    : db.activeSection;

  // Snap the page to the top whenever the section changes — instantly,
  // no smooth/lazy scroll. The content area is its own scroll container,
  // so reset both it and the window for every left-nav click.
  const snapToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    snapToTop();
  }, [db.activeSection, snapToTop]);

  // Drive every left-nav selection through here so the snap is immediate
  // on click (not just after the section-change effect settles).
  const goToSection = useCallback(
    (key: string) => {
      db.setActiveSection(key);
      snapToTop();
      requestAnimationFrame(snapToTop);
    },
    [db, snapToTop],
  );

  // Re-open the customer file slide-out when returning from the
  // inspection/appraisal pages (mirrors V1).
  useEffect(() => {
    if (db.selected || db.submissions.length === 0) return;
    const id = sessionStorage.getItem("autocurb:reopenSubmissionId");
    if (!id) return;
    const sub = db.submissions.find((s) => s.id === id);
    if (sub) {
      sessionStorage.removeItem("autocurb:reopenSubmissionId");
      db.handleView(sub);
    }
  }, [db.submissions, db.selected, db.handleView, db]);

  const onCommandCenter = baseSectionId === COMMAND_CENTER_KEY;
  const onAnalytics = baseSectionId === ANALYTICS_KEY;
  // V2-only redesigned surfaces that bypass the shared section renderer.
  const onAvailability = baseSectionId === "my-availability";
  const onMyBusiness = baseSectionId === "my-business";
  const onLaneDashboard = baseSectionId === "lane-dashboard";
  const onReleaseCenter = baseSectionId === "changelog";
  const onDealerNetwork = baseSectionId === "tenants" && isPlatformAdmin;
  const onServiceDrive = baseSectionId === "service-quick-entry";
  const onWebsiteWidget = baseSectionId === "trade-widget";
  const onVehicleCheckIn = baseSectionId === "inspection-checkin";
  const onAppointments = baseSectionId === "accepted-appts";
  const onStoreSettings = baseSectionId === "store-settings-hub";
  const onReEngagement = baseSectionId === "reengagement";
  const onAllLeads = baseSectionId === "submissions";
  const onAppraiserQueue = baseSectionId === "appraiser-queue";
  const onBdcQueue = baseSectionId === "bdc-hub" || baseSectionId === "bdc-queue" || baseSectionId === "bdc-calls";
  const onPerformance = ["performance", "executive", "gm-hud", "bdc-health", "manager-dispatch"].includes(baseSectionId);
  const onReports = baseSectionId === "reports";
  const onV2Custom = onCommandCenter || onAnalytics || onAvailability || onMyBusiness || onLaneDashboard || onReleaseCenter || onDealerNetwork || onServiceDrive || onWebsiteWidget || onVehicleCheckIn || onAppointments || onStoreSettings || onReEngagement || onAllLeads || onAppraiserQueue || onBdcQueue || onPerformance || onReports;

  return (
    <PlatformProvider>
      <TenantViewBanner />
      <div className="admin-v2-scope flex min-h-screen w-full bg-[#F4F6FA] text-[#06194A]">
        <AdminSidebarV2
          activeKey={baseSectionId}
          onSelect={goToSection}
          brandName={db.tenant.display_name}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
          allowedSections={db.allowedSections}
          isPlatformAdmin={isPlatformAdmin}
          isReceptionist={db.userRole === "receptionist"}
          enterpriseBetaEnabled={Boolean((siteConfig as { enterprise_beta_enabled?: boolean }).enterprise_beta_enabled)}
          locationCount={db.dealerLocations.length}
          submissionCount={db.total}
          appointmentCount={db.appointments.length}
          appraiserQueueCount={db.appraiserQueueCount}
          teamBadgeCount={db.pendingRequests.length + db.permissionRequestCount}
          pricingAccessRequestCount={db.pricingAccessRequestCount}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeaderV2
            userName={db.userName}
            userRole={db.userRole}
            dealerName={db.tenant.display_name}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onLogout={async () => {
              await supabase.auth.signOut();
              db.navigate("/admin/login");
            }}
          />

          <main ref={contentRef} className="flex-1 overflow-auto px-4 py-6 md:px-8">
            <div className="mx-auto max-w-[1320px]">
              {onV2Custom ? (
                onAnalytics ? (
                  <AnalyticsView db={db} onNavigate={db.setActiveSection} />
                ) : onAvailability ? (
                  <AvailabilityCenter userEmail={db.userEmail} />
                ) : onMyBusiness ? (
                  <MyBusiness staffName={db.userName} userEmail={db.userEmail} />
                ) : onLaneDashboard ? (
                  <LaneDashboard db={db} onNavigate={db.setActiveSection} />
                ) : onReleaseCenter ? (
                  <ReleaseCenter canManage={isPlatformAdmin} />
                ) : onServiceDrive ? (
                  <ServiceDrive db={db} onNavigate={db.setActiveSection} />
                ) : onWebsiteWidget ? (
                  <WebsiteWidget db={db} onNavigate={db.setActiveSection} />
                ) : onVehicleCheckIn ? (
                  <VehicleCheckIn db={db} onNavigate={db.setActiveSection} />
                ) : onAppointments ? (
                  <AppointmentsView db={db} />
                ) : onStoreSettings ? (
                  <StoreSettings db={db} />
                ) : onReEngagement ? (
                  <ReEngagement db={db} />
                ) : onAllLeads ? (
                  <AllLeadsV2 db={db} />
                ) : onAppraiserQueue ? (
                  <AppraiserQueueV2 userRole={db.userRole} isAppraiser={db.isAppraiser} />
                ) : onBdcQueue ? (
                  <BdcQueueV2
                    initialTab={baseSectionId === "bdc-calls" ? "calls" : "priority"}
                    onOpenSubmission={(id) => { const s = db.submissions.find((x) => x.id === id); if (s) db.handleView(s); }}
                  />
                ) : onPerformance ? (
                  <PerformanceV2
                    db={db}
                    initialTab={baseSectionId === "gm-hud" ? "hud" : baseSectionId === "bdc-health" ? "bdc" : baseSectionId === "manager-dispatch" ? "dispatch" : "kpi"}
                  />
                ) : onReports ? (
                  <ReportsV2 />
                ) : onDealerNetwork ? (
                  <DealerNetwork
                    onNavigate={db.setActiveSection}
                    onSetupDealer={(id, name) => {
                      db.setOnboardingDealershipId(id);
                      db.setOnboardingDealerName(name);
                      db.setActiveSection("onboarding");
                    }}
                  />
                ) : (
                  <CommandCenter db={db} onNavigate={db.setActiveSection} />
                )
              ) : (
                <>
                  <div className="mb-4">
                    <AdminBreadcrumbNav
                      activeSection={baseSectionId}
                      onNavigate={db.setActiveSection}
                    />
                  </div>
                  <AdminSectionRenderer
                    activeSection={db.activeSection}
                    setActiveSection={db.setActiveSection}
                    submissions={db.submissions}
                    loading={db.loading}
                    search={db.search}
                    setSearch={db.setSearch}
                    statusFilter={db.statusFilter}
                    setStatusFilter={db.setStatusFilter}
                    sourceFilter={db.sourceFilter}
                    setSourceFilter={db.setSourceFilter}
                    storeFilter={db.storeFilter}
                    setStoreFilter={db.setStoreFilter}
                    dateRangeFilter={db.dateRangeFilter}
                    setDateRangeFilter={db.setDateRangeFilter}
                    showFilterPanel={db.showFilterPanel}
                    setShowFilterPanel={db.setShowFilterPanel}
                    page={db.page}
                    total={db.total}
                    setPage={db.setPage}
                    dealerLocations={db.dealerLocations}
                    canApprove={db.canApprove}
                    canDelete={db.canDelete}
                    canManageAccess={db.canManageAccess}
                    auditLabel={db.auditLabel}
                    userName={db.userName}
                    userRole={db.userRole}
                    isAppraiser={db.isAppraiser}
                    userId={db.userId}
                    appointments={db.appointments}
                    setAppointments={db.setAppointments}
                    pendingRequests={db.pendingRequests}
                    approveRole={db.approveRole}
                    setApproveRole={db.setApproveRole}
                    onboardingDealershipId={db.onboardingDealershipId}
                    setOnboardingDealershipId={db.setOnboardingDealershipId}
                    onboardingDealerName={db.onboardingDealerName}
                    setOnboardingDealerName={db.setOnboardingDealerName}
                    tenant={db.tenant}
                    handleView={db.handleView}
                    handleDelete={db.handleDelete}
                    handleInlineStatusChange={db.handleInlineStatusChange}
                    handleApprove={db.handleApprove}
                    handleReject={db.handleReject}
                    fetchSubmissions={db.fetchSubmissions}
                    fetchAppointments={db.fetchAppointments}
                    toast={db.toast}
                  />
                </>
              )}
            </div>
          </main>
        </div>

        <AdminOverlays db={db} />
      </div>
    </PlatformProvider>
  );
};

export default AdminDashboardV2;
