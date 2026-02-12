import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search, Trash2, Eye, ChevronLeft, ChevronRight, UserCheck, UserX, Users, Check, Circle, DollarSign, StickyNote, XCircle, Save, Printer, FileText, QrCode, ExternalLink, ClipboardCheck, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { QRCodeSVG } from "qrcode.react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import harteLogo from "@/assets/harte-logo.png";

interface PendingRequest {
  id: string;
  user_id: string;
  email: string;
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
  check_request_done: boolean;
  internal_notes: string | null;
  status_updated_by: string | null;
  status_updated_at: string | null;
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
  const [selected, setSelected] = useState<Submission | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [docs, setDocs] = useState<{ name: string; url: string; type: string }[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [userRole, setUserRole] = useState<string>("");
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

  const DOC_TYPE_LABELS: Record<string, string> = {
    drivers_license: "Driver's License",
    registration: "Registration",
    title_inquiry: "Title Inquiry",
    title: "Title",
    payoff_verification: "Payoff Verification",
    appraisal: "Appraisal",
  };

  const handleView = async (sub: Submission) => {
    setSelected(sub);
    setDocs([]);
    // Fetch photos
    const { data } = await supabase.storage
      .from("submission-photos")
      .list(sub.token);

    if (data && data.length > 0) {
      const urls = data.map((file) => {
        const { data: urlData } = supabase.storage
          .from("submission-photos")
          .getPublicUrl(`${sub.token}/${file.name}`);
        return urlData.publicUrl;
      });
      setPhotos(urls);
    } else {
      setPhotos([]);
    }

    // Fetch documents from customer-documents bucket
    const docTypes = ["drivers_license", "registration", "title_inquiry", "title", "payoff_verification", "appraisal"];
    const allDocs: { name: string; url: string; type: string }[] = [];
    for (const docType of docTypes) {
      const { data: docFiles } = await supabase.storage
        .from("customer-documents")
        .list(sub.token + "/" + docType);
      if (docFiles && docFiles.length > 0) {
        docFiles.forEach(file => {
          const { data: urlData } = supabase.storage
            .from("customer-documents")
            .getPublicUrl(sub.token + "/" + docType + "/" + file.name);
          allDocs.push({ name: file.name, url: urlData.publicUrl, type: docType });
        });
      }
    }
    setDocs(allDocs);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
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
        photos.map(u => '<img src="' + u + '" />').join("") + "</div></div>"
      : "";

    const notesHtml = s.internal_notes
      ? '<div class="section"><div class="section-title">Internal Notes</div><div class="notes">' + s.internal_notes + "</div></div>"
      : "";

    const priceSection = s.offered_price
      ? makeSection("Offered Price", [["Amount", "$" + s.offered_price.toLocaleString()]])
      : "";

    const docsUrl = getDocsUrl(s.token);

    const html = "<!DOCTYPE html><html><head><title>Submission Details</title><style>" + css + "</style></head><body>" +
      '<div class="header"><h1>' + (vehicleStr || "Submission Details") + "</h1>" +
      "<p>Submitted " + new Date(s.created_at).toLocaleDateString() + " &bull; " + (s.name || "Unknown") + "</p></div>" +
      '<div class="content">' +
      makeSection("Contact Information", [["Name", s.name], ["Phone", s.phone], ["Email", s.email], ["ZIP", s.zip]]) +
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
      '<div class="section"><div class="section-title">Deal Progress</div>' + progressHtml + "</div>" +
      priceSection +
      notesHtml +
      photosHtml +
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

  const handleGenerateCheckRequest = () => {
    if (!selected || !selected.offered_price) return;
    const s = selected;
    const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "N/A";
    const today = new Date().toLocaleDateString();

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
      ".sig-section { margin-top: 40px; display: flex; justify-content: space-between; }",
      ".sig-line { width: 45%; border-top: 1px solid #1a2a3a; padding-top: 6px; font-size: 12px; color: #6b7b8d; }",
      "@page { margin: 0.75in; size: letter; }",
    ].join("\n");

    const html = `<!DOCTYPE html><html><head><title>Check Request</title><style>${css}</style></head><body>
      <div class="header"><h1>Harte Auto Group</h1><p>Check Request Form</p></div>
      <div class="content">
        <p class="title">Check Request</p>
        <table>
          <tr><th>Date</th><td>${today}</td></tr>
          <tr><th>Customer Name (As It Appears on Title)</th><td>${s.name || ""}</td></tr>
          <tr><th>Address</th><td style="border-bottom:1px solid #ccc;min-width:200px;">&nbsp;</td></tr>
          <tr><th>City, State, Zip</th><td>${[s.state, s.zip].filter(Boolean).join(" ") || ""}</td></tr>
          <tr><th>Contact Phone</th><td>${s.phone || ""}</td></tr>
          <tr><th>Contact Email</th><td>${s.email || ""}</td></tr>
          <tr><th>Agreed Upon Value (Check Amount)</th><td class="amount">$${s.offered_price!.toLocaleString()}</td></tr>
          <tr><th>In-House ACV Value</th><td style="border-bottom:1px solid #ccc;">&nbsp;</td></tr>
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
    </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 300);
  };

  const filtered = submissions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.vin?.toLowerCase().includes(q) ||
      s.plate?.toLowerCase().includes(q) ||
      `${s.vehicle_year} ${s.vehicle_make} ${s.vehicle_model}`.toLowerCase().includes(q)
    );
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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
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
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="submissions">
          <TabsList className="mb-4">
            <TabsTrigger value="submissions">Submissions ({total})</TabsTrigger>
            {canManageAccess && (
              <TabsTrigger value="requests" className="relative">
                <Users className="w-4 h-4 mr-1" />
                Access Requests
                {pendingRequests.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="submissions">
            <div className="flex items-center justify-end mb-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading submissions...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No submissions found.</div>
            ) : (
              <>
                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vehicle</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Contact</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Photos</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((sub) => (
                          <tr key={sub.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              {new Date(sub.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 font-medium text-card-foreground">
                              {sub.name || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {sub.vehicle_year && sub.vehicle_make
                                ? `${sub.vehicle_year} ${sub.vehicle_make} ${sub.vehicle_model || ""}`
                                : sub.vin || sub.plate || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div>{sub.email || "—"}</div>
                              <div className="text-muted-foreground text-xs">{sub.phone || ""}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sub.photos_uploaded ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                                {sub.photos_uploaded ? "Yes" : "No"}
                              </span>
                            </td>
                          <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                sub.progress_status === "purchase_complete" ? "bg-success/20 text-success" :
                                sub.progress_status === "dead_lead" ? "bg-destructive/20 text-destructive" :
                                sub.progress_status === "new" ? "bg-muted text-muted-foreground" :
                                "bg-accent/20 text-accent"
                              }`}>
                                {PROGRESS_STAGES.find(s => s.key === sub.progress_status)?.label || sub.progress_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
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
              {/* Contact Card */}
              <div data-print-section className="bg-muted/40 rounded-lg p-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Name" value={selected.name} />
                  <DetailRow label="Phone" value={selected.phone} />
                  <DetailRow label="Email" value={selected.email} />
                  <DetailRow label="ZIP" value={selected.zip} />
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
                    {photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${i + 1}`} className="rounded-lg w-full h-28 object-cover hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No photos uploaded.</p>
                )}
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
                              <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="block">
                                {isImage ? (
                                  <img src={doc.url} alt={doc.name} className="rounded-lg w-full h-28 object-cover hover:opacity-80 transition-opacity" />
                                ) : (
                                  <div className="rounded-lg w-full h-28 bg-muted flex flex-col items-center justify-center hover:bg-muted/80 transition-colors border border-border">
                                    <FileText className="w-8 h-8 text-muted-foreground mb-1" />
                                    <span className="text-[10px] text-muted-foreground text-center px-1 truncate w-full">{doc.name}</span>
                                  </div>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
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
                        status_updated_at: new Date().toISOString(),
                      })
                      .eq("id", selected.id);
                    if (!error) {
                      setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, progress_status: selected.progress_status, offered_price: selected.offered_price, acv_value: selected.acv_value, internal_notes: selected.internal_notes } : s));
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
    </div>
  );
};

export default AdminDashboard;
