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
import { useEffect, useRef, useState } from "react";
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
import ReferralCenter from "@/components/admin/v2/ReferralCenter";
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

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [db.activeSection]);

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
  const onReferrals = baseSectionId === "my-referrals";
  const onV2Custom = onCommandCenter || onAnalytics || onAvailability || onReferrals;

  return (
    <PlatformProvider>
      <TenantViewBanner />
      <div className="flex min-h-screen w-full bg-[#F4F6FA] text-[#06194A]">
        <AdminSidebarV2
          activeKey={baseSectionId}
          onSelect={db.setActiveSection}
          brandName={db.tenant.display_name}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
          allowedSections={db.allowedSections}
          isPlatformAdmin={isPlatformAdmin}
          isReceptionist={db.userRole === "receptionist"}
          enterpriseBetaEnabled={Boolean((siteConfig as any).enterprise_beta_enabled)}
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
                ) : onReferrals ? (
                  <ReferralCenter staffName={db.userName} userEmail={db.userEmail} />
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
