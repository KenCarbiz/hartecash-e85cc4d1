/**
 * Shared admin overlays — customer-file slide-out, command palette,
 * request-access dialog, and the photo/doc/submission delete
 * confirmations. Extracted so Admin V2 reuses V1's exact behaviour
 * (same components, same handlers) without duplicating the wiring.
 * V1 continues to use its own inline copy; this is additive.
 */
import {
  lazy, Suspense, useState, Component, type ReactNode, type ErrorInfo,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";
import RequestAccessDialog from "@/components/admin/RequestAccessDialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

const SubmissionDetailSheet = lazy(() => import("@/components/admin/SubmissionDetailSheet"));
const CustomerFileV2 = lazy(() => import("@/components/admin/CustomerFileV2"));

type Db = ReturnType<typeof useAdminDashboard>;

// Catches lazy-import / render failures in the slide-out so we never end
// up with an invisible sheet. Mirrors the V1 boundary.
class CustomerFileChunkBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CustomerFile] chunk/render error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col gap-3 overflow-auto bg-white p-6 shadow-2xl sm:max-w-5xl lg:max-w-6xl">
          <div className="text-base font-bold text-red-700">Customer file failed to load</div>
          <div className="whitespace-pre-wrap break-words rounded border border-red-200 bg-red-50 p-3 font-mono text-xs text-slate-700">
            {this.state.error.message}
          </div>
          <p className="text-sm text-slate-600">
            This is usually a stale browser cache after a deploy. Try a hard refresh
            (Cmd/Ctrl + Shift + R).
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="self-start rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
            style={{ height: 32 }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AdminOverlays = ({ db }: { db: Db }) => {
  const { config: siteConfig } = useSiteConfig();
  const [pendingPhotoDelete, setPendingPhotoDelete] = useState<string | null>(null);
  const [pendingDocDelete, setPendingDocDelete] =
    useState<{ docType: string; fileName: string } | null>(null);

  const sheetProps = {
    selected: db.selected,
    onClose: () => {
      db.setSelected(null);
      db.setPhotos([]);
      db.setDocs([]);
    },
    photos: db.photos,
    docs: db.docs,
    activityLog: db.activityLog,
    duplicateWarnings: db.duplicateWarnings,
    optOutStatus: db.optOutStatus,
    selectedApptTime: db.selectedApptTime,
    selectedApptLocation: db.selectedApptLocation,
    dealerLocations: db.dealerLocations,
    canSetPrice: db.canSetPrice,
    canApprove: db.canApprove,
    canDelete: db.canDelete,
    canUpdateStatus: true,
    auditLabel: db.auditLabel,
    userName: db.userName,
    viewerRole: db.userRole,
    onUpdate: (updated: any) =>
      db.setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s))),
    onDelete: db.handleDelete,
    onRefresh: db.handleView,
    onScheduleAppointment: db.handleScheduleAppt,
    onDeletePhoto: (fileName: string) => {
      if (!db.selected || !db.canDelete) return;
      setPendingPhotoDelete(fileName);
    },
    onDeleteDoc: (docType: string, fileName: string) => {
      if (!db.selected || !db.canDelete) return;
      setPendingDocDelete({ docType, fileName });
    },
    fetchActivityLog: db.fetchActivityLog,
    fetchSubmissions: db.fetchSubmissions,
  };

  return (
    <>
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

      <CustomerFileChunkBoundary>
        <Suspense
          fallback={
            db.selected ? (
              <div className="fixed inset-y-0 right-0 z-[55] flex w-full items-center justify-center bg-slate-50 shadow-2xl sm:max-w-5xl lg:max-w-6xl">
                <div className="text-sm text-slate-500">Loading customer file…</div>
              </div>
            ) : null
          }
        >
          {siteConfig.file_layout === "conversation" ? (
            <CustomerFileV2 {...(sheetProps as any)} />
          ) : (
            <SubmissionDetailSheet {...(sheetProps as any)} />
          )}
        </Suspense>
      </CustomerFileChunkBoundary>

      {/* Delete submission confirmation */}
      <AlertDialog
        open={!!db.pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) db.cancelDelete();
        }}
      >
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
      <AlertDialog
        open={!!pendingPhotoDelete}
        onOpenChange={(open) => {
          if (!open) setPendingPhotoDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>Delete photo "{pendingPhotoDelete}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
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
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete document confirmation */}
      <AlertDialog
        open={!!pendingDocDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDocDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Delete document "{pendingDocDelete?.fileName}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
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
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminOverlays;
