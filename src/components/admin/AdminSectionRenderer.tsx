import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NotificationLog from "./NotificationLog";
import { Store, UserCheck, UserX, AlertTriangle, Zap, ArrowRight, ScanLine } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { TenantOverrideProvider } from "@/contexts/TenantContext";
import { PAGE_SIZE, isAcceptedWithAppointment, isAcceptedWithoutAppointment, isOfferPendingSubmission } from "@/lib/adminConstants";
import type { Submission, DealerLocation, Appointment } from "@/lib/adminConstants";
import type { PendingRequest, ActivityLogEntry } from "@/hooks/useAdminDashboard";

// Hot-path sections stay eager so the first paint of the admin home
// (today summary + submissions) isn't blocked on chunk downloads.
import TodayActionSummary from "./TodayActionSummary";
import SubmissionsTable from "./SubmissionsTable";
import AllLeadsPage from "./AllLeadsPage";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";
import AdminEmptyState from "./AdminEmptyState";
import { UserCheck as UserCheckIcon } from "lucide-react";

// All other sections are lazy — most admins only ever touch a handful
// of them, and lazy-loading shrinks the initial AdminDashboard chunk
// considerably. Suspense boundaries below wrap every rendered section.
const AppointmentManager = React.lazy(() => import("./AppointmentManager"));
const StaffManagement = React.lazy(() => import("./StaffManagement"));
const PermissionManagement = React.lazy(() => import("./PermissionManagement"));
const ConsentLog = React.lazy(() => import("./ConsentLog"));
const CommunicationLog = React.lazy(() => import("./CommunicationLog"));
const ExecutiveKPIHub = React.lazy(() => import("./ExecutiveKPIHub"));
const OfferSettings = React.lazy(() => import("./OfferSettings"));
const SiteConfiguration = React.lazy(() => import("./SiteConfiguration"));
const AppearanceSettings = React.lazy(() => import("./AppearanceSettings"));
const LandingFlowConfig = React.lazy(() => import("./LandingFlowConfig"));
const RooftopWebsites = React.lazy(() => import("./RooftopWebsites"));
const PlatformCatalogManager = React.lazy(() => import("./PlatformCatalogManager"));
const PlatformPricingManager = React.lazy(() => import("./PlatformPricingManager"));
const NotificationSettings = React.lazy(() => import("./NotificationSettings"));
const FormConfiguration = React.lazy(() => import("./FormConfiguration"));
const InspectionConfiguration = React.lazy(() => import("./InspectionConfiguration"));
const PhotoConfiguration = React.lazy(() => import("./PhotoConfiguration"));
const DepthPolicyManager = React.lazy(() => import("./DepthPolicyManager"));
const TestimonialManagement = React.lazy(() => import("./TestimonialManagement"));
const LocationManagement = React.lazy(() => import("./LocationManagement"));
const VehicleImageInventory = React.lazy(() => import("./VehicleImageInventory"));
const ChangelogManagement = React.lazy(() => import("./ChangelogManagement"));
const TenantManagement = React.lazy(() => import("./TenantManagement"));
const DealerOnboarding = React.lazy(() => import("./DealerOnboarding"));
const OnboardingScript = React.lazy(() => import("./OnboardingScript"));
const ReportsExport = React.lazy(() => import("./ReportsExport"));
const ReferralManagement = React.lazy(() => import("./ReferralManagement"));
const MyReferrals = React.lazy(() => import("./MyReferrals"));
const MyLeadLink = React.lazy(() => import("./MyLeadLink"));
const EmbedToolkit = React.lazy(() => import("./EmbedToolkit"));
const PromotionManagement = React.lazy(() => import("./PromotionManagement"));

