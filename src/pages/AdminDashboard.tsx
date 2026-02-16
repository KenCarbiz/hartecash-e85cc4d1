import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search, Trash2, Eye, ChevronLeft, ChevronRight, UserCheck, UserX, Users, Check, Circle, DollarSign, StickyNote, XCircle, Save, Printer, FileText, QrCode, ExternalLink, ClipboardCheck, Upload, CalendarDays, Plus, Phone, Mail, AlertTriangle, Clock, History } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { QRCodeSVG } from "qrcode.react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import harteLogo from "@/assets/harte-logo.png";
import StaffManagement from "@/components/admin/StaffManagement";
import StaffFileUpload from "@/components/admin/StaffFileUpload";
import DashboardAnalytics from "@/components/admin/DashboardAnalytics";
import { Badge } from "@/components/ui/badge";

interface PendingRequest {
  id: string;
  user_id: string;
  email: string;
  status: string;
  created_at: string;
}

interface Appointment {
  id: string;
  submission_token: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_date: string;
  preferred_time: string;
  vehicle_info: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface Submission {
  id: string;
  token: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  zip: string | null;
  state: string | null;
  plate: string | null;
  vin: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  mileage: string | null;
  overall_condition: string | null;
  next_step: string | null;
  photos_uploaded: boolean;
  loan_status: string | null;
  exterior_color: string | null;
  drivetrain: string | null;
  modifications: string | null;
  exterior_damage: string[] | null;
  windshield_damage: string | null;
  moonroof: string | null;
  interior_damage: string[] | null;
  tech_issues: string[] | null;
  engine_issues: string[] | null;
  mechanical_issues: string[] | null;
  drivable: string | null;
  accidents: string | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  progress_status: string;
  offered_price: number | null;
  acv_value: number | null;
  appraised_by: string | null;
  check_request_done: boolean;
  internal_notes: string | null;
  status_updated_by: string | null;
  status_updated_at: string | null;
  appointment_date: string | null;
  appointment_set: boolean;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  lead_source: string;
}

const PAGE_SIZE = 20;

const PROGRESS_STAGES = [
  { key: "new", label: "New Lead" },
  { key: "contacted", label: "Customer Contacted" },
  { key: "inspection_scheduled", label: "In-Person Inspection Scheduled" },
  { key: "inspection_completed", label: "In-Person Inspection Completed" },
  { key: "title_verified", label: "Title Verified" },
  { key: "ownership_verified", label: "Ownership Verified" },
  { key: "appraisal_completed", label: "Final Appraisal Completed" },
  { key: "manager_approval", label: "Manager / Appraiser Approval" },
  { key: "price_agreed", label: "Price Agreed" },
  { key: "purchase_complete", label: "Purchase Complete" },
  { key: "dead_lead", label: "Dead Lead" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales_bdc: "Sales / BDC",
  used_car_manager: "Used Car Manager",
  gsm_gm: "GSM / GM",
};

const AdminDashboard = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [selected, setSelected] = useState<Submission | null>(null);
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [docs, setDocs] = useState<{ name: string; url: string; type: string }[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showCreateAppt, setShowCreateAppt] = useState(false);
  const [apptForm, setApptForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    preferred_date: "",
    preferred_time: "",
    vehicle_info: "",
    notes: "",
    submission_token: "",
  });
  const [creatingAppt, setCreatingAppt] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activityLog, setActivityLog] = useState<{ id: string; action: string; old_value: string | null; new_value: string | null; performed_by: string | null; created_at: string }[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, string[]>>({});
  const [selectedApptTime, setSelectedApptTime] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const canSetPrice = ["admin", "used_car_manager", "gsm_gm"].includes(userRole);
  const canApprove = ["admin", "gsm_gm"].includes(userRole);
  const canDelete = userRole === "admin";
  const canManageAccess = userRole === "admin";
  const canUpdateStatus = true; // all staff

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchSubmissions();
      fetchAppointments();
      if (canManageAccess) fetchPendingRequests();
    }
  }, [page, userRole]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
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
    } else {
      setUserRole(roleData.role);
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("submissions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error && data) {
      setSubmissions(data);
      setTotal(count || 0);
    }
    setLoading(false);
  };

  const fetchPendingRequests = async () => {
    const { data } = await supabase
      .from("pending_admin_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setPendingRequests(data);
  };

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .order("preferred_date", { ascending: true });
    if (data) setAppointments(data);
  };

  const handleCreateAppointment = async () => {
    if (!apptForm.customer_name || !apptForm.customer_email || !apptForm.customer_phone || !apptForm.preferred_date || !apptForm.preferred_time) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setCreatingAppt(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        customer_name: apptForm.customer_name,
        customer_email: apptForm.customer_email,
        customer_phone: apptForm.customer_phone,
        preferred_date: apptForm.preferred_date,
        preferred_time: apptForm.preferred_time,
        vehicle_info: apptForm.vehicle_info || null,
        notes: apptForm.notes || null,
        submission_token: apptForm.submission_token || null,
      });
      if (error) throw error;

      // If linked to a submission, update its status and appointment info
      if (apptForm.submission_token) {
        await supabase
          .from("submissions")
          .update({
            progress_status: "inspection_scheduled",
            status_updated_at: new Date().toISOString(),
            appointment_date: apptForm.preferred_date,
            appointment_set: true,
          })
          .eq("token", apptForm.submission_token);
        fetchSubmissions();
        // Update selected submission if viewing it
        if (selected && selected.token === apptForm.submission_token) {
          setSelected({ ...selected, appointment_set: true, appointment_date: apptForm.preferred_date, progress_status: "inspection_scheduled" });
        }
      }

      // Send staff notification
      supabase.functions.invoke("notify-appointment", {
        body: { appointment: apptForm },
      });

      // Send customer confirmation email
      supabase.functions.invoke("send-appointment-confirmation", {
        body: { appointment: apptForm },
      });

      toast({ title: "Appointment created", description: `Scheduled for ${apptForm.preferred_date} at ${apptForm.preferred_time}.` });
      setShowCreateAppt(false);
      setApptForm({ customer_name: "", customer_email: "", customer_phone: "", preferred_date: "", preferred_time: "", vehicle_info: "", notes: "", submission_token: "" });
      fetchAppointments();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingAppt(false);
    }
  };

  const handleUpdateApptStatus = async (id: string, status: string) => {
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) return;

    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (!error) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      
      // Send confirmation email if status is "Confirmed"
      if (status === "Confirmed") {
        try {
          await supabase.functions.invoke("send-appointment-confirmation", {
            body: { appointment },
          });
        } catch (e) {
          // Error logged server-side via edge function
          toast({ title: "Warning", description: "Status updated but confirmation email failed.", variant: "destructive" });
        }
      }
      
      toast({ title: "Updated", description: `Appointment marked as ${status}.` });
    }
  };

  const APPT_TIME_SLOTS_WEEKDAY = [
    "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
    "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
    "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
    "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM",
  ];
  const APPT_TIME_SLOTS_FRISSAT = [
    "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
    "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
    "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
    "5:00 PM", "5:30 PM",
  ];
  const getApptTimeSlots = () => {
    if (!apptForm.preferred_date) return APPT_TIME_SLOTS_WEEKDAY;
    const day = new Date(apptForm.preferred_date + "T12:00:00").getDay();
    if (day === 0) return [];
    if (day === 5 || day === 6) return APPT_TIME_SLOTS_FRISSAT;
    return APPT_TIME_SLOTS_WEEKDAY;
  };

  const [approveRole, setApproveRole] = useState<string>("sales_bdc");

  const handleApprove = async (request: PendingRequest) => {
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: request.user_id,
      role: approveRole as any,
    });
    if (roleError) {
      toast({ title: "Error", description: "Failed to grant role.", variant: "destructive" });
      return;
    }
    await supabase
      .from("pending_admin_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", request.id);
    toast({ title: "Approved", description: `${request.email} granted ${ROLE_LABELS[approveRole] || approveRole} access.` });
    fetchPendingRequests();
  };

  const handleReject = async (request: PendingRequest) => {
    await supabase
      .from("pending_admin_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", request.id);
    toast({ title: "Rejected", description: `${request.email} was denied access.` });
    fetchPendingRequests();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this submission? This cannot be undone.")) return;

    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete submission.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Submission removed." });
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setSelected(null);
    }
  };

  const handleDeletePhoto = async (fileName: string) => {
    if (!selected || !canDelete) return;
    if (!confirm(`Delete photo "${fileName}"? This cannot be undone.`)) return;
    const { error } = await supabase.storage.from("submission-photos").remove([`${selected.token}/${fileName}`]);
    if (error) {
      toast({ title: "Error", description: "Failed to delete photo.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Photo removed." });
      setPhotos((prev) => prev.filter((p) => p.name !== fileName));
    }
  };

  const handleDeleteDoc = async (docType: string, fileName: string) => {
    if (!selected || !canDelete) return;
    if (!confirm(`Delete document "${fileName}"? This cannot be undone.`)) return;
    const { error } = await supabase.storage.from("customer-documents").remove([`${selected.token}/${docType}/${fileName}`]);
    if (error) {
      toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Document removed." });
      setDocs((prev) => prev.filter((d) => !(d.type === docType && d.name === fileName)));
    }
  };

  const DOC_TYPE_LABELS: Record<string, string> = {
    drivers_license: "Driver's License",
    registration: "Registration",
    title_inquiry: "Title Inquiry",
    title: "Title",
    payoff_verification: "Payoff Verification",
    appraisal: "Appraisal",
    carfax: "Carfax",
    window_sticker: "Window Sticker",
  };

  const handleView = async (sub: Submission) => {
    setSelected(sub);
    setDocs([]);
    setActivityLog([]);
    setSelectedApptTime(null);
    fetchActivityLog(sub.id);
    checkDuplicates(sub);

    // Fetch linked appointment time
    if (sub.appointment_set) {
      const { data: apptData } = await supabase
        .from("appointments")
        .select("preferred_time")
        .eq("submission_token", sub.token)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (apptData?.preferred_time) setSelectedApptTime(apptData.preferred_time);
    }
    // Fetch photos
    const { data } = await supabase.storage
      .from("submission-photos")
      .list(sub.token);

    if (data && data.length > 0) {
      const photoItems: { url: string; name: string }[] = [];
      for (const file of data) {
        const { data: urlData } = await supabase.storage
          .from("submission-photos")
          .createSignedUrl(`${sub.token}/${file.name}`, 3600);
        if (urlData?.signedUrl) photoItems.push({ url: urlData.signedUrl, name: file.name });
      }
      setPhotos(photoItems);
    } else {
      setPhotos([]);
    }

    // Fetch documents from customer-documents bucket
    const docTypes = ["drivers_license", "registration", "title_inquiry", "title", "payoff_verification", "appraisal", "carfax", "window_sticker"];
    const allDocs: { name: string; url: string; type: string }[] = [];
    for (const docType of docTypes) {
      const { data: docFiles } = await supabase.storage
        .from("customer-documents")
        .list(sub.token + "/" + docType);
      if (docFiles && docFiles.length > 0) {
        for (const file of docFiles) {
          const { data: urlData } = await supabase.storage
            .from("customer-documents")
            .createSignedUrl(sub.token + "/" + docType + "/" + file.name, 3600);
          if (urlData?.signedUrl) {
            allDocs.push({ name: file.name, url: urlData.signedUrl, type: docType });
          }
        }
      }
    }
    setDocs(allDocs);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const handleInlineStatusChange = async (sub: Submission, newStatus: string) => {
    if (["manager_approval", "price_agreed", "purchase_complete"].includes(newStatus) && !canApprove) {
      toast({ title: "Not authorized", description: "Only GSM/GM can set this status.", variant: "destructive" });
      return;
    }
    const oldStatus = sub.progress_status;
    const { error } = await supabase
      .from("submissions")
      .update({ progress_status: newStatus, status_updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (!error) {
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, progress_status: newStatus, status_updated_at: new Date().toISOString() } : s));
      // Log activity
      await supabase.from("activity_log").insert({
        submission_id: sub.id,
        action: "Status Changed",
        old_value: PROGRESS_STAGES.find(s => s.key === oldStatus)?.label || oldStatus,
        new_value: PROGRESS_STAGES.find(s => s.key === newStatus)?.label || newStatus,
        performed_by: userRole,
      });
      toast({ title: "Status updated" });
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getDaysSinceUpdate = (sub: Submission) => {
    const refDate = sub.status_updated_at || sub.created_at;
    const days = Math.floor((Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getAgingColor = (days: number, status: string) => {
    if (["purchase_complete", "dead_lead"].includes(status)) return "text-muted-foreground";
    if (days <= 2) return "text-success";
    if (days <= 5) return "text-yellow-600";
    return "text-destructive";
  };

  const fetchActivityLog = async (submissionId: string) => {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivityLog(data || []);
  };

  const checkDuplicates = async (sub: Submission) => {
    const warnings: string[] = [];
    if (sub.vin) {
      const { data } = await supabase
        .from("submissions")
        .select("id, name, created_at")
        .eq("vin", sub.vin)
        .neq("id", sub.id)
        .limit(3);
      if (data && data.length > 0) {
        warnings.push(`VIN match: ${data.length} other submission(s) with same VIN`);
      }
    }
    if (sub.phone) {
      const { data } = await supabase
        .from("submissions")
        .select("id, name, created_at")
        .eq("phone", sub.phone)
        .neq("id", sub.id)
        .limit(3);
      if (data && data.length > 0) {
        warnings.push(`Phone match: ${data.length} other submission(s) with same phone`);
      }
    }
    setDuplicateWarnings(prev => ({ ...prev, [sub.id]: warnings }));
  };

  const handlePrint = () => {
    if (!selected) return;
    const s = selected;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const css = [
      "* { margin: 0; padding: 0; box-sizing: border-box; }",
      "body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; color: #1a2a3a; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
      ".header { background: #2a4365; color: white; padding: 20px 24px; }",
      ".header h1 { font-size: 20px; font-weight: 700; }",
      ".header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }",
      ".content { padding: 16px 24px; }",
      ".section { background: #f3f5f7; border: 1px solid #e2e6ea; border-radius: 8px; padding: 16px; margin-bottom: 14px; page-break-inside: avoid; }",
      ".section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7b8d; margin-bottom: 10px; }",
      ".grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }",
      ".row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e8ecef; }",
      ".row:last-child { border-bottom: none; }",
      ".label { font-size: 13px; color: #6b7b8d; }",
      ".value { font-size: 13px; font-weight: 500; text-align: right; max-width: 60%; }",
      ".stage { display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 6px; margin-bottom: 4px; }",
      ".stage-dot { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; flex-shrink: 0; }",
      ".stage-complete { background: rgba(56,161,105,0.15); }",
      ".stage-complete .stage-dot { background: #38a169; }",
      ".stage-current { background: rgba(229,62,62,0.2); }",
      ".stage-current .stage-dot { background: #e53e3e; }",
      ".stage-current .stage-label { font-weight: 700; }",
      ".stage-dead { background: rgba(229,62,62,0.15); }",
      ".stage-dead .stage-dot { background: #e53e3e; }",
      ".stage-dead .stage-label { font-weight: 700; color: #e53e3e; }",
      ".stage-label { font-size: 13px; }",
      ".stage-inactive .stage-label { color: #9aa5b4; }",
      ".stage-inactive .stage-dot { background: #d1d5db; }",
      ".photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }",
      ".photos-grid img { width: 100%; height: 100px; object-fit: cover; border-radius: 6px; }",
      ".doc-section { page-break-before: always; }",
      ".doc-section h3 { font-size: 13px; font-weight: 700; color: #4a5568; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }",
      ".doc-img { max-width: 100%; margin-bottom: 12px; border: 1px solid #d1d5db; border-radius: 6px; }",
      ".notes { white-space: pre-wrap; font-size: 13px; color: #4a5568; background: white; padding: 8px; border-radius: 4px; border: 1px solid #e2e6ea; }",
      "@page { margin: 0.5in; size: letter; }",
    ].join("\n");

    const makeRow = (label: string, value: string) =>
      '<div class="row"><span class="label">' + label + '</span><span class="value">' + value + "</span></div>";

    const makeSection = (title: string, rows: [string, string | null | undefined][]) => {
      const valid = rows.filter(([, v]) => v != null && v !== "" && v !== "none");
      if (valid.length === 0) return "";
      return '<div class="section"><div class="section-title">' + title + '</div><div class="grid">' +
        valid.map(([l, v]) => makeRow(l, v!)).join("") + "</div></div>";
    };

    const arrVal = (a: string[] | null) =>
      a && a.length > 0 && !(a.length === 1 && a[0] === "none") ? a.join(", ") : null;

    const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || null;

    // Build deal progress HTML
    const isDeadLead = s.progress_status === "dead_lead";
    const currentIdx = PROGRESS_STAGES.findIndex(st => st.key === s.progress_status);
    const progressHtml = PROGRESS_STAGES.map((st, i) => {
      const isComplete = !isDeadLead && i < currentIdx;
      const isCurrent = i === currentIdx;
      const isDead = st.key === "dead_lead" && isDeadLead;
      const cls = isDead ? "stage stage-dead" : isComplete ? "stage stage-complete" : isCurrent ? "stage stage-current" : "stage stage-inactive";
      const dot = isDead ? "✕" : isComplete ? "✓" : "○";
      return '<div class="' + cls + '"><div class="stage-dot">' + dot + '</div><span class="stage-label">' + st.label + "</span></div>";
    }).join("");

    const photosHtml = photos.length > 0
      ? '<div class="section"><div class="section-title">Photos (' + photos.length + ')</div><div class="photos-grid">' +
        photos.map(p => '<img src="' + p.url + '" />').join("") + "</div></div>"
      : "";

    const notesHtml = s.internal_notes
      ? '<div class="section"><div class="section-title">Internal Notes</div><div class="notes">' + s.internal_notes + "</div></div>"
      : "";

    const priceSection = s.offered_price
      ? makeSection("Offered Price", [["Amount", "$" + s.offered_price.toLocaleString()]])
      : "";

    const docsUrl = getDocsUrl(s.token);

    // Build uploaded documents HTML grouped by type
    const groupedDocs: Record<string, string[]> = {};
    docs.forEach(d => {
      if (!groupedDocs[d.type]) groupedDocs[d.type] = [];
      groupedDocs[d.type].push(d.url);
    });
    const docsHtml = Object.keys(groupedDocs).length > 0
      ? Object.entries(groupedDocs).map(([type, urls]) => {
          const label = DOC_TYPE_LABELS[type] || type;
          const images = urls.map(u => {
            const isPdf = u.includes(".pdf");
            return isPdf
              ? '<p style="font-size:13px;color:#4a5568;">[PDF Document]</p>'
              : '<img class="doc-img" src="' + u + '" />';
          }).join("");
          return '<div class="doc-section"><div class="section"><div class="section-title">' + label + '</div>' + images + '</div></div>';
        }).join("")
      : "";

    const html = "<!DOCTYPE html><html><head><title>Submission Details</title><style>" + css + "</style></head><body>" +
      '<div class="header"><h1>' + (vehicleStr || "Submission Details") + "</h1>" +
      "<p>Submitted " + new Date(s.created_at).toLocaleDateString() + " &bull; " + (s.name || "Unknown") + "</p></div>" +
      '<div class="content">' +
      makeSection("Contact Information", [["Name", s.name], ["Phone", s.phone], ["Email", s.email], ["ZIP", s.zip], ["Address", [(s as any).address_street, (s as any).address_city, (s as any).address_state, s.zip].filter(Boolean).join(", ") || null]]) +
      makeSection("Vehicle Details", [
        ["Year/Make/Model", vehicleStr], ["VIN", s.vin], ["Plate", s.plate], ["Mileage", s.mileage],
        ["Exterior Color", s.exterior_color], ["Drivetrain", s.drivetrain], ["Modifications", s.modifications],
      ]) +
      makeSection("Condition & History", [
        ["Overall", s.overall_condition], ["Drivable", s.drivable],
        ["Exterior Damage", arrVal(s.exterior_damage)], ["Windshield", s.windshield_damage],
        ["Moonroof", s.moonroof], ["Interior Damage", arrVal(s.interior_damage)],
        ["Tech Issues", arrVal(s.tech_issues)], ["Engine Issues", arrVal(s.engine_issues)],
        ["Mechanical Issues", arrVal(s.mechanical_issues)], ["Accidents", s.accidents],
        ["Smoked In", s.smoked_in], ["Tires Replaced", s.tires_replaced], ["Keys", s.num_keys],
      ]) +
      makeSection("Loan & Info", [["Loan Status", s.loan_status], ["Next Step", s.next_step]]) +
      '<div class="section"><div class="section-title">Appointment</div><p style="font-size:13px;color:#4a5568;">' +
        (s.appointment_set && s.appointment_date
          ? new Date(s.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
          : "No appointment yet") +
      '</p></div>' +
      '<div class="section"><div class="section-title">Deal Progress</div>' + progressHtml + "</div>" +
      priceSection +
      notesHtml +
      photosHtml +
      docsHtml +
      '<div class="section"><div class="section-title">Customer Documents Upload Link</div>' +
      '<p style="font-size:13px;color:#4a5568;word-break:break-all;">' + docsUrl + "</p></div>" +
      "</div></body></html>";

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for images to load then print
    const images = printWindow.document.querySelectorAll("img");
    let loaded = 0;
    const totalImages = images.length;
    const triggerPrint = () => { printWindow.focus(); printWindow.print(); };
    if (totalImages === 0) {
      setTimeout(triggerPrint, 200);
    } else {
      images.forEach(img => {
        img.onload = img.onerror = () => { loaded++; if (loaded >= totalImages) setTimeout(triggerPrint, 200); };
      });
    }
  };

  const getDocsUrl = (token: string) => {
    return `${window.location.origin}/docs/${token}`;
  };

  const handleGenerateCheckRequest = async () => {
    if (!selected || !selected.offered_price) return;
    const s = selected;
    const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "N/A";
    const today = new Date().toLocaleDateString();

    // Fetch appraisal documents
    let appraisalImages: string[] = [];
    const { data: appraisalFiles } = await supabase.storage
      .from("customer-documents")
      .list(`${s.id}/appraisal`);
    if (appraisalFiles && appraisalFiles.length > 0) {
      for (const f of appraisalFiles) {
        const { data } = await supabase.storage.from("customer-documents").createSignedUrl(`${s.id}/appraisal/${f.name}`, 3600);
        if (data?.signedUrl) appraisalImages.push(data.signedUrl);
      }
    }

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const css = [
      "* { margin: 0; padding: 0; box-sizing: border-box; }",
      "body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; color: #1a2a3a; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
      ".header { background: #2a4365; color: white; padding: 24px 32px; text-align: center; }",
      ".header h1 { font-size: 22px; font-weight: 700; }",
      ".header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }",
      ".content { padding: 24px 32px; }",
      ".title { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2px; }",
      "table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }",
      "th, td { padding: 10px 14px; text-align: left; border: 1px solid #d1d5db; font-size: 14px; }",
      "th { background: #f3f5f7; font-weight: 600; color: #4a5568; width: 40%; }",
      "td { font-weight: 500; }",
      ".amount { font-size: 22px; font-weight: 700; color: #2a4365; }",
      ".acv { font-size: 18px; font-weight: 600; color: #4a5568; }",
      ".sig-section { margin-top: 40px; display: flex; justify-content: space-between; }",
      ".sig-line { width: 45%; border-top: 1px solid #1a2a3a; padding-top: 6px; font-size: 12px; color: #6b7b8d; }",
      ".appraisal-section { page-break-before: always; padding: 24px 32px; }",
      ".appraisal-section h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; color: #2a4365; }",
      ".appraisal-img { max-width: 100%; margin-bottom: 16px; border: 1px solid #d1d5db; }",
      "@page { margin: 0.75in; size: letter; }",
    ].join("\n");

    const appraisalHtml = appraisalImages.length > 0 ? `
      <div class="appraisal-section">
        <h2>Appraisal Document</h2>
        ${appraisalImages.map(url => `<img class="appraisal-img" src="${url}" />`).join("")}
      </div>
    ` : "";

    const html = `<!DOCTYPE html><html><head><title>Check Request</title><style>${css}</style></head><body>
      <div class="header"><h1>Harte Auto Group</h1><p>Check Request Form</p></div>
      <div class="content">
        <p class="title">Check Request</p>
        <table>
          <tr><th>Date</th><td>${today}</td></tr>
          <tr><th>Customer Name (As It Appears on Title)</th><td>${s.name || ""}</td></tr>
          <tr><th>Address</th><td style="border-bottom:1px solid #ccc;min-width:200px;">&nbsp;</td></tr>
          <tr><th>City, State, Zip</th><td style="text-align:right;">${[s.state, s.zip].filter(Boolean).join(" ") || ""}</td></tr>
          <tr><th>Contact Phone</th><td>${s.phone || ""}</td></tr>
          <tr><th>Contact Email</th><td>${s.email || ""}</td></tr>
          <tr><th>Agreed Upon Value (Check Amount)</th><td class="amount">$${s.offered_price!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
          <tr><th>In-House ACV (Actual Cash Value)</th><td class="acv">${s.acv_value ? "$" + s.acv_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}</td></tr>
          <tr><th>Description</th><td style="font-weight:600;">Customer Direct Inventory Purchase</td></tr>
          <tr><th>Vehicle</th><td>${vehicleStr}</td></tr>
          <tr><th>VIN</th><td>${s.vin || "N/A"}</td></tr>
          <tr><th>Mileage</th><td>${s.mileage || "N/A"}</td></tr>
        </table>
        <div class="sig-section">
          <div class="sig-line">GSM / GM Signature</div>
          <div class="sig-line">Date</div>
        </div>
        <div class="sig-section" style="margin-top:30px;">
          <div class="sig-line">Accounting Use – Check #</div>
          <div class="sig-line">Date Issued</div>
        </div>
      </div>
      ${appraisalHtml}
    </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 300);
  };

  const filtered = submissions.filter((s) => {
    // Text search
    if (search) {
      const q = search.toLowerCase();
      const matchesSearch =
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.vin?.toLowerCase().includes(q) ||
        s.plate?.toLowerCase().includes(q) ||
        `${s.vehicle_year} ${s.vehicle_make} ${s.vehicle_model}`.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter && statusFilter !== "__all__" && s.progress_status !== statusFilter) return false;

    // Source filter
    if (sourceFilter && sourceFilter !== "__all__" && s.lead_source !== sourceFilter) return false;

    // Date range filter
    if (dateRangeFilter.from || dateRangeFilter.to) {
      const submissionDate = new Date(s.created_at).toISOString().split('T')[0];
      if (dateRangeFilter.from && submissionDate < dateRangeFilter.from) return false;
      if (dateRangeFilter.to && submissionDate > dateRangeFilter.to) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-1.5 border-b border-border last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-card-foreground text-right max-w-[60%]">{value}</span>
      </div>
    );
  };

  const ArrayDetail = ({ label, value }: { label: string; value: string[] | null | undefined }) => {
    if (!value || value.length === 0 || (value.length === 1 && value[0] === "none")) return null;
    return (
      <DetailRow label={label} value={value.join(", ")} />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={harteLogo} alt="Harte Auto Group" className="h-10 w-auto" />
            <div>
              <span className="text-lg font-bold text-card-foreground">Dashboard</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium">
                {ROLE_LABELS[userRole] || userRole}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <Tabs defaultValue="submissions">
          <TabsList className="mb-4">
            <TabsTrigger value="submissions">Submissions ({total})</TabsTrigger>
            <TabsTrigger value="appointments">
              <CalendarDays className="w-4 h-4 mr-1" />
              Appointments ({appointments.length})
            </TabsTrigger>
            {canManageAccess && (
              <>
                <TabsTrigger value="staff">
                  <Users className="w-4 h-4 mr-1" />
                  Staff
                </TabsTrigger>
                <TabsTrigger value="requests" className="relative">
                  <Users className="w-4 h-4 mr-1" />
                  Access Requests
                  {pendingRequests.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                      {pendingRequests.length}
                    </span>
                  )}
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Analytics Dashboard */}
          <div className="mb-6">
            <DashboardAnalytics />
          </div>

          <TabsContent value="submissions">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant={showFilterPanel ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
              >
                Filter {(statusFilter || sourceFilter || dateRangeFilter.from || dateRangeFilter.to) && "*"}
              </Button>
            </div>

            {showFilterPanel && (
              <div className="mb-4 bg-muted/40 rounded-lg border border-border p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All statuses</SelectItem>
                        {PROGRESS_STAGES.map(stage => (
                          <SelectItem key={stage.key} value={stage.key}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Lead Source</Label>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All sources</SelectItem>
                        <SelectItem value="inventory">Inventory</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">From Date</Label>
                    <Input
                      type="date"
                      value={dateRangeFilter.from}
                      onChange={(e) => setDateRangeFilter(prev => ({ ...prev, from: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">To Date</Label>
                    <Input
                      type="date"
                      value={dateRangeFilter.to}
                      onChange={(e) => setDateRangeFilter(prev => ({ ...prev, to: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusFilter("__all__");
                      setSourceFilter("__all__");
                      setDateRangeFilter({ from: "", to: "" });
                    }}
                    className="text-xs"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading submissions...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No submissions found.</div>
            ) : (
              <>
                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-[1100px] text-sm">
                      <thead>
                         <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">Date</th>
                          <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">Name</th>
                          <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">Vehicle</th>
                          <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">VIN</th>
                          <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">Contact</th>
                          <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">Photos</th>
                          <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">Source</th>
                          <th className="text-left px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap min-w-[160px]">Status</th>
                          <th className="text-center px-2 py-3 font-semibold text-muted-foreground whitespace-nowrap">Age</th>
                          <th className="text-right px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((sub) => (
                          <tr key={sub.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-3 whitespace-nowrap">
                              {new Date(sub.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-3 font-medium text-card-foreground whitespace-nowrap">
                              {sub.name || "—"}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {sub.vehicle_year && sub.vehicle_make
                                ? `${sub.vehicle_year} ${sub.vehicle_make} ${sub.vehicle_model || ""}`
                                : sub.plate || "—"}
                            </td>
                            <td className="px-3 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                              {sub.vin || "—"}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div>{sub.email || "—"}</div>
                              <div className="text-muted-foreground text-xs">{sub.phone || ""}</div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sub.photos_uploaded ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                                {sub.photos_uploaded ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant={sub.lead_source === "service" ? "secondary" : "outline"} className="text-xs">
                                {sub.lead_source === "service" ? "Service" : "Inventory"}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <Select
                                value={sub.progress_status}
                                onValueChange={(val) => handleInlineStatusChange(sub, val)}
                              >
                                <SelectTrigger className={`w-44 h-7 text-xs font-medium ${
                                  sub.progress_status === "purchase_complete" ? "border-success/50 text-success" :
                                  sub.progress_status === "dead_lead" ? "border-destructive/50 text-destructive" :
                                  sub.progress_status === "new" ? "border-muted text-muted-foreground" :
                                  "border-accent/50 text-accent"
                                }`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PROGRESS_STAGES.map(s => {
                                    const isApprovalStage = ["manager_approval", "price_agreed", "purchase_complete"].includes(s.key);
                                    return (
                                      <SelectItem key={s.key} value={s.key} disabled={isApprovalStage && !canApprove}>
                                        {s.label}{isApprovalStage && !canApprove ? " 🔒" : ""}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-3 text-center">
                              {(() => {
                                const days = getDaysSinceUpdate(sub);
                                const color = getAgingColor(days, sub.progress_status);
                                return (
                                  <span className={`text-xs font-bold ${color}`} title={`${days}d since last update`}>
                                    {days}d
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleView(sub)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {canDelete && (
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(sub.id)} className="text-destructive hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="appointments">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Scheduled Appointments</h2>
              <Button size="sm" onClick={() => setShowCreateAppt(true)}>
                <Plus className="w-4 h-4 mr-1" /> New Appointment
              </Button>
            </div>
            {appointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No appointments scheduled yet.</div>
            ) : (
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date & Time</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Contact</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vehicle</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((appt) => (
                        <tr key={appt.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-medium text-card-foreground">{new Date(appt.preferred_date + "T12:00:00").toLocaleDateString()}</div>
                            <div className="text-xs text-muted-foreground">{appt.preferred_time}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-card-foreground">{appt.customer_name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-muted-foreground text-xs"><Mail className="w-3 h-3" />{appt.customer_email}</div>
                            <div className="flex items-center gap-1 text-muted-foreground text-xs"><Phone className="w-3 h-3" />{appt.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{appt.vehicle_info || "—"}</td>
                          <td className="px-4 py-3">
                            <Select value={appt.status} onValueChange={(v) => handleUpdateApptStatus(appt.id, v)}>
                              <SelectTrigger className="w-32 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="no_show">No Show</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {appt.submission_token && (
                              <Button variant="ghost" size="sm" onClick={() => {
                                const sub = submissions.find(s => s.token === appt.submission_token);
                                if (sub) handleView(sub);
                              }}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="staff">
            <h2 className="text-lg font-semibold text-card-foreground mb-4">Staff Members</h2>
            <StaffManagement />
          </TabsContent>

          <TabsContent value="requests">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No pending access requests.</div>
            ) : (
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <table className="w-full text-sm">
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
                      <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-card-foreground">{req.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Select value={approveRole} onValueChange={setApproveRole}>
                            <SelectTrigger className="w-44">
                              <SelectValue />
                            </SelectTrigger>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setPhotos([]); setDocs([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 print:max-h-none print:overflow-visible">
          <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-6 py-4 rounded-t-lg print:static">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl font-bold text-primary-foreground">
                  {selected?.vehicle_year} {selected?.vehicle_make} {selected?.vehicle_model || "Submission Details"}
                </DialogTitle>
                <Button variant="ghost" size="sm" onClick={handlePrint} className="text-primary-foreground hover:bg-primary-foreground/20 print:hidden">
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
              </div>
              {selected && (
                <p className="text-primary-foreground/80 text-sm mt-1">
                  Submitted {new Date(selected.created_at).toLocaleDateString()} • {selected.name || "Unknown"}
                </p>
              )}
            </DialogHeader>
          </div>

          {selected && (
            <div className="px-6 pb-6 space-y-5 pt-4">
              {/* Duplicate Warning */}
              {duplicateWarnings[selected.id] && duplicateWarnings[selected.id].length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-destructive">Possible Duplicate</p>
                    {duplicateWarnings[selected.id].map((w, i) => (
                      <p key={i} className="text-xs text-destructive/80">{w}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Card - Editable */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      value={selected.name || ""}
                      onChange={(e) => setSelected({ ...selected, name: e.target.value || null })}
                      placeholder="Full name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input
                      value={selected.phone || ""}
                      onChange={(e) => setSelected({ ...selected, phone: e.target.value || null })}
                      placeholder="(555) 123-4567"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={selected.email || ""}
                      onChange={(e) => setSelected({ ...selected, email: e.target.value || null })}
                      placeholder="email@example.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">ZIP</Label>
                    <Input
                      value={selected.zip || ""}
                      onChange={(e) => setSelected({ ...selected, zip: e.target.value || null })}
                      placeholder="ZIP code"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <Label className="text-xs text-muted-foreground font-semibold block mb-2">Address</Label>
                  <div className="space-y-2">
                    <Input
                      value={(selected as any).address_street || ""}
                      onChange={(e) => setSelected({ ...selected, address_street: e.target.value || null })}
                      placeholder="Street address"
                      className="h-8 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={(selected as any).address_city || ""}
                        onChange={(e) => setSelected({ ...selected, address_city: e.target.value || null })}
                        placeholder="City"
                        className="h-8 text-sm col-span-1"
                      />
                      <Input
                        value={(selected as any).address_state || ""}
                        onChange={(e) => setSelected({ ...selected, address_state: e.target.value || null })}
                        placeholder="State"
                        className="h-8 text-sm col-span-1"
                      />
                      <Input
                        value={selected.zip || ""}
                        onChange={(e) => setSelected({ ...selected, zip: e.target.value || null })}
                        placeholder="ZIP"
                        className="h-8 text-sm col-span-1"
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Card */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Vehicle Details</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Year/Make/Model" value={`${selected.vehicle_year || ""} ${selected.vehicle_make || ""} ${selected.vehicle_model || ""}`.trim() || null} />
                  <DetailRow label="VIN" value={selected.vin} />
                  <DetailRow label="Plate" value={selected.plate} />
                  <DetailRow label="Mileage" value={selected.mileage} />
                  <DetailRow label="Exterior Color" value={selected.exterior_color} />
                  <DetailRow label="Drivetrain" value={selected.drivetrain} />
                  <DetailRow label="Modifications" value={selected.modifications} />
                </div>
              </div>

              {/* Condition Card */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Condition & History</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Overall" value={selected.overall_condition} />
                  <DetailRow label="Drivable" value={selected.drivable} />
                  <ArrayDetail label="Exterior Damage" value={selected.exterior_damage} />
                  <DetailRow label="Windshield" value={selected.windshield_damage} />
                  <DetailRow label="Moonroof" value={selected.moonroof} />
                  <ArrayDetail label="Interior Damage" value={selected.interior_damage} />
                  <ArrayDetail label="Tech Issues" value={selected.tech_issues} />
                  <ArrayDetail label="Engine Issues" value={selected.engine_issues} />
                  <ArrayDetail label="Mechanical Issues" value={selected.mechanical_issues} />
                  <DetailRow label="Accidents" value={selected.accidents} />
                  <DetailRow label="Smoked In" value={selected.smoked_in} />
                  <DetailRow label="Tires Replaced" value={selected.tires_replaced} />
                  <DetailRow label="Keys" value={selected.num_keys} />
                </div>
              </div>

              {/* Loan Info */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Loan & Info</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Loan Status" value={selected.loan_status} />
                  <DetailRow label="Loan Company" value={(selected as any).loan_company} />
                  <DetailRow label="Loan Balance" value={(selected as any).loan_balance} />
                  <DetailRow label="Loan Payment" value={(selected as any).loan_payment} />
                  <DetailRow label="Next Step" value={selected.next_step} />
                </div>
              </div>

              {/* Deal Progress with cumulative highlighting */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Deal Progress</h3>
                <div className="space-y-1.5">
                  {PROGRESS_STAGES.map((stage, i) => {
                    const isDeadLead = selected.progress_status === "dead_lead";
                    const currentIdx = PROGRESS_STAGES.findIndex(s => s.key === selected.progress_status);
                    const isComplete = !isDeadLead && i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const isDead = stage.key === "dead_lead" && isDeadLead;
                    return (
                      <div key={stage.key} data-print-stage={isDead ? "dead" : isComplete ? "complete" : isCurrent ? "current" : undefined} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors ${
                        isDead ? "bg-destructive/15" :
                        isComplete ? "bg-success/15" :
                        isCurrent ? "bg-accent/20" :
                        ""
                      }`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isDead ? "bg-destructive text-destructive-foreground" :
                          isComplete ? "bg-success text-success-foreground" :
                          isCurrent ? "bg-accent text-accent-foreground" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {isDead ? <XCircle className="w-3 h-3" /> :
                           isComplete ? <Check className="w-3 h-3" /> :
                           <Circle className="w-3 h-3" />}
                        </div>
                        <span className={`text-sm ${
                          isDead ? "font-bold text-destructive" :
                          isCurrent ? "font-bold text-card-foreground" :
                          isComplete ? "font-medium text-card-foreground" :
                          "text-muted-foreground"
                        }`}>
                          {stage.label}
                        </span>
                        {stage.key === "appraisal_completed" && (isComplete || isCurrent) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(getDocsUrl(selected.token), "_blank");
                            }}
                          >
                            <Upload className="w-3 h-3 mr-1" /> Upload Appraisal
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Update Status</label>
                  <Select
                    value={selected.progress_status}
                    disabled={!canUpdateStatus || (["manager_approval", "price_agreed", "purchase_complete"].includes(selected.progress_status) && !canApprove)}
                    onValueChange={(val) => {
                      if (["manager_approval", "price_agreed", "purchase_complete"].includes(val) && !canApprove) {
                        toast({ title: "Not authorized", description: "Only GSM/GM can approve purchases.", variant: "destructive" });
                        return;
                      }
                      setSelected({ ...selected, progress_status: val });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROGRESS_STAGES.map(s => {
                        const isApprovalStage = ["manager_approval", "price_agreed", "purchase_complete"].includes(s.key);
                        return (
                          <SelectItem key={s.key} value={s.key} disabled={isApprovalStage && !canApprove}>
                            {s.label}{isApprovalStage && !canApprove ? " (GSM/GM only)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* ACV Value - required when appraisal_completed */}
                {selected.progress_status === "appraisal_completed" && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">In-House ACV (Actual Cash Value) <span className="text-destructive">*</span></label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="Enter ACV amount"
                        className="pl-7"
                        value={selected.acv_value?.toString() || ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setSelected({ ...selected, acv_value: val });
                        }}
                      />
                    </div>
                    {!selected.acv_value && (
                      <p className="text-xs text-destructive mt-1">ACV value is required before updating.</p>
                    )}
                    {selected.appraised_by && selected.acv_value && (
                      <p className="text-xs text-muted-foreground mt-1">Appraised by: {selected.appraised_by}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Offered Price */}
              {canSetPrice ? (
                <div data-print-section className="bg-muted/40 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    <DollarSign className="w-4 h-4 inline mr-1" />Offered Price
                  </h3>
                  <Input
                    type="number"
                    placeholder="Enter offer amount"
                    defaultValue={selected.offered_price?.toString() || ""}
                    onChange={(e) => {
                      const price = e.target.value ? Number(e.target.value) : null;
                      setSelected({ ...selected, offered_price: price });
                    }}
                  />
                </div>
              ) : selected.offered_price ? (
                <div data-print-section className="bg-muted/40 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    <DollarSign className="w-4 h-4 inline mr-1" />Offered Price
                  </h3>
                  <p className="text-card-foreground font-medium">${selected.offered_price.toLocaleString()}</p>
                </div>
              ) : null}

              {/* Check Request */}
              {(() => {
                const priceAgreedIdx = PROGRESS_STAGES.findIndex(s => s.key === "price_agreed");
                const currentIdx = PROGRESS_STAGES.findIndex(s => s.key === selected.progress_status);
                const isPriceAgreedOrBeyond = selected.progress_status !== "dead_lead" && currentIdx >= priceAgreedIdx && selected.offered_price;
                return (
                  <div data-print-section className="bg-muted/40 rounded-lg p-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                      <ClipboardCheck className="w-4 h-4 inline mr-1" />Check Request
                    </h3>
                    <div className="flex items-center gap-3 mb-3">
                      <Checkbox
                        id="check-request-done"
                        checked={selected.check_request_done}
                        disabled={!isPriceAgreedOrBeyond}
                        onCheckedChange={(checked) => {
                          setSelected({ ...selected, check_request_done: !!checked });
                        }}
                      />
                      <label htmlFor="check-request-done" className={`text-sm font-medium ${isPriceAgreedOrBeyond ? "text-card-foreground" : "text-muted-foreground"}`}>
                        Check Request Done
                      </label>
                    </div>
                    {isPriceAgreedOrBeyond && (
                      <Button variant="outline" size="sm" onClick={handleGenerateCheckRequest}>
                        <Printer className="w-4 h-4 mr-1" /> Generate Check Request
                      </Button>
                    )}
                    {!isPriceAgreedOrBeyond && (
                      <p className="text-xs text-muted-foreground">Available once price is agreed and entered.</p>
                    )}
                  </div>
                );
              })()}

              {/* Internal Notes */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  <StickyNote className="w-4 h-4 inline mr-1" />Internal Notes
                </h3>
                <Textarea
                  placeholder="Add team notes here..."
                  defaultValue={selected.internal_notes || ""}
                  onChange={(e) => {
                    setSelected({ ...selected, internal_notes: e.target.value || null });
                  }}
                  rows={3}
                />
              </div>

              {/* Photos */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Photos {photos.length > 0 && `(${photos.length})`}
                </h3>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative group">
                        <a href={photo.url} target="_blank" rel="noopener noreferrer">
                          <img src={photo.url} alt={`Photo ${i + 1}`} className="rounded-lg w-full h-28 object-cover hover:opacity-80 transition-opacity" />
                        </a>
                        {canDelete && (
                          <button
                            onClick={() => handleDeletePhoto(photo.name)}
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No photos uploaded.</p>
                )}
                <StaffFileUpload token={selected.token} bucket="submission-photos" onUploadComplete={() => handleView(selected)} />
              </div>

              {/* Uploaded Documents */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  <FileText className="w-4 h-4 inline mr-1" />Documents {docs.length > 0 && `(${docs.length})`}
                </h3>
                {docs.length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(
                      docs.reduce<Record<string, typeof docs>>((acc, doc) => {
                        if (!acc[doc.type]) acc[doc.type] = [];
                        acc[doc.type].push(doc);
                        return acc;
                      }, {})
                    ).map(([type, typeDocs]) => (
                      <div key={type}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">
                          {DOC_TYPE_LABELS[type] || type}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {typeDocs.map((doc, i) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);
                            return (
                              <div key={i} className="relative group">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block">
                                  {isImage ? (
                                    <img src={doc.url} alt={doc.name} className="rounded-lg w-full h-28 object-cover hover:opacity-80 transition-opacity" />
                                  ) : (
                                    <div className="rounded-lg w-full h-28 bg-muted flex flex-col items-center justify-center hover:bg-muted/80 transition-colors border border-border">
                                      <FileText className="w-8 h-8 text-muted-foreground mb-1" />
                                      <span className="text-[10px] text-muted-foreground text-center px-1 truncate w-full">{doc.name}</span>
                                    </div>
                                  )}
                                </a>
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteDoc(doc.type, doc.name)}
                                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete document"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                )}
                <StaffFileUpload token={selected.token} bucket="customer-documents" onUploadComplete={() => handleView(selected)} />
              </div>

              {/* Schedule Appointment from Submission */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  <CalendarDays className="w-4 h-4 inline mr-1" />Appointment
                </h3>
                {selected.appointment_set && selected.appointment_date ? (
                  <div className="space-y-2">
                    <p className="text-sm text-card-foreground font-medium">
                      {new Date(selected.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      {selectedApptTime && <span className="ml-1">at {selectedApptTime}</span>}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setApptForm({
                          customer_name: selected.name || "",
                          customer_email: selected.email || "",
                          customer_phone: selected.phone || "",
                          preferred_date: "",
                          preferred_time: "",
                          vehicle_info: [selected.vehicle_year, selected.vehicle_make, selected.vehicle_model].filter(Boolean).join(" "),
                          notes: "",
                          submission_token: selected.token,
                        });
                        setShowCreateAppt(true);
                      }}
                    >
                      <CalendarDays className="w-4 h-4 mr-1" /> Reschedule Appointment
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setApptForm({
                        customer_name: selected.name || "",
                        customer_email: selected.email || "",
                        customer_phone: selected.phone || "",
                        preferred_date: "",
                        preferred_time: "",
                        vehicle_info: [selected.vehicle_year, selected.vehicle_make, selected.vehicle_model].filter(Boolean).join(" "),
                        notes: "",
                        submission_token: selected.token,
                      });
                      setShowCreateAppt(true);
                    }}
                  >
                    <CalendarDays className="w-4 h-4 mr-1" /> Schedule Appointment
                  </Button>
                )}
              </div>

              {/* Document Upload Link & QR */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4 print:break-before-page">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  <FileText className="w-4 h-4 inline mr-1" />Customer Documents
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Send this link to the customer to upload their Driver's License, Registration, Title Inquiry, or Title.
                </p>
                <div className="flex items-start gap-4">
                  <div className="bg-white p-2 rounded-lg flex-shrink-0">
                    <QRCodeSVG value={getDocsUrl(selected.token)} size={100} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="bg-background rounded-md p-2 border border-border">
                      <p className="text-xs text-muted-foreground break-all font-mono">{getDocsUrl(selected.token)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(getDocsUrl(selected.token));
                          toast({ title: "Link copied!" });
                        }}
                      >
                        Copy Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(getDocsUrl(selected.token), "_blank")}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Open
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Log */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  <History className="w-4 h-4 inline mr-1" />Activity Log
                </h3>
                {activityLog.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activityLog.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs border-b border-border pb-2 last:border-0">
                        <Clock className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium text-card-foreground">{log.action}</span>
                          {log.old_value && log.new_value && (
                            <span className="text-muted-foreground"> — {log.old_value} → {log.new_value}</span>
                          )}
                          <div className="text-muted-foreground mt-0.5">
                            {log.performed_by && <span className="capitalize">{log.performed_by.replace(/_/g, " ")}</span>}
                            {" · "}
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                )}
              </div>

              {/* Update Record Button */}
              <div className="sticky bottom-0 bg-background pt-3 pb-1 border-t border-border flex gap-2">
                <Button
                  className="flex-1"
                  disabled={selected.progress_status === "appraisal_completed" && !selected.acv_value}
                  onClick={async () => {
                    const { error } = await supabase
                      .from("submissions")
                      .update({
                        progress_status: selected.progress_status,
                        offered_price: selected.offered_price,
                        acv_value: selected.acv_value,
                        check_request_done: selected.check_request_done,
                        internal_notes: selected.internal_notes,
                        name: selected.name,
                        phone: selected.phone,
                        email: selected.email,
                        zip: selected.zip,
                        address_street: (selected as any).address_street,
                        address_city: (selected as any).address_city,
                        address_state: (selected as any).address_state,
                        status_updated_at: new Date().toISOString(),
                      })
                      .eq("id", selected.id);
                    if (!error) {
                      // Log changes
                      const oldSub = submissions.find(s => s.id === selected.id);
                      if (oldSub && oldSub.progress_status !== selected.progress_status) {
                        await supabase.from("activity_log").insert({
                          submission_id: selected.id,
                          action: "Status Changed",
                          old_value: PROGRESS_STAGES.find(s => s.key === oldSub.progress_status)?.label || oldSub.progress_status,
                          new_value: PROGRESS_STAGES.find(s => s.key === selected.progress_status)?.label || selected.progress_status,
                          performed_by: userRole,
                        });
                      }
                      if (oldSub && oldSub.offered_price !== selected.offered_price) {
                        await supabase.from("activity_log").insert({
                          submission_id: selected.id,
                          action: "Price Updated",
                          old_value: oldSub.offered_price ? `$${oldSub.offered_price.toLocaleString()}` : "None",
                          new_value: selected.offered_price ? `$${selected.offered_price.toLocaleString()}` : "None",
                          performed_by: userRole,
                        });
                      }
                      // Re-fetch submission to get server-set fields like appraised_by
                      const { data: refreshed } = await supabase.from("submissions").select("*").eq("id", selected.id).maybeSingle();
                      if (refreshed) {
                        setSelected(refreshed as any);
                        setSubmissions(prev => prev.map(s => s.id === selected.id ? refreshed as any : s));
                      } else {
                        setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, progress_status: selected.progress_status, offered_price: selected.offered_price, acv_value: selected.acv_value, internal_notes: selected.internal_notes } : s));
                      }
                      fetchActivityLog(selected.id);
                      toast({ title: "Record updated", description: "All changes have been saved." });
                    } else {
                      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
                    }
                  }}
                >
                  <Save className="w-4 h-4 mr-2" /> Update Record
                </Button>
                {canDelete && (
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(selected.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Appointment Dialog */}
      <Dialog open={showCreateAppt} onOpenChange={setShowCreateAppt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule an Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={apptForm.customer_name} onChange={(e) => setApptForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Customer name" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input value={apptForm.customer_phone} onChange={(e) => setApptForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder="(555) 123-4567" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={apptForm.customer_email} onChange={(e) => setApptForm(p => ({ ...p, customer_email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" min={new Date().toISOString().split("T")[0]} value={apptForm.preferred_date} onChange={(e) => setApptForm(p => ({ ...p, preferred_date: e.target.value, preferred_time: "" }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Time *</Label>
                {apptForm.preferred_date && new Date(apptForm.preferred_date + "T12:00:00").getDay() === 0 ? (
                  <p className="text-sm text-destructive font-medium py-2">Closed Sundays</p>
                ) : (
                  <Select value={apptForm.preferred_time} onValueChange={(v) => setApptForm(p => ({ ...p, preferred_time: v }))} disabled={!apptForm.preferred_date}>
                    <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                    <SelectContent>
                      {getApptTimeSlots().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Link to Submission (optional)</Label>
              <Select value={apptForm.submission_token} onValueChange={(v) => setApptForm(p => ({ ...p, submission_token: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a submission" /></SelectTrigger>
                <SelectContent>
                  {submissions.map(s => (
                    <SelectItem key={s.token} value={s.token}>
                      {s.name || "Unknown"} — {[s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "No vehicle"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Linking will update the customer's status to "Inspection Scheduled".</p>
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle Info</Label>
              <Input value={apptForm.vehicle_info} onChange={(e) => setApptForm(p => ({ ...p, vehicle_info: e.target.value }))} placeholder="e.g. 2020 Toyota Camry" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={apptForm.notes} onChange={(e) => setApptForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." rows={2} />
            </div>
            <Button className="w-full" onClick={handleCreateAppointment} disabled={creatingAppt}>
              {creatingAppt ? "Creating..." : "Create Appointment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
