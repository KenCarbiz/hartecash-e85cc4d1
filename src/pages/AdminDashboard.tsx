import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun, Newspaper } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useToast } from "@/hooks/use-toast";
import harteLogoWhiteFallback from "@/assets/harte-logo-white.png";

import StaffManagement from "@/components/admin/StaffManagement";
import ConsentLog from "@/components/admin/ConsentLog";
import OfferSettings from "@/components/admin/OfferSettings";
import SiteConfiguration from "@/components/admin/SiteConfiguration";
import NotificationSettings from "@/components/admin/NotificationSettings";
import FormConfiguration from "@/components/admin/FormConfiguration";
import TestimonialManagement from "@/components/admin/TestimonialManagement";
import LocationManagement from "@/components/admin/LocationManagement";
import VehicleImageInventory from "@/components/admin/VehicleImageInventory";
import CommunicationLog from "@/components/admin/CommunicationLog";
import ChangelogManagement from "@/components/admin/ChangelogManagement";
import DealerOnboarding from "@/components/admin/DealerOnboarding";
import ReportsExport from "@/components/admin/ReportsExport";
import PermissionManagement from "@/components/admin/PermissionManagement";
import ExecutiveKPIHub from "@/components/admin/ExecutiveKPIHub";
import InspectionConfiguration from "@/components/admin/InspectionConfiguration";
import DepthPolicyManager from "@/components/admin/DepthPolicyManager";
import RequestAccessDialog from "@/components/admin/RequestAccessDialog";
import SubmissionsTable from "@/components/admin/SubmissionsTable";
import SubmissionDetailSheet from "@/components/admin/SubmissionDetailSheet";
import AppointmentManager from "@/components/admin/AppointmentManager";

import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, UserX } from "lucide-react";

import type { Submission, DealerLocation, Appointment } from "@/lib/adminConstants";
import { ROLE_LABELS, PAGE_SIZE, getStatusLabel } from "@/lib/adminConstants";

interface PendingRequest {
  id: string;
  user_id: string;
  email: string;
  status: string;
  created_at: string;
}