const ApiAccessPanel = React.lazy(() => import("./ApiAccessPanel"));
const WhiteLabelSettings = React.lazy(() => import("./WhiteLabelSettings"));
const EquityMining = React.lazy(() => import("./EquityMining"));
const WholesaleMarketplace = React.lazy(() => import("./WholesaleMarketplace"));
const VautoIntegration = React.lazy(() => import("./VautoIntegration"));
const IntegrationsStatus = React.lazy(() => import("./IntegrationsStatus"));
const AppraiserQueue = React.lazy(() => import("./AppraiserQueue"));
const BDCPriorityQueue = React.lazy(() => import("./BDCPriorityQueue"));
const ExecutiveHUD = React.lazy(() => import("./ExecutiveHUD"));
const PlatformSubscriptions = React.lazy(() => import("./PlatformSubscriptions"));
const VoiceAICampaigns = React.lazy(() => import("./VoiceAICampaigns"));

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <h2 className="text-lg font-semibold text-card-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            An unexpected error occurred while loading this section. Please try
            again.
          </p>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  isAppraiser?: boolean;
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

const AdminSectionRendererInner = (props: AdminSectionRendererProps) => {
  const {
    activeSection: rawActiveSection, setActiveSection, submissions, appointments, setAppointments,
    canManageAccess, userRole, userId, pendingRequests, approveRole, setApproveRole,
    onboardingDealershipId, setOnboardingDealershipId, onboardingDealerName, setOnboardingDealerName,
    tenant, handleView, handleApprove, handleReject, fetchSubmissions, fetchAppointments, toast,
    dealerLocations,
  } = props;
  const navigate = useNavigate();

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
        <AllLeadsPage
          submissions={submissions}
          loading={props.loading}
          search={props.search}
          onSearchChange={props.setSearch}
          page={props.page}
          total={props.total}
          pageSize={PAGE_SIZE}
          onPageChange={props.setPage}
          dealerLocations={props.dealerLocations}
          onView={props.handleView}
        />
      </>
    );
  }

  // Legacy classic table — kept as fallback per brief.
  if (activeSection === "submissions-classic") {
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
                                <SelectItem value="new_car_manager">New Car Manager</SelectItem>
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

  // ── Service Quick Entry launcher ──
  if (activeSection === "service-quick-entry") {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card border border-border/50 rounded-3xl p-8 sm:p-10 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-5 shadow-md">
            <Zap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-card-foreground mb-3">
            Service Quick Entry
          </h2>
          <p className="text-muted-foreground text-base mb-2 max-w-md mx-auto">
            A streamlined, tablet-friendly form for capturing acquisition
            opportunities while customers wait in the service drive.
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            Designed for sub-90-second entry — VIN, mileage, customer, done.
          </p>
          <Button
            onClick={() => navigate("/service-quick-entry")}
            size="lg"
            className="h-14 px-8 text-base font-bold shadow-lg"
          >
            Open Service Quick Entry
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <p className="text-xs font-semibold text-foreground">1. VIN + Mileage</p>
              <p className="text-[11px] text-muted-foreground">Instant Black Book values</p>
            </div>
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <p className="text-xs font-semibold text-foreground">2. Customer Info</p>
              <p className="text-[11px] text-muted-foreground">Name, phone, optional payoff</p>
            </div>
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <p className="text-xs font-semibold text-foreground">3. Hand Off</p>
              <p className="text-[11px] text-muted-foreground">QR code or SMS/email link</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Inspection Check-In launcher ──
  if (activeSection === "inspection-checkin") {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card border border-border/50 rounded-3xl p-8 sm:p-10 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-5 shadow-md">
            <ScanLine className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-card-foreground mb-3">
            Inspection Check-In
          </h2>
          <p className="text-muted-foreground text-base mb-2 max-w-md mx-auto">
            Walk out to the vehicle, scan the VIN on the door jamb, and either
            open the existing submission or create a walk-in in seconds.
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            Optimized for tablets and phones in the field.
          </p>
          <Button
            onClick={() => navigate("/inspection-checkin")}
            size="lg"
            className="h-14 px-8 text-base font-bold shadow-lg"
          >
            Open Check-In
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <p className="text-xs font-semibold text-foreground">1. Scan VIN</p>
              <p className="text-[11px] text-muted-foreground">Camera or manual entry</p>
            </div>
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <p className="text-xs font-semibold text-foreground">2. Match or Create</p>
              <p className="text-[11px] text-muted-foreground">Existing lead or walk-in</p>
            </div>
            <div className="rounded-xl bg-background/60 border border-border/40 p-3">
              <p className="text-xs font-semibold text-foreground">3. Inspect</p>
              <p className="text-[11px] text-muted-foreground">Jumps straight to inspection</p>
            </div>
          </div>
        </div>
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
      {activeSection === "gm-hud" && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <ExecutiveHUD />
        </React.Suspense>
      )}
      {activeSection === "appraiser-queue" && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <AppraiserQueue userRole={userRole} isAppraiser={props.isAppraiser} />
        </React.Suspense>
      )}
      {activeSection === "bdc-queue" && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <BDCPriorityQueue
            onOpenSubmission={(id) => {
              // Parent manages the selected submission via the
              // submissions section's state. Easiest handoff: switch
              // section to submissions and pass the id via query.
              props.setActiveSection?.("submissions");
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("submission", id);
                window.history.pushState(null, "", url.toString());
              }
            }}
          />
        </React.Suspense>
      )}
      {activeSection === "offer-settings" && (canManageAccess || userRole === "gsm_gm" || userRole === "gm") && (
        <OfferSettings userId={userId || undefined} userRole={userRole} />
      )}
      {activeSection === "site-config" && canManageAccess && <SiteConfiguration focusField={focusField} />}
      {activeSection === "appearance" && canManageAccess && (
        <AppearanceSettings userRole={userRole} canManageAccess={canManageAccess} />
      )}
      {activeSection === "landing-flow" && canManageAccess && <LandingFlowConfig />}
      {activeSection === "rooftop-websites" && canManageAccess && <RooftopWebsites />}
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
        <div className="space-y-8">
          <h2 className="text-lg font-semibold text-card-foreground">System Settings</h2>
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <PlatformCatalogManager />
          </React.Suspense>
        </div>
      )}
      {activeSection === "changelog" && canManageAccess && <ChangelogManagement />}
      {activeSection === "pricing-model" && canManageAccess && tenant.dealership_id === "default" && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <PlatformPricingManager />
        </React.Suspense>
      )}
      {/* Dealer Tenants list is super-admin territory only. The default
          tenant acts as the platform-admin scope — a dealer admin on
          their own rooftop shouldn't see other dealers' tenant records.
          Rooftop management (locations within THIS dealership) lives
          in the Locations section, which stays admin-accessible. */}
      {activeSection === "tenants" && canManageAccess && tenant.dealership_id === "default" && (
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
      {activeSection === "equity-mining" && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <EquityMining />
        </React.Suspense>
      )}
      {activeSection === "voice-ai" && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <VoiceAICampaigns />
        </React.Suspense>
      )}
      {activeSection === "wholesale-marketplace" && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <WholesaleMarketplace />
        </React.Suspense>
      )}
      {activeSection === "api-access" && canManageAccess && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <ApiAccessPanel />
        </React.Suspense>
      )}
      {activeSection === "vauto-integration" && canManageAccess && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <VautoIntegration />
        </React.Suspense>
      )}
      {activeSection === "white-label" && canManageAccess && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <WhiteLabelSettings />
        </React.Suspense>
      )}
      {activeSection === "integrations-status" && canManageAccess && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <IntegrationsStatus />
        </React.Suspense>
      )}
      {activeSection === "platform-billing" && canManageAccess && (
        <React.Suspense fallback={<AdminLoadingSkeleton />}>
          <PlatformSubscriptions />
        </React.Suspense>
      )}
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

const AdminSectionRenderer = (props: AdminSectionRendererProps) => (
  <AdminErrorBoundary>
    <React.Suspense fallback={<AdminLoadingSkeleton />}>
      <AdminSectionRendererInner {...props} />
    </React.Suspense>
  </AdminErrorBoundary>
);

export default AdminSectionRenderer;
