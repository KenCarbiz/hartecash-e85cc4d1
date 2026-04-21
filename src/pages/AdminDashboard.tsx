import { SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminBreadcrumbNav from "@/components/admin/AdminBreadcrumb";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";
import AdminSectionRenderer from "@/components/admin/AdminSectionRenderer";
import RequestAccessDialog from "@/components/admin/RequestAccessDialog";
import TenantViewBanner from "@/components/admin/TenantViewBanner";
import { PlatformProvider } from "@/contexts/PlatformContext";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { lazy, Suspense, useRef, useEffect, useState } from "react";

// SubmissionDetailSheet is the largest component in the codebase (~1.6k lines).
// It only renders when a row is clicked, so lazy-loading it keeps it out of
// the AdminDashboard initial paint chunk.
const SubmissionDetailSheet = lazy(() => import("@/components/admin/SubmissionDetailSheet"));
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

const AdminDashboard = () => {
  const db = useAdminDashboard();
  const { config: siteConfig } = useSiteConfig();
  const contentRef = useRef<HTMLDivElement>(null);
  const [pendingPhotoDelete, setPendingPhotoDelete] = useState<string | null>(null);
  const [pendingDocDelete, setPendingDocDelete] = useState<{ docType: string; fileName: string } | null>(null);
  // Strip ":fieldHint" for sidebar/breadcrumb matching
  const baseSectionId = db.activeSection.includes(":") ? db.activeSection.split(":")[0] : db.activeSection;

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [db.activeSection]);
  return (
    <PlatformProvider>
    <SidebarProvider>
      {/* Tenant View banner — non-dismissible red banner that shows whenever
          a Super Admin is viewing another tenant's data. Lives outside the
          flex container so it spans the full viewport width above the
          sidebar and main content. */}
      <TenantViewBanner />
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
          appraiserQueueCount={db.appraiserQueueCount}
          allowedSections={db.allowedSections}
          showRequestAccess={db.showRequestAccessToggle && !db.canManageAccess}
          onRequestAccess={() => db.setShowRequestAccessDialog(true)}
          locationCount={db.dealerLocations.length}
          userRole={db.userRole}
          isAppraiser={db.isAppraiser}
          dealershipId={db.tenant.dealership_id}
          enterpriseBetaEnabled={Boolean((siteConfig as any).enterprise_beta_enabled)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader
            darkMode={db.darkMode}
            setDarkMode={db.setDarkMode}
            userRole={db.userRole}
            userName={db.userName}
            dealerName={db.tenant.display_name}
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

        {/* Always render the sheet so Radix can own its own open/close
            animation state. Suspense keeps the chunk lazy (it only loads
            the first time admin renders), but the Sheet itself is mounted
            and driven by `open={!!selected}` internally — unmounting it
            on close breaks the slide-out animation and can race the first
            open. */}
        <Suspense fallback={null}>
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
            canViewPricing={db.canViewPricing}
            isSalesFloor={db.isSalesFloor}
            canUpdateStatus={true}
            auditLabel={db.auditLabel}
            userName={db.userName}
            onUpdate={(updated) =>
              db.setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
            }
            onDelete={db.handleDelete}
            onRefresh={db.handleView}
            onScheduleAppointment={db.handleScheduleAppt}
            onDeletePhoto={(fileName) => {
              if (!db.selected || !db.canDelete) return;
              setPendingPhotoDelete(fileName);
            }}
            onDeleteDoc={(docType, fileName) => {
              if (!db.selected || !db.canDelete) return;
              setPendingDocDelete({ docType, fileName });
            }}
            fetchActivityLog={db.fetchActivityLog}
            fetchSubmissions={db.fetchSubmissions}
          />
        </Suspense>
        {/* Delete submission confirmation */}
        <AlertDialog open={!!db.pendingDeleteId} onOpenChange={(open) => { if (!open) db.cancelDelete(); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Submission</AlertDialogTitle>
              <AlertDialogDescription>
                Delete this submission? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={db.confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete photo confirmation */}
        <AlertDialog open={!!pendingPhotoDelete} onOpenChange={(open) => { if (!open) setPendingPhotoDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Photo</AlertDialogTitle>
              <AlertDialogDescription>
                Delete photo "{pendingPhotoDelete}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                if (!db.selected || !pendingPhotoDelete) return;
                const fileName = pendingPhotoDelete;
                setPendingPhotoDelete(null);
                const { error } = await supabase.storage
                  .from("submission-photos")
                  .remove([`${db.selected.token}/${fileName}`]);
                if (!error) {
                  db.setPhotos((prev) => prev.filter((p) => p.name !== fileName));
                  db.toast({ title: "Deleted" });
                }
              }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete document confirmation */}
        <AlertDialog open={!!pendingDocDelete} onOpenChange={(open) => { if (!open) setPendingDocDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document</AlertDialogTitle>
              <AlertDialogDescription>
                Delete document "{pendingDocDelete?.fileName}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                if (!db.selected || !pendingDocDelete) return;
                const { docType, fileName } = pendingDocDelete;
                setPendingDocDelete(null);
                const { error } = await supabase.storage
                  .from("customer-documents")
                  .remove([`${db.selected.token}/${docType}/${fileName}`]);
                if (!error) {
                  db.setDocs((prev) => prev.filter((d) => !(d.type === docType && d.name === fileName)));
                  db.toast({ title: "Deleted" });
                }
              }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarProvider>
    </PlatformProvider>
  );
};

export default AdminDashboard;
