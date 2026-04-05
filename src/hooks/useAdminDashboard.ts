import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useTenant } from "@/contexts/TenantContext";
import type { Submission, DealerLocation, Appointment } from "@/lib/adminConstants";
import { ROLE_LABELS, PAGE_SIZE, getStatusLabel } from "@/lib/adminConstants";

export interface PendingRequest {
  id: string;
  user_id: string;
  email: string;
  status: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
}

export function useAdminDashboard() {
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("admin-dark-mode") === "true" : false
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [selected, setSelected] = useState<Submission | null>(null);
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [docs, setDocs] = useState<{ name: string; url: string; type: string }[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, string[]>>({});
  const [selectedApptTime, setSelectedApptTime] = useState<string | null>(null);
  const [selectedApptLocation, setSelectedApptLocation] = useState<string | null>(null);
  const [optOutStatus, setOptOutStatus] = useState<{ email: boolean; sms: boolean }>({ email: false, sms: false });
  const [activeSection, setActiveSection] = useState("submissions");
  const [onboardingDealershipId, setOnboardingDealershipId] = useState<string | null>(null);
  const [onboardingDealerName, setOnboardingDealerName] = useState("");
  const [dealerLocations, setDealerLocations] = useState<DealerLocation[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [permissionRequestCount, setPermissionRequestCount] = useState(0);
  const [pricingAccessRequestCount, setPricingAccessRequestCount] = useState(0);
  const [showRequestAccessDialog, setShowRequestAccessDialog] = useState(false);
  const [showRequestAccessToggle, setShowRequestAccessToggle] = useState(true);
  const [approveRole, setApproveRole] = useState("sales_bdc");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();

  const canSetPrice = ["admin", "used_car_manager", "gsm_gm"].includes(userRole);
  const canApprove = ["admin", "gsm_gm"].includes(userRole);
  const canDelete = userRole === "admin";
  const canManageAccess = userRole === "admin";
  const { allowedSections } = useStaffPermissions(userId, canManageAccess);

  const auditLabel = userName
    ? `${userName} — ${ROLE_LABELS[userRole] || userRole}`
    : ROLE_LABELS[userRole] || userRole;

  // ── Data fetching ──

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase
      .from("dealership_locations")
      .select("id, name, city, state")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setDealerLocations(data);
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const { data, error, count } = await supabase
      .from("submissions")
      .select("*", { count: "exact" })
      .eq("dealership_id", tenant.dealership_id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!error && data) {
      setSubmissions(data as any);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, tenant.dealership_id]);

  const fetchPendingRequests = useCallback(async () => {
    const { data } = await supabase
      .from("pending_admin_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setPendingRequests(data);
  }, []);

  const fetchAppointments = useCallback(async () => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("dealership_id", tenant.dealership_id)
      .order("preferred_date", { ascending: true });
    if (data) setAppointments(data);
  }, [tenant.dealership_id]);

  const fetchActivityLog = useCallback(async (submissionId: string) => {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivityLog(data || []);
  }, []);

  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/login");
      return;
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();
    if (!roleData) {
      await supabase.auth.signOut();
      navigate("/admin/login");
      return;
    }
    setUserRole(roleData.role);
    setUserId(session.user.id);
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", session.user.id)
      .maybeSingle();
    setUserName(profileData?.display_name || session.user.email || "");
    setUserEmail(session.user.email || "");
    if (roleData.role === "admin") {
      const { count } = await supabase
        .from("permission_access_requests" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setPermissionRequestCount(count || 0);
    }
    if (["admin", "gsm_gm"].includes(roleData.role)) {
      const { count } = await supabase
        .from("pricing_model_access_requests" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setPricingAccessRequestCount(count || 0);
    }
    const { data: configData } = await supabase
      .from("site_config")
      .select("show_request_access")
      .eq("dealership_id", tenant.dealership_id)
      .maybeSingle();
    setShowRequestAccessToggle((configData as any)?.show_request_access ?? true);
  }, [navigate, tenant.dealership_id]);

  // ── Effects ──

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("admin-dark-mode", darkMode.toString());
    return () => {
      root.classList.remove("dark");
    };
  }, [darkMode]);

  useEffect(() => {
    if (userRole) {
      fetchSubmissions();
      fetchAppointments();
      fetchLocations();
      if (canManageAccess) fetchPendingRequests();
    }
  }, [page, userRole]);

  // ── Handlers ──

  const handleView = useCallback(
    async (sub: Submission) => {
      setSelected(sub);
      setDocs([]);
      setActivityLog([]);
      setSelectedApptTime(null);
      setSelectedApptLocation(null);
      setOptOutStatus({ email: false, sms: false });
      fetchActivityLog(sub.id);

      const warnings: string[] = [];
      if (sub.vin) {
        const { data } = await supabase.from("submissions").select("id").eq("vin", sub.vin).neq("id", sub.id).limit(3);
        if (data?.length) warnings.push(`VIN match: ${data.length} other submission(s)`);
      }
      if (sub.phone) {
        const { data } = await supabase.from("submissions").select("id").eq("phone", sub.phone).neq("id", sub.id).limit(3);
        if (data?.length) warnings.push(`Phone match: ${data.length} other submission(s)`);
      }
      setDuplicateWarnings((prev) => ({ ...prev, [sub.id]: warnings }));

      if (sub.email || sub.phone) {
        const optEmail = sub.email
          ? (await supabase.from("opt_outs").select("id").eq("email", sub.email).eq("channel", "email").maybeSingle()).data
          : null;
        const optSms = sub.phone
          ? (await supabase.from("opt_outs").select("id").eq("phone", sub.phone).eq("channel", "sms").maybeSingle()).data
          : null;
        setOptOutStatus({ email: !!optEmail, sms: !!optSms });
      }

      if (sub.appointment_set) {
        const { data: apptData } = await supabase
          .from("appointments")
          .select("preferred_time, store_location")
          .eq("submission_token", sub.token)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (apptData?.preferred_time) setSelectedApptTime(apptData.preferred_time);
        if ((apptData as any)?.store_location) setSelectedApptLocation((apptData as any).store_location);
      }

      const { data } = await supabase.storage.from("submission-photos").list(sub.token);
      if (data?.length) {
        const items: { url: string; name: string }[] = [];
        for (const file of data) {
          const { data: u } = await supabase.storage
            .from("submission-photos")
            .createSignedUrl(`${sub.token}/${file.name}`, 3600);
          if (u?.signedUrl) items.push({ url: u.signedUrl, name: file.name });
        }
        setPhotos(items);
      } else setPhotos([]);

      const docTypes = [
        "drivers_license", "drivers_license_front", "drivers_license_back", "registration",
        "title_inquiry", "title", "payoff_verification", "appraisal", "carfax", "window_sticker",
      ];
      const allDocs: { name: string; url: string; type: string }[] = [];
      for (const dt of docTypes) {
        const { data: files } = await supabase.storage.from("customer-documents").list(`${sub.token}/${dt}`);
        if (files?.length) {
          for (const f of files) {
            const { data: u } = await supabase.storage
              .from("customer-documents")
              .createSignedUrl(`${sub.token}/${dt}/${f.name}`, 3600);
            if (u?.signedUrl) allDocs.push({ name: f.name, url: u.signedUrl, type: dt });
          }
        }
      }
      setDocs(allDocs);
    },
    [fetchActivityLog]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this submission? This cannot be undone.")) return;
      const { error } = await supabase.from("submissions").delete().eq("id", id);
      if (!error) {
        toast({ title: "Deleted" });
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        setSelected(null);
      } else toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    },
    [toast]
  );

  const handleInlineStatusChange = useCallback(
    async (sub: Submission, newStatus: string) => {
      if (["deal_finalized", "check_request_submitted", "purchase_complete"].includes(newStatus) && !canApprove) {
        toast({ title: "Not authorized", variant: "destructive" });
        return;
      }
      const old = sub.progress_status;
      const { error } = await supabase
        .from("submissions")
        .update({ progress_status: newStatus, status_updated_at: new Date().toISOString() })
        .eq("id", sub.id);
      if (!error) {
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === sub.id ? { ...s, progress_status: newStatus, status_updated_at: new Date().toISOString() } : s
          )
        );
        await supabase.from("activity_log").insert({
          submission_id: sub.id,
          action: "Status Changed",
          old_value: getStatusLabel(old),
          new_value: getStatusLabel(newStatus),
          performed_by: auditLabel,
        });
        if (old !== "purchase_complete" && newStatus === "purchase_complete")
          supabase.functions.invoke("send-notification", { body: { trigger_key: "staff_deal_completed", submission_id: sub.id } }).catch(console.error);
        supabase.functions.invoke("send-notification", { body: { trigger_key: "status_change", submission_id: sub.id } }).catch(console.error);
        // Fire customer status notifications for key milestones
        if (newStatus === "offer_made" && old !== "offer_made")
          supabase.functions.invoke("send-notification", { body: { trigger_key: "customer_offer_ready", submission_id: sub.id } }).catch(console.error);
        if (newStatus === "purchase_complete" && old !== "purchase_complete")
          supabase.functions.invoke("send-notification", { body: { trigger_key: "customer_deal_completed", submission_id: sub.id } }).catch(console.error);
        toast({ title: "Status updated" });
      }
    },
    [canApprove, auditLabel, toast]
  );

  const handleApprove = useCallback(
    async (request: PendingRequest) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: request.user_id, role: approveRole as any });
      if (error) {
        toast({ title: "Error", variant: "destructive" });
        return;
      }
      await supabase
        .from("pending_admin_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", request.id);
      toast({ title: "Approved", description: `${request.email} granted ${ROLE_LABELS[approveRole] || approveRole} access.` });
      fetchPendingRequests();
    },
    [approveRole, toast, fetchPendingRequests]
  );

  const handleReject = useCallback(
    async (request: PendingRequest) => {
      await supabase
        .from("pending_admin_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", request.id);
      toast({ title: "Rejected" });
      fetchPendingRequests();
    },
    [toast, fetchPendingRequests]
  );

  const handleScheduleAppt = useCallback(() => {
    setActiveSection("appointments");
  }, []);

  return {
    // State
    darkMode, setDarkMode,
    submissions, setSubmissions,
    loading,
    search, setSearch,
    statusFilter, setStatusFilter,
    sourceFilter, setSourceFilter,
    storeFilter, setStoreFilter,
    dateRangeFilter, setDateRangeFilter,
    selected, setSelected,
    photos, setPhotos,
    docs, setDocs,
    page, setPage,
    total,
    pendingRequests,
    appointments, setAppointments,
    userRole, userName,
    showFilterPanel, setShowFilterPanel,
    activityLog,
    duplicateWarnings,
    selectedApptTime, selectedApptLocation,
    optOutStatus,
    activeSection, setActiveSection,
    onboardingDealershipId, setOnboardingDealershipId,
    onboardingDealerName, setOnboardingDealerName,
    dealerLocations,
    userId,
    permissionRequestCount,
    pricingAccessRequestCount,
    showRequestAccessDialog, setShowRequestAccessDialog,
    showRequestAccessToggle,
    approveRole, setApproveRole,

    // Derived
    canSetPrice, canApprove, canDelete, canManageAccess,
    allowedSections, auditLabel, tenant,

    // Handlers
    handleView, handleDelete, handleInlineStatusChange,
    handleApprove, handleReject, handleScheduleAppt,
    fetchSubmissions, fetchAppointments, fetchActivityLog,

    // Navigation
    navigate, toast,
  };
}
