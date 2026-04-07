import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NotificationLog from "./NotificationLog";
import { Store, UserCheck, UserX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { TenantOverrideProvider } from "@/contexts/TenantContext";
import { PAGE_SIZE, isAcceptedWithAppointment, isAcceptedWithoutAppointment, isOfferPendingSubmission } from "@/lib/adminConstants";
import type { Submission, DealerLocation, Appointment } from "@/lib/adminConstants";
import type { PendingRequest, ActivityLogEntry } from "@/hooks/useAdminDashboard";

import TodayActionSummary from "./TodayActionSummary";
import SubmissionsTable from "./SubmissionsTable";
import AppointmentManager from "./AppointmentManager";
import StaffManagement from "./StaffManagement";
import PermissionManagement from "./PermissionManagement";
import ConsentLog from "./ConsentLog";
import CommunicationLog from "./CommunicationLog";
import ExecutiveKPIHub from "./ExecutiveKPIHub";
import OfferSettings from "./OfferSettings";
import SiteConfiguration from "./SiteConfiguration";
import NotificationSettings from "./NotificationSettings";
import FormConfiguration from "./FormConfiguration";
import InspectionConfiguration from "./InspectionConfiguration";
import PhotoConfiguration from "./PhotoConfiguration";
import DepthPolicyManager from "./DepthPolicyManager";
import TestimonialManagement from "./TestimonialManagement";
import LocationManagement from "./LocationManagement";
import VehicleImageInventory from "./VehicleImageInventory";
import ChangelogManagement from "./ChangelogManagement";
import TenantManagement from "./TenantManagement";
import DealerOnboarding from "./DealerOnboarding";
import OnboardingScript from "./OnboardingScript";
import ReportsExport from "./ReportsExport";
import ReferralManagement from "./ReferralManagement";
import MyReferrals from "./MyReferrals";
import MyLeadLink from "./MyLeadLink";
import EmbedToolkit from "./EmbedToolkit";
import PromotionManagement from "./PromotionManagement";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";
import AdminEmptyState from "./AdminEmptyState";
import { UserCheck as UserCheckIcon } from "lucide-react";

interface AdminSectionRendererProps {
  activeSection: string;
  setActiveSection: (s: string) => void;
  submissions: Submission[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  storeFilter: string;
  setStoreFilter: (v: string) => void;
  dateRangeFilter: { from: string; to: string };
  setDateRangeFilter: (v: { from: string; to: string }) => void;
  showFilterPanel: boolean;
  setShowFilterPanel: (v: boolean) => void;
  page: number;
  total: number;
  setPage: (v: number) => void;
  dealerLocations: DealerLocation[];
  canApprove: boolean;
  canDelete: boolean;
  canManageAccess: boolean;
  auditLabel: string;
  userName: string;
  userRole: string;
  userId: string | null;
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  pendingRequests: PendingRequest[];
  approveRole: string;
  setApproveRole: (v: string) => void;
  onboardingDealershipId: string | null;
  setOnboardingDealershipId: (v: string | null) => void;
  onboardingDealerName: string;
  setOnboardingDealerName: (v: string) => void;
  tenant: { dealership_id: string; display_name: string };
  handleView: (sub: Submission) => void;
  handleDelete: (id: string) => void;
  handleInlineStatusChange: (sub: Submission, newStatus: string) => void;
  handleApprove: (request: PendingRequest) => void;
  handleReject: (request: PendingRequest) => void;
  fetchSubmissions: () => void;
  fetchAppointments: () => void;
  toast: (opts: any) => void;
}

const submissionsTableProps = (
  props: AdminSectionRendererProps,
  filteredSubmissions: Submission[],
  paginated: boolean
) => ({
  submissions: filteredSubmissions,
  loading: props.loading,
  search: props.search,
  onSearchChange: props.setSearch,
  statusFilter: props.statusFilter,
  onStatusFilterChange: props.setStatusFilter,
  sourceFilter: props.sourceFilter,
  onSourceFilterChange: props.setSourceFilter,
  storeFilter: props.storeFilter,
  onStoreFilterChange: props.setStoreFilter,
  dateRangeFilter: props.dateRangeFilter,
  onDateRangeFilterChange: props.setDateRangeFilter,
  showFilterPanel: props.showFilterPanel,
  onToggleFilterPanel: () => props.setShowFilterPanel(!props.showFilterPanel),
  page: paginated ? props.page : 0,
  total: paginated ? props.total : filteredSubmissions.length,
  pageSize: PAGE_SIZE,
  onPageChange: paginated ? props.setPage : () => {},
  dealerLocations: props.dealerLocations,
  canApprove: props.canApprove,
  canDelete: props.canDelete,
  auditLabel: props.auditLabel,
  userName: props.userName,
  onView: props.handleView,
  onDelete: props.handleDelete,
  onInlineStatusChange: props.handleInlineStatusChange,
});

const AdminSectionRenderer = (props: AdminSectionRendererProps) => {
  const {
    activeSection: rawActiveSection, setActiveSection, submissions, appointments, setAppointments,
    canManageAccess, userRole, userId, pendingRequests, approveRole, setApproveRole,
    onboardingDealershipId, setOnboardingDealershipId, onboardingDealerName, setOnboardingDealerName,
    tenant, handleView, handleApprove, handleReject, fetchSubmissions, fetchAppointments, toast,
    dealerLocations,
  } = props;

  // Parse compound section keys like "site-config:logos"
  const colonIdx = rawActiveSection.indexOf(":");
  const activeSection = colonIdx > -1 ? rawActiveSection.slice(0, colonIdx) : rawActiveSection;
  const focusField = colonIdx > -1 ? rawActiveSection.slice(colonIdx + 1) : undefined;

  // ── Pipeline sections ──
  if (activeSection === "submissions") {
    if (props.loading) return <AdminLoadingSkeleton />;
    return (
      <>
        <TodayActionSummary submissions={submissions} appointments={appointments} onNavigate={setActiveSection} />
        <SubmissionsTable {...submissionsTableProps(props, submissions, true)} />
      </>
    );
  }

  if (activeSection === "offer-pending") {
    return <SubmissionsTable {...submissionsTableProps(props, submissions.filter(isOfferPendingSubmission), false)} />;
  }

  if (activeSection === "offer-accepted") {
    return <SubmissionsTable {...submissionsTableProps(props, submissions.filter(isAcceptedWithoutAppointment), false)} />;
  }

  if (activeSection === "accepted-appts") {
    return (
      <div className="space-y-6">
        <SubmissionsTable {...submissionsTableProps(props, submissions.filter(isAcceptedWithAppointment), false)} />
        <AppointmentManager
          appointments={appointments}
          setAppointments={setAppointments}
          submissions={submissions.filter(isAcceptedWithAppointment)}
          dealerLocations={dealerLocations}
          onViewSubmission={(appt) => {
            const sub = submissions.find((s) => s.token === appt.submission_token);
            if (sub) handleView(sub);
            else toast({ title: "Not found" });
          }}
          fetchSubmissions={fetchSubmissions}
          fetchAppointments={fetchAppointments}
        />
      </div>
    );
  }

  // ── Staff ──
  if (activeSection === "staff") {
    return (
      <div className="space-y-6">
        <StaffManagement />
        {canManageAccess && (
          <>
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-card-foreground mb-4">Permission Groups</h2>
              <PermissionManagement />
            </div>
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-card-foreground mb-4">Access Requests</h2>
              {pendingRequests.length === 0 ? (
                <AdminEmptyState icon={UserCheckIcon} title="No pending requests" description="Access requests from new staff will appear here." />
              ) : (
                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Requested</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((req) => (
                        <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{req.email}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <Select value={approveRole} onValueChange={setApproveRole}>
                              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sales_bdc">Sales / BDC</SelectItem>
                                <SelectItem value="used_car_manager">Used Car Manager</SelectItem>
                                <SelectItem value="gsm_gm">GSM / GM</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => handleApprove(req)} className="bg-success hover:bg-success/90 text-success-foreground">
                                <UserCheck className="w-4 h-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(req)}>
                                <UserX className="w-4 h-4 mr-1" /> Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Compliance ──
  if (activeSection === "compliance") {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-card-foreground">Compliance</h2>
        <ConsentLog />
        <div className="border-t border-border pt-6">
          <CommunicationLog />
        </div>
      </div>
    );
  }

  // ── Config sections (wrapped with optional tenant override) ──
  const configSections = (
    <>
      {activeSection === "executive" && <ExecutiveKPIHub />}
      {activeSection === "offer-settings" && (canManageAccess || userRole === "gsm_gm") && (
        <OfferSettings userId={userId || undefined} userRole={userRole} />
      )}
      {activeSection === "site-config" && canManageAccess && <SiteConfiguration focusField={focusField} />}
      {activeSection === "promotions" && canManageAccess && <PromotionManagement />}
      {activeSection === "notifications" && canManageAccess && (
        <div className="space-y-6">
          <Tabs defaultValue="settings" className="w-full">
            <TabsList>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="log">Sent Messages</TabsTrigger>
            </TabsList>
            <TabsContent value="settings"><NotificationSettings /></TabsContent>
            <TabsContent value="log"><NotificationLog /></TabsContent>
          </Tabs>
        </div>
      )}
      {activeSection === "form-config" && canManageAccess && <FormConfiguration />}
      {activeSection === "inspection-config" && canManageAccess && <InspectionConfiguration />}
      {activeSection === "photo-config" && canManageAccess && <PhotoConfiguration />}
      {activeSection === "depth-policies" && canManageAccess && <DepthPolicyManager />}
      {activeSection === "testimonials" && canManageAccess && <TestimonialManagement />}
      {activeSection === "locations" && canManageAccess && <LocationManagement />}
      {activeSection === "image-inventory" && canManageAccess && <VehicleImageInventory />}
      {activeSection === "system-settings" && canManageAccess && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-card-foreground">System Settings</h2>
          <ChangelogManagement />
        </div>
      )}
      {activeSection === "tenants" && canManageAccess && (
        <TenantManagement
          onSetupDealer={(dealerId) => {
            setOnboardingDealershipId(dealerId);
            supabase.from("tenants").select("display_name").eq("dealership_id", dealerId).maybeSingle()
              .then(({ data }) => setOnboardingDealerName((data as any)?.display_name || dealerId));
            setActiveSection("onboarding");
          }}
        />
      )}
      {activeSection === "onboarding" && (
        <DealerOnboarding
          isAdmin={canManageAccess}
          onNavigate={setActiveSection}
          targetDealershipId={onboardingDealershipId}
          onDealershipChange={(id) => {
            setOnboardingDealershipId(id);
            if (id) {
              supabase.from("tenants").select("display_name").eq("dealership_id", id).maybeSingle()
                .then(({ data }) => setOnboardingDealerName((data as any)?.display_name || id));
            } else {
              setOnboardingDealerName("");
            }
          }}
        />
      )}
      {activeSection === "onboarding-script" && <OnboardingScript targetDealershipId={onboardingDealershipId} onNavigate={props.setActiveSection} />}
      {activeSection === "reports" && <ReportsExport />}
      {activeSection === "referrals" && canManageAccess && <ReferralManagement />}
      {activeSection === "my-referrals" && (
        <MyReferrals staffName={props.userName} />
      )}
      {activeSection === "my-lead-link" && <MyLeadLink />}
      {activeSection === "embed-toolkit" && canManageAccess && <EmbedToolkit />}
    </>
  );

  if (onboardingDealershipId && onboardingDealershipId !== "default") {
    return (
      <TenantOverrideProvider dealershipId={onboardingDealershipId} displayName={onboardingDealerName}>
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-2.5">
          <Store className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200 flex-1">
            Configuring: <strong>{onboardingDealerName || onboardingDealershipId}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            onClick={() => { setOnboardingDealershipId(null); setOnboardingDealerName(""); }}
          >
            ✕ Back to {tenant.display_name}
          </Button>
        </div>
        {configSections}
      </TenantOverrideProvider>
    );
  }

  return configSections;
};

export default AdminSectionRenderer;
