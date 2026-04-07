import { SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminBreadcrumbNav from "@/components/admin/AdminBreadcrumb";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";
import AdminSectionRenderer from "@/components/admin/AdminSectionRenderer";
import RequestAccessDialog from "@/components/admin/RequestAccessDialog";
import SubmissionDetailSheet from "@/components/admin/SubmissionDetailSheet";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useRef, useEffect } from "react";

const AdminDashboard = () => {
  const db = useAdminDashboard();
  const contentRef = useRef<HTMLDivElement>(null);
  // Strip ":fieldHint" for sidebar/breadcrumb matching
  const baseSectionId = db.activeSection.includes(":") ? db.activeSection.split(":")[0] : db.activeSection;

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [db.activeSection]);
  return (
    <SidebarProvider>
        <div className="min-h-screen bg-background transition-colors duration-300 flex w-full relative">
          {/* Subtle grid pattern for premium depth */}
          <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--border)/0.5)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-30 dark:opacity-10" />
        <AdminSidebar
          activeSection={baseSectionId}
          onSectionChange={db.setActiveSection}
          canManageAccess={db.canManageAccess}
          submissionCount={db.total}
          appointmentCount={db.appointments.length}
          pendingRequestCount={db.pendingRequests.length}
          permissionRequestCount={db.permissionRequestCount}
          pricingAccessRequestCount={db.pricingAccessRequestCount}
          allowedSections={db.allowedSections}
          showRequestAccess={db.showRequestAccessToggle && !db.canManageAccess}
          onRequestAccess={() => db.setShowRequestAccessDialog(true)}
          locationCount={db.dealerLocations.length}
          userRole={db.userRole}
          dealershipId={db.tenant.dealership_id}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader
            darkMode={db.darkMode}
            setDarkMode={db.setDarkMode}
            userRole={db.userRole}
            userName={db.userName}
            isPlatformAdmin={db.userRole === "admin" && db.tenant.dealership_id === "default"}
            onLogout={async () => {
              await supabase.auth.signOut();
              db.navigate("/admin/login");
            }}
          />

          <div ref={contentRef} className="flex-1 px-3 md:px-4 py-4 md:py-6 overflow-auto">
            <div className="max-w-[1400px] mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <AdminBreadcrumbNav activeSection={baseSectionId} onNavigate={db.setActiveSection} />
                <kbd
                  className="hidden md:inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground cursor-pointer"
                  onClick={() => {
                    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
                  }}
                >
                  ⌘K
                </kbd>
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
            </div>
          </div>
        </div>

        {db.userId && (
          <RequestAccessDialog
            open={db.showRequestAccessDialog}
            onOpenChange={db.setShowRequestAccessDialog}
            userId={db.userId}
          />
        )}

        <AdminCommandPalette
          onNavigate={db.setActiveSection}
          onViewSubmission={db.handleView}
          submissions={db.submissions}
          allowedSections={db.allowedSections}
        />

        <SubmissionDetailSheet
          selected={db.selected}
          onClose={() => {
            db.setSelected(null);
            db.setPhotos([]);
            db.setDocs([]);
          }}
          photos={db.photos}
          docs={db.docs}
          activityLog={db.activityLog}
          duplicateWarnings={db.duplicateWarnings}
          optOutStatus={db.optOutStatus}
          selectedApptTime={db.selectedApptTime}
          selectedApptLocation={db.selectedApptLocation}
          dealerLocations={db.dealerLocations}
          canSetPrice={db.canSetPrice}
          canApprove={db.canApprove}
          canDelete={db.canDelete}
          canUpdateStatus={true}
          auditLabel={db.auditLabel}
          userName={db.userName}
          onUpdate={(updated) =>
            db.setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
          }
          onDelete={db.handleDelete}
          onRefresh={db.handleView}
          onScheduleAppointment={db.handleScheduleAppt}
          onDeletePhoto={async (fileName) => {
            if (!db.selected || !db.canDelete) return;
            if (!confirm(`Delete photo "${fileName}"?`)) return;
            const { error } = await supabase.storage
              .from("submission-photos")
              .remove([`${db.selected.token}/${fileName}`]);
            if (!error) {
              db.setPhotos((prev) => prev.filter((p) => p.name !== fileName));
              db.toast({ title: "Deleted" });
            }
          }}
          onDeleteDoc={async (docType, fileName) => {
            if (!db.selected || !db.canDelete) return;
            if (!confirm(`Delete document "${fileName}"?`)) return;
            const { error } = await supabase.storage
              .from("customer-documents")
              .remove([`${db.selected.token}/${docType}/${fileName}`]);
            if (!error) {
              db.setDocs((prev) => prev.filter((d) => !(d.type === docType && d.name === fileName)));
              db.toast({ title: "Deleted" });
            }
          }}
          fetchActivityLog={db.fetchActivityLog}
          fetchSubmissions={db.fetchSubmissions}
        />
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