const AdminDashboard = () => {
  const [darkMode, setDarkMode] = useState(() => typeof window !== "undefined" ? localStorage.getItem("admin-dark-mode") === "true" : false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [storeFilter, setStoreFilter] = useState<string>("");
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [selected, setSelected] = useState<Submission | null>(null);
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [docs, setDocs] = useState<{ name: string; url: string; type: string }[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activityLog, setActivityLog] = useState<{ id: string; action: string; old_value: string | null; new_value: string | null; performed_by: string | null; created_at: string }[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, string[]>>({});
  const [selectedApptTime, setSelectedApptTime] = useState<string | null>(null);
  const [selectedApptLocation, setSelectedApptLocation] = useState<string | null>(null);
  const [optOutStatus, setOptOutStatus] = useState<{ email: boolean; sms: boolean }>({ email: false, sms: false });
  const [activeSection, setActiveSection] = useState("submissions");
  const [dealerLocations, setDealerLocations] = useState<DealerLocation[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [permissionRequestCount, setPermissionRequestCount] = useState(0);
  const [pricingAccessRequestCount, setPricingAccessRequestCount] = useState(0);
  const [showRequestAccessDialog, setShowRequestAccessDialog] = useState(false);
  const [showRequestAccessToggle, setShowRequestAccessToggle] = useState(true);
  const [approveRole, setApproveRole] = useState<string>("sales_bdc");
  const navigate = useNavigate();
  const { toast } = useToast();

  const canSetPrice = ["admin", "used_car_manager", "gsm_gm"].includes(userRole);
  const canApprove = ["admin", "gsm_gm"].includes(userRole);
  const canDelete = userRole === "admin";
  const canManageAccess = userRole === "admin";
  const { allowedSections } = useStaffPermissions(userId, canManageAccess);

  const auditLabel = userName ? `${userName} — ${ROLE_LABELS[userRole] || userRole}` : ROLE_LABELS[userRole] || userRole;

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add("dark"); else root.classList.remove("dark");
    localStorage.setItem("admin-dark-mode", darkMode.toString());
    return () => { root.classList.remove("dark"); };
  }, [darkMode]);
  useEffect(() => {
    if (userRole) { fetchSubmissions(); fetchAppointments(); fetchLocations(); if (canManageAccess) fetchPendingRequests(); }
  }, [page, userRole]);

  const fetchLocations = async () => {
    const { data } = await supabase.from("dealership_locations").select("id, name, city, state").eq("is_active", true).order("sort_order");
    if (data) setDealerLocations(data);
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/admin/login"); return; }
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).limit(1).maybeSingle();
    if (!roleData) { await supabase.auth.signOut(); navigate("/admin/login"); return; }
    setUserRole(roleData.role);
    setUserId(session.user.id);
    const { data: profileData } = await supabase.from("profiles").select("display_name").eq("user_id", session.user.id).maybeSingle();
    setUserName(profileData?.display_name || session.user.email || "");
    if (roleData.role === "admin") {
      const { count } = await supabase.from("permission_access_requests" as any).select("id", { count: "exact", head: true }).eq("status", "pending");
      setPermissionRequestCount(count || 0);
    }
    if (["admin", "gsm_gm"].includes(roleData.role)) {
      const { count } = await supabase.from("pricing_model_access_requests" as any).select("id", { count: "exact", head: true }).eq("status", "pending");
      setPricingAccessRequestCount(count || 0);
    }
    const { data: configData } = await supabase.from("site_config").select("show_request_access").eq("dealership_id", "default").maybeSingle();
    setShowRequestAccessToggle((configData as any)?.show_request_access ?? true);
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const { data, error, count } = await supabase.from("submissions").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (!error && data) { setSubmissions(data as any); setTotal(count || 0); }
    setLoading(false);
  };

  const fetchPendingRequests = async () => {
    const { data } = await supabase.from("pending_admin_requests").select("*").eq("status", "pending").order("created_at", { ascending: false });
    if (data) setPendingRequests(data);
  };

  const fetchAppointments = async () => {
    const { data } = await supabase.from("appointments").select("*").order("preferred_date", { ascending: true });
    if (data) setAppointments(data);
  };

  const fetchActivityLog = async (submissionId: string) => {
    const { data } = await supabase.from("activity_log").select("*").eq("submission_id", submissionId).order("created_at", { ascending: false }).limit(50);
    setActivityLog(data || []);
  };

  const handleView = async (sub: Submission) => {
    setSelected(sub);
    setDocs([]);
    setActivityLog([]);
    setSelectedApptTime(null);
    setSelectedApptLocation(null);
    setOptOutStatus({ email: false, sms: false });
    fetchActivityLog(sub.id);
    // Check duplicates
    const warnings: string[] = [];
    if (sub.vin) { const { data } = await supabase.from("submissions").select("id").eq("vin", sub.vin).neq("id", sub.id).limit(3); if (data?.length) warnings.push(`VIN match: ${data.length} other submission(s)`); }
    if (sub.phone) { const { data } = await supabase.from("submissions").select("id").eq("phone", sub.phone).neq("id", sub.id).limit(3); if (data?.length) warnings.push(`Phone match: ${data.length} other submission(s)`); }
    setDuplicateWarnings(prev => ({ ...prev, [sub.id]: warnings }));
    // Opt-out
    if (sub.email || sub.phone) {
      const optEmail = sub.email ? (await supabase.from("opt_outs").select("id").eq("email", sub.email).eq("channel", "email").maybeSingle()).data : null;
      const optSms = sub.phone ? (await supabase.from("opt_outs").select("id").eq("phone", sub.phone).eq("channel", "sms").maybeSingle()).data : null;
      setOptOutStatus({ email: !!optEmail, sms: !!optSms });
    }
    // Appointment
    if (sub.appointment_set) {
      const { data: apptData } = await supabase.from("appointments").select("preferred_time, store_location").eq("submission_token", sub.token).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (apptData?.preferred_time) setSelectedApptTime(apptData.preferred_time);
      if ((apptData as any)?.store_location) setSelectedApptLocation((apptData as any).store_location);
    }
    // Photos
    const { data } = await supabase.storage.from("submission-photos").list(sub.token);
    if (data?.length) {
      const items: { url: string; name: string }[] = [];
      for (const file of data) { const { data: u } = await supabase.storage.from("submission-photos").createSignedUrl(`${sub.token}/${file.name}`, 3600); if (u?.signedUrl) items.push({ url: u.signedUrl, name: file.name }); }
      setPhotos(items);
    } else setPhotos([]);
    // Docs
    const docTypes = ["drivers_license", "drivers_license_front", "drivers_license_back", "registration", "title_inquiry", "title", "payoff_verification", "appraisal", "carfax", "window_sticker"];
    const allDocs: { name: string; url: string; type: string }[] = [];
    for (const dt of docTypes) {
      const { data: files } = await supabase.storage.from("customer-documents").list(`${sub.token}/${dt}`);
      if (files?.length) { for (const f of files) { const { data: u } = await supabase.storage.from("customer-documents").createSignedUrl(`${sub.token}/${dt}/${f.name}`, 3600); if (u?.signedUrl) allDocs.push({ name: f.name, url: u.signedUrl, type: dt }); } }
    }
    setDocs(allDocs);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (!error) { toast({ title: "Deleted" }); setSubmissions(prev => prev.filter(s => s.id !== id)); setSelected(null); }
    else toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
  };

  const handleInlineStatusChange = async (sub: Submission, newStatus: string) => {
    if (["deal_finalized", "check_request_submitted", "purchase_complete"].includes(newStatus) && !canApprove) {
      toast({ title: "Not authorized", variant: "destructive" }); return;
    }
    const old = sub.progress_status;
    const { error } = await supabase.from("submissions").update({ progress_status: newStatus, status_updated_at: new Date().toISOString() }).eq("id", sub.id);
    if (!error) {
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, progress_status: newStatus, status_updated_at: new Date().toISOString() } : s));
      await supabase.from("activity_log").insert({ submission_id: sub.id, action: "Status Changed", old_value: getStatusLabel(old), new_value: getStatusLabel(newStatus), performed_by: auditLabel });
      if (old !== "purchase_complete" && newStatus === "purchase_complete") supabase.functions.invoke("send-notification", { body: { trigger_key: "staff_deal_completed", submission_id: sub.id } }).catch(console.error);
      supabase.functions.invoke("send-notification", { body: { trigger_key: "status_change", submission_id: sub.id } }).catch(console.error);
      toast({ title: "Status updated" });
    }
  };

  const handleApprove = async (request: PendingRequest) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: request.user_id, role: approveRole as any });
    if (error) { toast({ title: "Error", variant: "destructive" }); return; }
    await supabase.from("pending_admin_requests").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", request.id);
    toast({ title: "Approved", description: `${request.email} granted ${ROLE_LABELS[approveRole] || approveRole} access.` });
    fetchPendingRequests();
  };

  const handleReject = async (request: PendingRequest) => {
    await supabase.from("pending_admin_requests").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", request.id);
    toast({ title: "Rejected" }); fetchPendingRequests();
  };

  const handleScheduleAppt = (sub: Submission) => {
    setActiveSection("appointments");
  };

  return (
    <SidebarProvider>
    <div className="min-h-screen bg-background transition-colors duration-300 flex w-full">
      <AdminSidebar
        activeSection={activeSection} onSectionChange={setActiveSection} canManageAccess={canManageAccess}
        submissionCount={total} appointmentCount={appointments.length} pendingRequestCount={pendingRequests.length}
        permissionRequestCount={permissionRequestCount} pricingAccessRequestCount={pricingAccessRequestCount}
        allowedSections={allowedSections} showRequestAccess={showRequestAccessToggle && !canManageAccess}
        onRequestAccess={() => setShowRequestAccessDialog(true)} locationCount={dealerLocations.length} userRole={userRole}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-50 bg-gradient-to-r from-[hsl(210,100%,15%)] via-[hsl(210,100%,20%)] to-[hsl(220,80%,18%)] text-white shadow-lg">
          <div className="px-3 md:px-4 py-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <SidebarTrigger className="text-white/80 hover:text-white hover:bg-white/10 -ml-1 shrink-0" />
              <img src={harteLogoWhiteFallback} alt="Dashboard" className="h-12 md:h-20 w-auto shrink-0" />
              <div className="min-w-0">
                <span className="text-sm md:text-lg font-bold">Dashboard</span>
                <span className="hidden sm:inline ml-2 text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/90 font-medium">{ROLE_LABELS[userRole] || userRole}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setDarkMode(!darkMode)} className="text-white/80 hover:text-white hover:bg-white/10 px-2">
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/admin/login"); }} className="text-white/80 hover:text-white hover:bg-white/10 px-2">
                <LogOut className="w-4 h-4" /> <span className="hidden md:inline ml-1">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 py-6 overflow-auto">
          <div className="max-w-[1400px] mx-auto">
            {activeSection === "submissions" && (
              <SubmissionsTable
                submissions={submissions} loading={loading} search={search} onSearchChange={setSearch}
                statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
                sourceFilter={sourceFilter} onSourceFilterChange={setSourceFilter}
                storeFilter={storeFilter} onStoreFilterChange={setStoreFilter}
                dateRangeFilter={dateRangeFilter} onDateRangeFilterChange={setDateRangeFilter}
                showFilterPanel={showFilterPanel} onToggleFilterPanel={() => setShowFilterPanel(!showFilterPanel)}
                page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage}
                dealerLocations={dealerLocations} canApprove={canApprove} canDelete={canDelete}
                auditLabel={auditLabel} userName={userName}
                onView={handleView} onDelete={handleDelete} onInlineStatusChange={handleInlineStatusChange}
              />
            )}

            {activeSection === "appraisals" && (
              <SubmissionsTable
                submissions={submissions.filter(s =>
                  (s.estimated_offer_high || s.offered_price) &&
                  !["offer_accepted", "purchase_complete", "dead_lead", "check_request_submitted"].includes(s.progress_status)
                )}
                loading={loading} search={search} onSearchChange={setSearch}
                statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
                sourceFilter={sourceFilter} onSourceFilterChange={setSourceFilter}
                storeFilter={storeFilter} onStoreFilterChange={setStoreFilter}
                dateRangeFilter={dateRangeFilter} onDateRangeFilterChange={setDateRangeFilter}
                showFilterPanel={showFilterPanel} onToggleFilterPanel={() => setShowFilterPanel(!showFilterPanel)}
                page={0} total={submissions.filter(s =>
                  (s.estimated_offer_high || s.offered_price) &&
                  !["offer_accepted", "purchase_complete", "dead_lead", "check_request_submitted"].includes(s.progress_status)
                ).length} pageSize={PAGE_SIZE} onPageChange={() => {}}
                dealerLocations={dealerLocations} canApprove={canApprove} canDelete={canDelete}
                auditLabel={auditLabel} userName={userName}
                onView={handleView} onDelete={handleDelete} onInlineStatusChange={handleInlineStatusChange}
              />
            )}

            {activeSection === "appointments" && (
              <AppointmentManager
                appointments={appointments} setAppointments={setAppointments}
                submissions={submissions} dealerLocations={dealerLocations}
                onViewSubmission={(appt) => {
                  const sub = submissions.find(s => s.token === appt.submission_token);
                  if (sub) handleView(sub);
                  else toast({ title: "Not found" });
                }}
                fetchSubmissions={fetchSubmissions} fetchAppointments={fetchAppointments}
              />
            )}

            {activeSection === "staff" && (
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
                        <div className="text-center py-8 text-muted-foreground">No pending access requests.</div>
                      ) : (
                        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden overflow-x-auto">
                          <table className="w-full text-sm min-w-[600px]">
                            <thead><tr className="border-b border-border bg-muted/50">
                              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Requested</th>
                              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                            </tr></thead>
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
                                      <Button size="sm" onClick={() => handleApprove(req)} className="bg-success hover:bg-success/90 text-success-foreground"><UserCheck className="w-4 h-4 mr-1" /> Approve</Button>
                                      <Button size="sm" variant="destructive" onClick={() => handleReject(req)}><UserX className="w-4 h-4 mr-1" /> Reject</Button>
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
            )}

            {activeSection === "compliance" && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-card-foreground">Compliance</h2>
                <div className="space-y-6">
                  <ConsentLog />
                  <div className="border-t border-border pt-6">
                    <CommunicationLog />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "executive" && <ExecutiveKPIHub />}
            {activeSection === "offer-settings" && (canManageAccess || userRole === "gsm_gm") && <OfferSettings userId={userId || undefined} userRole={userRole} />}
            {activeSection === "site-config" && canManageAccess && <SiteConfiguration />}
            {activeSection === "notifications" && canManageAccess && <NotificationSettings />}
            {activeSection === "form-config" && canManageAccess && <FormConfiguration />}
            {activeSection === "inspection-config" && canManageAccess && <InspectionConfiguration />}
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

            {activeSection === "onboarding" && <DealerOnboarding isAdmin={canManageAccess} onNavigate={setActiveSection} />}
            {activeSection === "reports" && <ReportsExport />}
          </div>
        </div>
      </div>

      {userId && <RequestAccessDialog open={showRequestAccessDialog} onOpenChange={setShowRequestAccessDialog} userId={userId} />}

      <SubmissionDetailSheet
        selected={selected}
        onClose={() => { setSelected(null); setPhotos([]); setDocs([]); }}
        photos={photos} docs={docs} activityLog={activityLog}
        duplicateWarnings={duplicateWarnings} optOutStatus={optOutStatus}
        selectedApptTime={selectedApptTime} selectedApptLocation={selectedApptLocation}
        dealerLocations={dealerLocations}
        canSetPrice={canSetPrice} canApprove={canApprove} canDelete={canDelete} canUpdateStatus={true}
        auditLabel={auditLabel} userName={userName}
        onUpdate={(updated) => setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s))}
        onDelete={handleDelete}
        onRefresh={handleView}
        onScheduleAppointment={handleScheduleAppt}
        onDeletePhoto={async (fileName) => {
          if (!selected || !canDelete) return;
          if (!confirm(`Delete photo "${fileName}"?`)) return;
          const { error } = await supabase.storage.from("submission-photos").remove([`${selected.token}/${fileName}`]);
          if (!error) { setPhotos(prev => prev.filter(p => p.name !== fileName)); toast({ title: "Deleted" }); }
        }}
        onDeleteDoc={async (docType, fileName) => {
          if (!selected || !canDelete) return;
          if (!confirm(`Delete document "${fileName}"?`)) return;
          const { error } = await supabase.storage.from("customer-documents").remove([`${selected.token}/${docType}/${fileName}`]);
          if (!error) { setDocs(prev => prev.filter(d => !(d.type === docType && d.name === fileName))); toast({ title: "Deleted" }); }
        }}
        fetchActivityLog={fetchActivityLog}
        fetchSubmissions={fetchSubmissions}
      />
    </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
