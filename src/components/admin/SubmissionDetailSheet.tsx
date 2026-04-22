/**
 * SubmissionDetailSheet.tsx — Two-column layout
 * LEFT  (~40%, sticky): Deal summary — money, status, actions
 * RIGHT (~60%, scroll): Contact, condition, loan, photos, notes, activity
 * ALL LOGIC IS IDENTICAL TO ORIGINAL — only JSX restructured.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QRCodeSVG } from "qrcode.react";
import VehicleImage from "@/components/sell-form/VehicleImage";
import StaffFileUpload from "@/components/admin/StaffFileUpload";
import FollowUpPanel from "@/components/admin/FollowUpPanel";
import RetailMarketPanel from "@/components/admin/RetailMarketPanel";
import HistoricalInsightPanel from "@/components/appraisal/HistoricalInsightPanel";
import { useTenant } from "@/contexts/TenantContext";
import {
  X, Printer, Users, Car, Search, DollarSign, Info, FileText, Gauge, Palette, BarChart3, ScanLine,
  Settings2, Wrench, Key, Wind, Cigarette, CircleDot, Sparkles, TrendingUp,
  AlertTriangle, Bell, Mail, Phone, StickyNote, CalendarDays, Camera,
  ExternalLink, Upload, Check, XCircle, MapPin, Star, History, Clock,
  ClipboardCheck, ClipboardList, Save, Trash2, CheckCircle2, Activity, ChevronDown,
  ChevronLeft, ChevronRight, Send,
} from "lucide-react";
import { calculateLeadScore, getScoreColor } from "@/lib/leadScoring";
import { calculateEquity } from "@/lib/equityCalculator";
import type { Submission, DealerLocation } from "@/lib/adminConstants";
import {
  getProgressStages, getStageIndex, getStatusLabel,
  ALL_STATUS_OPTIONS, DOC_TYPE_LABELS,
} from "@/lib/adminConstants";
import { printSubmissionDetail, printAllDocs, printCheckRequest } from "@/lib/printUtils";
import { useToast } from "@/hooks/use-toast";
import logoFallback from "@/assets/logo-placeholder.png";

interface SubmissionDetailSheetProps {
  selected: Submission | null;
  onClose: () => void;
  photos: { url: string; name: string }[];
  docs: { name: string; url: string; type: string }[];
  activityLog: { id: string; action: string; old_value: string | null; new_value: string | null; performed_by: string | null; created_at: string }[];
  duplicateWarnings: Record<string, string[]>;
  optOutStatus: { email: boolean; sms: boolean };
  selectedApptTime: string | null;
  selectedApptLocation: string | null;
  dealerLocations: DealerLocation[];
  canSetPrice: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canUpdateStatus: boolean;
  auditLabel: string;
  userName: string;
  onUpdate: (updated: Submission) => void;
  onDelete: (id: string) => void;
  onRefresh: (sub: Submission) => void;
  onScheduleAppointment: (sub: Submission) => void;
  onDeletePhoto: (fileName: string) => void;
  onDeleteDoc: (docType: string, fileName: string) => void;
  fetchActivityLog: (id: string) => void;
  fetchSubmissions: () => void;
}

// ── Section Card wrapper ──
const SectionCard = ({
  icon: Icon,
  title,
  children,
  headerRight,
  className = "",
  accent,
}: {
  icon?: React.ElementType;
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
  accent?: "success" | "warning" | "destructive";
}) => {
  const accentBorder = accent === "success" ? "border-l-emerald-500" : accent === "warning" ? "border-l-amber-500" : accent === "destructive" ? "border-l-red-500" : "border-l-[#003b80]/30";
  return (
    <div data-print-section className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden border-l-[3px] ${accentBorder} ${className}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#003b80]/50" />}
          {title}
        </h3>
        {headerRight}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
};

// ── Customer initials avatar ──
const CustomerAvatar = ({ name }: { name: string | null }) => {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="relative">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-foreground/20 to-primary-foreground/5 border border-primary-foreground/20 flex items-center justify-center shadow-lg backdrop-blur-sm">
        <span className="text-lg font-bold text-primary-foreground tracking-wide">{initials}</span>
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-success border-2 border-primary shadow-sm" />
    </div>
  );
};

const DetailRow = ({ label, value, icon }: { label: string; value: React.ReactNode | string | null | undefined; icon?: React.ReactNode }) => {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 flex items-center gap-2 shrink-0">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900 text-right max-w-[65%] min-w-0 break-words [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
};

const ArrayDetail = ({ label, value, icon }: { label: string; value: string[] | null | undefined; icon?: React.ReactNode }) => {
  if (!value || value.length === 0 || (value.length === 1 && value[0] === "none")) return null;
  return <DetailRow label={label} value={value.join(", ")} icon={icon} />;
};

// ── Compact OBD indicator — fetches latest scan for a submission ──
// ── InspectionVitals ─────────────────────────────────────────────────
// Compact traffic-light view of tires + brakes as recorded by the
// inspector. Never auto-generates text notes — the inspector's typed
// notes (if any) live in a separate textarea below. Shows nothing if no
// inspection values exist.
//
// Thresholds: >=6 green (good), 3-5 yellow (fair), <=2 red (replace).
// Works for both tire (32nds) and brake (mm) values since they share the
// same 0-10 range in practice and the bands line up with fleet standards.
const InspectionVitals = ({ submissionId }: { submissionId: string }) => {
  const [data, setData] = useState<{
    tire_lf: number | null; tire_rf: number | null; tire_lr: number | null; tire_rr: number | null;
    brake_lf: number | null; brake_rf: number | null; brake_lr: number | null; brake_rr: number | null;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("submissions")
        .select("tire_lf, tire_rf, tire_lr, tire_rr, brake_lf, brake_rf, brake_lr, brake_rr")
        .eq("id", submissionId)
        .maybeSingle();
      if (!cancelled) {
        setData((row as any) ?? null);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

  if (!loaded || !data) return null;

  const values = [data.tire_lf, data.tire_rf, data.tire_lr, data.tire_rr, data.brake_lf, data.brake_rf, data.brake_lr, data.brake_rr];
  const anyValue = values.some((v) => typeof v === "number");
  if (!anyValue) return null;

  type State = "green" | "yellow" | "red" | "empty";
  const stateOf = (v: number | null | undefined): State => {
    if (v == null || isNaN(v)) return "empty";
    if (v >= 6) return "green";
    if (v >= 3) return "yellow";
    return "red";
  };

  const stateClass: Record<State, string> = {
    green:  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    yellow: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    red:    "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    empty:  "bg-muted text-muted-foreground/40 border-border",
  };

  const Pos = ({ label, value, kind }: { label: string; value: number | null | undefined; kind: "tire" | "brake" }) => {
    const s = stateOf(value);
    return (
      <div className={`rounded-xl border p-2.5 flex items-center gap-2 ${stateClass[s]}`}>
        {kind === "tire" ? (
          // Tire glyph — rounded rect w/ tread grooves
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5" y="3" width="14" height="18" rx="3" />
            <line x1="9" y1="5" x2="9" y2="19" />
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="15" y1="5" x2="15" y2="19" />
          </svg>
        ) : (
          // Brake glyph — caliper circle with pad wedge
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
            <path d="M12 3 A9 9 0 0 1 21 12" strokeWidth="2.5" />
          </svg>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold uppercase tracking-wider opacity-75 leading-none">{label}</div>
          <div className="text-[11px] font-semibold leading-tight mt-0.5">
            {s === "empty" ? "Not recorded" : s === "green" ? "Good" : s === "yellow" ? "Fair" : "Replace"}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 mb-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Tires */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Tires</div>
          <div className="grid grid-cols-2 gap-2">
            <Pos label="LF" value={data.tire_lf} kind="tire" />
            <Pos label="RF" value={data.tire_rf} kind="tire" />
            <Pos label="LR" value={data.tire_lr} kind="tire" />
            <Pos label="RR" value={data.tire_rr} kind="tire" />
          </div>
        </div>
        {/* Brakes */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Brake Pads</div>
          <div className="grid grid-cols-2 gap-2">
            <Pos label="LF" value={data.brake_lf} kind="brake" />
            <Pos label="RF" value={data.brake_rf} kind="brake" />
            <Pos label="LR" value={data.brake_lr} kind="brake" />
            <Pos label="RR" value={data.brake_rr} kind="brake" />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        From the inspection — Green good, Amber fair, Red replace.
      </p>
    </div>
  );
};

// ── QuickSummary ─────────────────────────────────────────────────────
// Pinned strip at the top of the customer file. BDCs / sales / managers
// read this first — name, phone, email with click-to-call / click-to-SMS,
// current pipeline stage, lead source, and last activity. Everything
// below the strip is "click to get deeper."
const QuickSummary = ({
  sub,
  statusLabel,
}: {
  sub: any;
  statusLabel: string;
}) => {
  const phoneDigits = (sub.phone || "").replace(/\D/g, "");
  const phoneHref = phoneDigits ? `tel:+1${phoneDigits}` : null;
  const smsHref = phoneDigits ? `sms:+1${phoneDigits}` : null;
  const emailHref = sub.email ? `mailto:${sub.email}` : null;
  const leadSource = sub.lead_source || "Not set";
  const lastActivity = sub.updated_at || sub.created_at;
  const lastActivityAgo = lastActivity
    ? (() => {
        const ms = Date.now() - new Date(lastActivity).getTime();
        const mins = Math.floor(ms / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      })()
    : "—";

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-[0_2px_10px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-muted/40 to-transparent flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary bg-primary/10 px-2 py-0.5 rounded">
            {statusLabel}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">·</span>
          <span className="text-[10px] font-semibold text-muted-foreground">{leadSource}</span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Last activity · {lastActivityAgo}</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="text-base font-bold text-card-foreground leading-tight">
          {sub.name || <span className="text-muted-foreground italic">Unknown customer</span>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {phoneHref && (
            <a
              href={phoneHref}
              className="inline-flex items-center gap-1.5 bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-md text-card-foreground font-mono"
            >
              <span aria-hidden>📞</span>
              {sub.phone}
            </a>
          )}
          {smsHref && (
            <a
              href={smsHref}
              className="inline-flex items-center gap-1.5 bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-md text-card-foreground"
            >
              <span aria-hidden>💬</span>
              SMS
            </a>
          )}
          {emailHref && (
            <a
              href={emailHref}
              className="inline-flex items-center gap-1.5 bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-md text-card-foreground max-w-full truncate"
              title={sub.email}
            >
              <span aria-hidden>✉️</span>
              <span className="truncate">{sub.email}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

// ── DLAtAGlance ──────────────────────────────────────────────────────
// Shows the front of the driver's license as a small thumbnail next to
// the customer name when one is uploaded. Click = zoom. Self-hides if
// nothing's uploaded. Paired with a masked number so BDCs can verify ID
// without hunting through the Documents card.
const DLAtAGlance = ({
  docs,
}: {
  docs: { type: string; name: string; url: string }[];
}) => {
  const [zoom, setZoom] = useState(false);
  const frontDoc = docs.find(
    (d) =>
      (d.type === "drivers_license_front" || d.type === "drivers_license") &&
      /\.(jpg|jpeg|png|gif|webp)$/i.test(d.name),
  );
  if (!frontDoc) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all px-2 py-1.5"
        title="View driver's license"
      >
        <img
          src={frontDoc.url}
          alt="Driver's license — front"
          className="w-12 h-8 object-cover rounded"
        />
        <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
          DL on file
        </span>
      </button>
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur flex items-center justify-center p-6"
        >
          <img
            src={frontDoc.url}
            alt="Driver's license — front"
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl cursor-zoom-out"
          />
        </div>
      )}
    </>
  );
};

const CompactOBDIndicator = ({ submissionId, token }: { submissionId: string; token: string }) => {
  const routerNavigate = useNavigate();
  const [scan, setScan] = useState<{ mil_on: boolean | null; dtc_codes: any; created_at: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("vehicle_scans")
          .select("mil_on, dtc_codes, created_at")
          .eq("submission_id", submissionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) setScan(data ?? null);
      } catch {
        if (!cancelled) setScan(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

  if (loading || !scan) return null;

  const dtcCount = Array.isArray(scan.dtc_codes) ? scan.dtc_codes.length : 0;
  const milOn = scan.mil_on === true;
  const scanDate = (() => {
    try { return new Date(scan.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
    catch { return ""; }
  })();

  return (
    <div
      className={`rounded-2xl border overflow-hidden shadow-sm transition-shadow hover:shadow-md ${
        milOn
          ? "border-red-500/40 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent"
          : "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
      }`}
    >
      <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-5 py-3 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-foreground/80 uppercase tracking-[0.12em] flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10">
            <Activity className="w-3.5 h-3.5 text-primary" />
          </span>
          OBD-II Scan
        </h3>
        <span className="text-[10px] font-semibold text-muted-foreground">{scanDate}</span>
      </div>
      <div className="p-4 flex items-center gap-3">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
            milOn
              ? "bg-red-500/20 border border-red-500/30"
              : "bg-emerald-500/20 border border-emerald-500/30"
          }`}
        >
          {milOn ? (
            <AlertTriangle className="w-5 h-5 text-red-500" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black uppercase tracking-wide ${milOn ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {milOn ? "Check Engine On" : "No Active Faults"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {dtcCount} DTC{dtcCount === 1 ? "" : "s"} reported
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg h-8 text-[11px] font-semibold shrink-0"
          onClick={() => { routerNavigate(`/inspection/${token}`); }}
        >
          Details
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
};

const RefreshedSheet = ({
  selected,
  onClose,
  photos,
  docs,
  activityLog,
  duplicateWarnings,
  optOutStatus,
  selectedApptTime,
  selectedApptLocation,
  dealerLocations,
  canSetPrice,
  canApprove,
  canDelete,
  canUpdateStatus,
  auditLabel,
  userName,
  onUpdate,
  onDelete,
  onRefresh,
  onScheduleAppointment,
  onDeletePhoto,
  onDeleteDoc,
  fetchActivityLog,
  fetchSubmissions,
}: SubmissionDetailSheetProps) => {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const routerNavigate = useNavigate();
  const [editState, setEditState] = useState<Submission | null>(null);
  const [callHistory, setCallHistory] = useState<any[]>([]);

  // Fetch voice call history when a submission is selected
  useEffect(() => {
    if (!selected?.id) { setCallHistory([]); return; }
    let cancelled = false;
    (async () => {
      const { data: calls } = await (supabase as any)
        .from("voice_call_log")
        .select("id, status, outcome, duration_seconds, transcript, summary, recording_url, customer_name, created_at, attempt_number")
        .eq("submission_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled && calls) setCallHistory(calls);
    })();
    return () => { cancelled = true; };
  }, [selected?.id]);

  const sub = editState?.id === selected?.id ? editState : selected;

  const updateField = (updates: Partial<Submission>) => {
    if (!sub) return;
    setEditState({ ...sub, ...updates });
  };

  const outcomeColor = (outcome: string | null) => {
    switch (outcome) {
      case 'accepted': return 'bg-success/15 text-success border-success/30';
      case 'appointment_scheduled': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
      case 'wants_higher_offer': return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      case 'callback_requested': return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'not_interested': return 'bg-muted text-muted-foreground border-border';
      case 'voicemail_left': return 'bg-purple-500/15 text-purple-600 border-purple-500/30';
      case 'opted_out': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getDocsUrl = (token: string) => `${window.location.origin}/docs/${token}`;

  const getLocationLabel = (loc: string | null) => {
    if (!loc) return null;
    const found = dealerLocations.find(l => l.id === loc || l.name.toLowerCase().replace(/\s+/g, "_") === loc);
    if (found) return `${found.name} — ${found.city}, ${found.state}`;
    return loc;
  };

  const handlePrint = () => {
    if (!sub) return;
    const stages = getProgressStages(sub);
    printSubmissionDetail(sub, photos, docs, stages, getStageIndex, getDocsUrl(sub.token), DOC_TYPE_LABELS);
  };

  const handlePrintAllDocs = async () => {
    if (!sub) return;
    const vehicleStr = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "N/A";
    const fetchDocImages = async (folder: string): Promise<string[]> => {
      const urls: string[] = [];
      const { data: files } = await supabase.storage.from("customer-documents").list(`${sub.token}/${folder}`);
      if (files && files.length > 0) {
        for (const f of files) {
          const { data } = await supabase.storage.from("customer-documents").createSignedUrl(`${sub.token}/${folder}/${f.name}`, 3600);
          if (data?.signedUrl) urls.push(data.signedUrl);
        }
      }
      return urls;
    };
    const [dl, dlF, dlB, reg, title, appr, carfax, payoff, ws] = await Promise.all([
      fetchDocImages("drivers_license"), fetchDocImages("drivers_license_front"), fetchDocImages("drivers_license_back"),
      fetchDocImages("registration"), fetchDocImages("title"), fetchDocImages("appraisal"),
      fetchDocImages("carfax"), fetchDocImages("payoff_verification"), fetchDocImages("window_sticker"),
    ]);
    const result = printAllDocs(sub.name, vehicleStr, [
      { title: "Driver's License", images: [...dl, ...dlF, ...dlB] },
      { title: "Registration", images: reg },
      { title: "Title", images: title },
      { title: "Appraisal", images: appr },
      { title: "Carfax", images: carfax },
      { title: "Payoff Documentation", images: payoff },
      { title: "Window Sticker", images: ws },
    ]);
    if (!result) toast({ title: "No Documents", description: "No documents have been uploaded.", variant: "destructive" });
  };

  const handleGenerateCheckRequest = async () => {
    if (!sub || !sub.offered_price) return;
    const hasAddress = sub.address_street && (sub.address_city || sub.address_state || sub.zip);
    if (!hasAddress) {
      toast({ title: "Missing Address", description: "Customer street address must be entered.", variant: "destructive" });
      return;
    }
    const { data: appraisalCheck } = await supabase.storage.from("customer-documents").list(`${sub.token}/appraisal`);
    if (!appraisalCheck || appraisalCheck.length === 0) {
      toast({ title: "Missing Appraisal", description: "An ACV appraisal document must be uploaded.", variant: "destructive" });
      return;
    }
    const [dlLegacy, dlFront] = await Promise.all([
      supabase.storage.from("customer-documents").list(`${sub.token}/drivers_license`),
      supabase.storage.from("customer-documents").list(`${sub.token}/drivers_license_front`),
    ]);
    const hasDL = (dlLegacy.data && dlLegacy.data.length > 0) || (dlFront.data && dlFront.data.length > 0);
    if (!hasDL) {
      toast({ title: "Missing Driver's License", description: "Customer driver's license must be uploaded.", variant: "destructive" });
      return;
    }
    let logoBase64 = "";
    try {
      const resp = await fetch(logoFallback);
      const blob = await resp.blob();
      logoBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(blob); });
    } catch { logoBase64 = ""; }
    const fetchDocImages = async (folder: string): Promise<string[]> => {
      const urls: string[] = [];
      const { data: files } = await supabase.storage.from("customer-documents").list(`${sub.token}/${folder}`);
      if (files && files.length > 0) {
        for (const f of files) { const { data } = await supabase.storage.from("customer-documents").createSignedUrl(`${sub.token}/${folder}/${f.name}`, 3600); if (data?.signedUrl) urls.push(data.signedUrl); }
      }
      return urls;
    };
    const [apprImg, dlImg, dlFImg, dlBImg, titleImg, payoffImg] = await Promise.all([
      fetchDocImages("appraisal"), fetchDocImages("drivers_license"), fetchDocImages("drivers_license_front"),
      fetchDocImages("drivers_license_back"), fetchDocImages("title"), fetchDocImages("payoff_verification"),
    ]);
    const inspectionTextSections: { title: string; text: string }[] = [];
    if (sub.internal_notes && sub.internal_notes.includes("[INSPECTION")) {
      inspectionTextSections.push({ title: "Inspection Report", text: sub.internal_notes });
    }
    const html = printCheckRequest(sub, logoBase64, [
      { title: "Appraisal Document", images: apprImg },
      { title: "Driver's License", images: [...dlImg, ...dlFImg, ...dlBImg] },
      { title: "Title", images: titleImg },
      { title: "Payoff Documentation", images: payoffImg },
    ], inspectionTextSections);
    if (html) {
      try {
        const blob = new Blob([html], { type: "text/html" });
        const fileName = `check-request-${new Date().toISOString().slice(0, 10)}.html`;
        await supabase.storage.from("customer-documents").upload(`${sub.token}/check_request/${fileName}`, blob, { contentType: "text/html", upsert: true });
        toast({ title: "Check Request Generated", description: "Printed and saved to documents." });
        // #19 — Audit the generation event itself so a reviewer can see
        // exactly when the check request was produced and who produced it.
        supabase.from("activity_log").insert({
          submission_id: sub.id,
          action: "Check Request Generated",
          old_value: null,
          new_value: sub.offered_price ? `$${Number(sub.offered_price).toLocaleString()}` : null,
          performed_by: auditLabel,
        }).then(() => fetchActivityLog(sub.id));
      } catch {
        toast({ title: "Check request printed", description: "But failed to save a copy.", variant: "destructive" });
        // #17 — Surface the error into activity_log so the dealer can see
        // why without digging through Supabase logs.
        supabase.from("activity_log").insert({
          submission_id: sub.id,
          action: "Check Request Save Failed",
          old_value: null,
          new_value: "Print succeeded but upload to customer-documents bucket failed",
          performed_by: auditLabel,
        });
      }
    }
  };

  const handleSave = async () => {
    if (!sub) return;
    const { error } = await supabase.from("submissions").update({
      progress_status: sub.progress_status,
      offered_price: sub.offered_price,
      acv_value: sub.acv_value,
      check_request_done: sub.check_request_done,
      internal_notes: sub.internal_notes,
      name: sub.name,
      phone: sub.phone,
      email: sub.email,
      zip: sub.zip,
      address_street: sub.address_street,
      address_city: sub.address_city,
      address_state: sub.address_state,
      store_location_id: sub.store_location_id || null,
      status_updated_at: new Date().toISOString(),
      loan_payoff_amount: (sub as any).loan_payoff_amount ?? null,
      loan_payoff_verified: (sub as any).loan_payoff_verified ?? false,
      loan_payoff_updated_at: (sub as any).loan_payoff_updated_at ?? null,
      estimated_equity: (sub as any).estimated_equity ?? null,
    } as any).eq("id", sub.id);

    if (!error) {
      if (selected && selected.progress_status !== sub.progress_status) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id, action: "Status Changed",
          old_value: getStatusLabel(selected.progress_status),
          new_value: getStatusLabel(sub.progress_status),
          performed_by: auditLabel,
        });
      }
      if (selected && selected.offered_price !== sub.offered_price) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id, action: "Price Updated",
          old_value: selected.offered_price ? `$${selected.offered_price.toLocaleString()}` : "None",
          new_value: sub.offered_price ? `$${sub.offered_price.toLocaleString()}` : "None",
          performed_by: auditLabel,
        });
      }
      if (selected && selected.acv_value !== sub.acv_value) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id, action: "ACV Updated",
          old_value: selected.acv_value ? `$${selected.acv_value.toLocaleString()}` : "None",
          new_value: sub.acv_value ? `$${sub.acv_value.toLocaleString()}` : "None",
          performed_by: auditLabel,
        });
      }
      // #19 — Check-request workflow audit trail. Every flip of the
      // "Check Request Done" checkbox gets a signed timestamp entry so
      // auditors can reconstruct the full approval chain.
      if (selected && selected.check_request_done !== sub.check_request_done) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id,
          action: sub.check_request_done ? "Check Request Marked Done" : "Check Request Reopened",
          old_value: selected.check_request_done ? "Done" : "Pending",
          new_value: sub.check_request_done ? "Done" : "Pending",
          performed_by: auditLabel,
        });
      }
      if (selected && (selected.internal_notes || "") !== (sub.internal_notes || "")) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id,
          action: "Internal Notes Updated",
          old_value: null,
          new_value: null,
          performed_by: auditLabel,
        });
      }
      if (selected && (selected.store_location_id || null) !== (sub.store_location_id || null)) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id,
          action: "Store Assignment Changed",
          old_value: selected.store_location_id || "Unassigned",
          new_value: sub.store_location_id || "Unassigned",
          performed_by: auditLabel,
        });
      }
      // Notifications
      if (selected) {
        const ctx = { from: "SubmissionDetailSheet.save", submission_id: sub.id } as const;
        if (!selected.offered_price && sub.offered_price) {
          safeInvoke("send-notification", { body: { trigger_key: "customer_offer_ready", submission_id: sub.id }, context: ctx });
        }
        if (selected.offered_price && sub.offered_price && sub.offered_price > selected.offered_price) {
          safeInvoke("send-notification", { body: { trigger_key: "customer_offer_increased", submission_id: sub.id }, context: ctx });
        }
        if (selected.progress_status !== "purchase_complete" && sub.progress_status === "purchase_complete") {
          safeInvoke("send-notification", { body: { trigger_key: "staff_deal_completed", submission_id: sub.id }, context: ctx });
          safeInvoke("send-notification", { body: { trigger_key: "customer_purchase_complete", submission_id: sub.id }, context: ctx });
        }
        if (selected.progress_status !== "inspection_completed" && sub.progress_status === "inspection_completed") {
          safeInvoke("send-notification", { body: { trigger_key: "customer_inspection_complete", submission_id: sub.id }, context: ctx });
        }
        if (selected.progress_status !== "check_request_submitted" && sub.progress_status === "check_request_submitted") {
          safeInvoke("send-notification", { body: { trigger_key: "customer_check_ready", submission_id: sub.id }, context: ctx });
        }
        if (selected.progress_status !== sub.progress_status) {
          safeInvoke("send-notification", { body: { trigger_key: "status_change", submission_id: sub.id }, context: ctx });
        }
      }
      const { data: refreshed } = await supabase.from("submissions").select("*").eq("id", sub.id).maybeSingle();
      if (refreshed) {
        setEditState(refreshed as any);
        onUpdate(refreshed as any);

        // ── vAuto auto-push ────────────────────────────────────────
        // If the appraisal just became finalized and the dealer has enabled
        // auto-push, fire-and-forget a push to vAuto. The edge function is
        // idempotent-friendly (skeleton mode just logs; real mode sets
        // vauto_pushed=true) so it is safe to call even if the status ends
        // up already pushed.
        const r = refreshed as any;
        const wasFinalizedBefore = (selected as any)?.appraisal_finalized === true;
        const isFinalizedNow = r.appraisal_finalized === true;
        if (isFinalizedNow && !wasFinalizedBefore && !r.vauto_pushed) {
          (async () => {
            try {
              const dealershipId = r.dealership_id || "default";
              const { data: dealerRow } = await supabase
                .from("dealer_accounts")
                .select("vauto_enabled, vauto_auto_push")
                .eq("dealership_id", dealershipId)
                .maybeSingle();
              const d = dealerRow as any;
              if (d?.vauto_enabled && d?.vauto_auto_push) {
                supabase.functions
                  .invoke("push-to-vauto", {
                    body: { submission_id: r.id, pushed_by: "auto-finalize" },
                  })
                  .catch((err) => console.error("vauto auto-push failed", err));
                supabase
                  .from("activity_log")
                  .insert({
                    submission_id: r.id,
                    action: "vAuto Auto-Push",
                    old_value: null,
                    new_value: "triggered",
                    performed_by: auditLabel,
                  } as any)
                  .then(() => {}, () => {});
              }
            } catch (err) {
              console.error("vauto auto-push lookup failed", err);
            }
          })();
        }
      }
      fetchActivityLog(sub.id);
      toast({ title: "Record updated", description: "All changes have been saved." });
    } else {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  };

  if (!sub) return null;

  const currentStageIdx = getStageIndex(sub.progress_status);
  const stages = getProgressStages(sub);
  const isPriceAgreedOrBeyond = sub.progress_status !== "dead_lead" && currentStageIdx >= getStageIndex("deal_finalized") && sub.offered_price;
  const isAutoPopulated = sub.offered_price != null && sub.estimated_offer_high != null && sub.offered_price === sub.estimated_offer_high;

  return (
    <Sheet open={!!selected} onOpenChange={() => { setEditState(null); onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-5xl lg:max-w-6xl p-0 flex flex-col overflow-hidden [&>button]:hidden">
        {/* ── Premium Sticky Header ── */}
        <div className="sticky top-0 z-10 shrink-0">
          {/* Blue header — vehicle-first layout per design */}
          <div className="bg-gradient-to-r from-[#003b80] to-[#005bb5] text-white overflow-hidden">
            <div className="px-6 pt-4 pb-5">
              <SheetHeader>
                {/* Top row: close left, actions right */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditState(null); onClose(); }}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white hover:text-white transition-all print:hidden"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <span className="text-white/70 text-xs">Customer File</span>
                  </div>
                  <div className="flex items-center gap-1.5 print:hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrint}
                      className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white hover:text-white text-xs font-semibold transition-all"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { routerNavigate(`/appraisal/${sub.token}`); }}
                      className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white hover:text-white text-xs font-semibold transition-all"
                    >
                      <Gauge className="w-3.5 h-3.5 mr-1.5" /> Appraisal
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const next = !(sub as any).needs_appraisal;
                        const { error } = await (supabase as any)
                          .from("submissions")
                          .update({ needs_appraisal: next })
                          .eq("id", sub.id);
                        if (error) {
                          const isMissingColumn =
                            error.message?.includes("needs_appraisal") ||
                            (error.message?.includes("column") && error.message?.includes("does not exist"));
                          toast({
                            title: isMissingColumn ? "Queue not yet provisioned" : "Failed",
                            description: isMissingColumn
                              ? "The Appraiser Queue is still rolling out on your database. Refresh in a few minutes, or contact support if this persists."
                              : error.message,
                            variant: "destructive",
                          });
                          return;
                        }
                        updateField({ needs_appraisal: next } as any);
                        await supabase.from("activity_log").insert({
                          submission_id: sub.id,
                          action: next ? "Flagged for Appraiser Queue" : "Removed from Appraiser Queue",
                          old_value: null,
                          new_value: null,
                          performed_by: auditLabel,
                        });
                        toast({
                          title: next ? "Sent to Appraiser Queue" : "Removed from queue",
                          description: next ? "A manager can now see this in the Appraiser Queue." : undefined,
                        });
                        fetchActivityLog(sub.id);
                      }}
                      className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white hover:text-white text-xs font-semibold transition-all"
                    >
                      <Gauge className="w-3.5 h-3.5 mr-1.5" />
                      {(sub as any).needs_appraisal ? "In Queue" : "Send to Appraiser"}
                    </Button>
                  </div>
                </div>

                {/* Vehicle — make/model leads, year + mileage above, VIN/plate below */}
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-white/60 font-semibold mb-1">
                      {[sub.name, sub.vehicle_year, sub.mileage ? `${Number(sub.mileage).toLocaleString()} mi` : null].filter(Boolean).join(" · ")}
                    </div>
                    <SheetTitle className="font-display text-[28px] leading-[1.05] tracking-tight text-white">
                      {[sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "Submission Details"}
                    </SheetTitle>
                    <div className="flex items-center gap-3 mt-2 text-[13px] text-white/80 flex-wrap">
                      {sub.vin && (
                        <span className="font-mono bg-white/10 rounded px-2 py-0.5 tracking-wider text-[12px]">{sub.vin}</span>
                      )}
                      {sub.plate && <span>Plate · {sub.plate}</span>}
                      {sub.exterior_color && <span className="text-white/60">· {sub.exterior_color}</span>}
                    </div>
                  </div>

                  {/* Big offer / estimate number */}
                  {(sub.offered_price || sub.estimated_offer_high) && (
                    <div className="text-right shrink-0">
                      <div className="text-[11px] uppercase tracking-[0.15em] text-white/60 font-semibold">
                        {sub.offered_price ? "Offer Given" : "Estimated Offer"}
                      </div>
                      <div className="font-display text-[44px] leading-none tracking-tight mt-0.5">
                        ${Math.floor(sub.offered_price || sub.estimated_offer_high || 0).toLocaleString()}
                      </div>
                      {sub.acv_value != null && (
                        <div className="text-[11px] text-white/60 mt-1">
                          ACV ${Number(sub.acv_value).toLocaleString()}
                          {sub.offered_price != null && (
                            <span className={`ml-2 font-semibold ${sub.offered_price > sub.acv_value ? "text-emerald-300" : "text-red-300"}`}>
                              {sub.offered_price > sub.acv_value ? "+" : ""}${Math.floor(sub.offered_price - sub.acv_value).toLocaleString()} spread
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status chips row */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 border whitespace-nowrap ${
                    sub.progress_status === "purchase_complete" ? "bg-emerald-400/25 text-emerald-100 border-emerald-300/40" :
                    sub.progress_status === "dead_lead" ? "bg-red-400/25 text-red-100 border-red-300/40" :
                    "bg-white/15 text-white border-white/25"
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {getStatusLabel(sub.progress_status)}
                  </span>
                  {sub.is_hot_lead && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-orange-400/25 text-orange-100 border border-orange-300/50 whitespace-nowrap">
                      🔥 Hot Lead
                    </span>
                  )}
                  <span className="text-[11px] text-white/60 ml-auto">
                    {new Date(sub.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </SheetHeader>
            </div>

            {/* Status banner — shown when customer has arrived or is on the way.
                Uses (sub as any) because arrived_at / on_the_way_at may not be
                in the Submission type yet; degrades gracefully when absent. */}
            {(sub as any).arrived_at && sub.progress_status === "arrived" ? (
              <div className="bg-gradient-to-r from-red-600 to-red-500 border-t border-red-900/30 px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex items-center justify-center shrink-0">
                    <span className="absolute inline-flex h-3 w-3 rounded-full bg-white/60 animate-ping" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                  </span>
                  <span className="text-sm font-semibold text-white">
                    Customer Arrived · {new Date((sub as any).arrived_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — Go greet them now
                  </span>
                </div>
              </div>
            ) : (sub as any).on_the_way_at && sub.progress_status === "on_the_way" ? (
              <div className="bg-gradient-to-r from-amber-600 to-amber-500 border-t border-amber-900/30 px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex items-center justify-center shrink-0">
                    <span className="absolute inline-flex h-3 w-3 rounded-full bg-white/60 animate-ping" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                  </span>
                  <span className="text-sm font-semibold text-white">
                    Customer On The Way · {new Date((sub as any).on_the_way_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — Prepare for their arrival
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Alerts (full width) */}
        {(duplicateWarnings[sub.id]?.length > 0 || optOutStatus.email || optOutStatus.sms) && (
          <div className="px-6 pt-4 space-y-2.5 shrink-0">
            {duplicateWarnings[sub.id]?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-700">Possible Duplicate Detected</p>
                  {duplicateWarnings[sub.id].map((w, i) => <p key={i} className="text-xs text-red-600/80 mt-0.5">{w}</p>)}
                </div>
              </div>
            )}
            {(optOutStatus.email || optOutStatus.sms) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700">Customer Unsubscribed</p>
                  <div className="flex gap-2 mt-1.5">
                    {optOutStatus.email && <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 rounded-lg"><Mail className="w-3 h-3 mr-1" /> Email opted out</Badge>}
                    {optOutStatus.sms && <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 rounded-lg"><Phone className="w-3 h-3 mr-1" /> SMS opted out</Badge>}
                  </div>
                  <p className="text-[11px] text-amber-600/80 mt-1.5">Follow-up messages to opted-out channels will be skipped automatically.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TWO-COLUMN BODY                                                 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

          {/* ────────────────────────────────────────────────────────────── */}
          {/* LEFT COLUMN — sticky deal summary (~40%)                      */}
          {/* ────────────────────────────────────────────────────────────── */}
          <div className="lg:w-[40%] lg:border-r border-slate-200 overflow-y-auto p-5 lg:p-6 space-y-5 shrink-0 bg-slate-50/50">

            {/* Pinned quick-summary — first thing BDCs / sales see */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <QuickSummary sub={sub} statusLabel={getStatusLabel(sub.progress_status)} />
              </div>
              <DLAtAGlance docs={docs} />
            </div>

            {/* Offered Price — Deal Value Card */}
            {(canSetPrice || sub.offered_price) && (
              <div data-print-section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-[#003b80]/50" />
                    Deal Value
                  </h3>
                  {sub.offered_price != null && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg cursor-help border ${isAutoPopulated ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                            {isAutoPopulated ? <><CheckCircle2 className="w-3 h-3" /> Auto · Accepted</> : <><Users className="w-3 h-3" /> Staff Set</>}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          {isAutoPopulated ? "Automatically set when the customer accepted." : "Manually entered by a manager or admin."}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="p-5">
                  {canSetPrice ? (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="pl-10 h-14 text-2xl font-black tracking-tight border-2 border-slate-200 focus:border-[#003b80]/50 rounded-lg"
                        value={sub.offered_price != null ? Number(sub.offered_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, "");
                          updateField({ offered_price: raw ? Number(raw) : null });
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-4xl font-black text-slate-900 tracking-tight font-display">
                      {(() => {
                        const val = sub.offered_price ?? 0;
                        const [dollars, cents] = val.toFixed(2).split(".");
                        return <>${Number(dollars).toLocaleString()}<span className="text-lg text-slate-400 font-semibold">.{cents}</span></>;
                      })()}
                    </p>
                  )}
                  {sub.estimated_offer_high && sub.offered_price !== sub.estimated_offer_high && (
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3" />
                      Estimated range: ${Math.floor(sub.estimated_offer_high * 0.9).toLocaleString()} — ${Math.floor(sub.estimated_offer_high).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Lead Score Indicator */}
            {(() => {
              const ls = calculateLeadScore(sub);
              return (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-[#003b80]/50" />
                      Lead Score
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getScoreColor(ls.score)}`}>
                      {ls.label}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-3xl font-black tracking-tight text-slate-900">{ls.score}</span>
                      <div className="flex-1">
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              ls.score >= 80 ? "bg-orange-500" :
                              ls.score >= 60 ? "bg-amber-500" :
                              ls.score >= 40 ? "bg-blue-500" :
                              "bg-slate-300"
                            }`}
                            style={{ width: `${ls.score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {ls.factors.map((f, i) => (
                        <p key={i} className="text-[11px] text-slate-400 leading-snug">{f}</p>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ACV Value */}
            {sub.acv_value && (
              <SectionCard icon={Gauge} title="Appraisal Value (ACV)" accent="success">
                <div className="flex items-end justify-between mb-3">
                  <p className="text-2xl font-black text-slate-900 tracking-tight font-display">${Number(sub.acv_value).toLocaleString()}</p>
                  {sub.offered_price && sub.acv_value && (
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Spread</p>
                      <p className={`text-sm font-bold ${(sub.acv_value - sub.offered_price) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {(sub.acv_value - sub.offered_price) > 0 ? "+" : ""}${Math.floor(sub.acv_value - sub.offered_price).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                {sub.appraised_by && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-3">
                    <Users className="w-3 h-3" /> Appraised by: <span className="font-semibold text-slate-700">{sub.appraised_by}</span>
                  </p>
                )}
                <Button variant="outline" size="sm" className="rounded-lg h-9 text-xs font-semibold border-slate-300 bg-white text-slate-700" onClick={() => { routerNavigate(`/appraisal/${sub.token}`); }}>
                  <Gauge className="w-3.5 h-3.5 mr-1.5" /> Open Appraisal Tool
                </Button>
              </SectionCard>
            )}
            {!sub.acv_value && canSetPrice && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-5 text-center">
                <Gauge className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 mb-3">No ACV set yet</p>
                <Button variant="outline" size="sm" className="rounded-lg h-9 text-xs font-semibold border-slate-300 bg-white text-slate-700" onClick={() => { routerNavigate(`/appraisal/${sub.token}`); }}>
                  <Gauge className="w-3.5 h-3.5 mr-1.5" /> Open Appraisal Tool
                </Button>
              </div>
            )}

            {/* OBD-II Quick Indicator */}
            {sub.id && <CompactOBDIndicator submissionId={sub.id} token={sub.token} />}

            {/* Black Book Market Values — Private Party reference */}
            {(() => {
              const tiers = typeof sub.bb_value_tiers === "string" ? (() => { try { return JSON.parse(sub.bb_value_tiers); } catch { return null; } })() : sub.bb_value_tiers;
              const hasAnyBBData = tiers || sub.bb_tradein_avg || sub.bb_retail_avg || sub.bb_wholesale_avg;
              if (!hasAnyBBData) return null;

              const privatePartyAvg = tiers?.private_party?.avg ? Number(tiers.private_party.avg) : null;
              const retailAvg = tiers?.retail?.avg ? Number(tiers.retail.avg) : (sub.bb_retail_avg ? Number(sub.bb_retail_avg) : null);
              const tradeinAvg = tiers?.tradein?.avg ? Number(tiers.tradein.avg) : (sub.bb_tradein_avg ? Number(sub.bb_tradein_avg) : null);
              const wholesaleAvg = tiers?.wholesale?.avg ? Number(tiers.wholesale.avg) : (sub.bb_wholesale_avg ? Number(sub.bb_wholesale_avg) : null);

              const valueRows = [
                { label: "Retail", value: retailAvg, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", dotBg: "bg-emerald-500" },
                { label: "Private Party", value: privatePartyAvg, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", dotBg: "bg-amber-500", highlight: true },
                { label: "Trade-In", value: tradeinAvg, color: "text-primary", bg: "bg-primary/10", dotBg: "bg-primary" },
                { label: "Wholesale", value: wholesaleAvg, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", dotBg: "bg-blue-500" },
              ].filter(r => r.value && r.value > 0);

              if (valueRows.length === 0) return null;

              return (
                <SectionCard icon={BarChart3} title="Book Values" headerRight={
                  <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 uppercase tracking-wider">Black Book</span>
                }>
                  <div className="space-y-2">
                    {valueRows.map(row => (
                      <div key={row.label} className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${row.highlight ? `${row.bg} border border-amber-200` : "hover:bg-slate-50"}`}>
                        <span className="flex items-center gap-2 text-sm">
                          <span className={`w-2 h-2 rounded-full ${row.dotBg}`} />
                          <span className={row.highlight ? "font-bold text-slate-900" : "text-slate-500"}>{row.label}</span>
                          {row.highlight && <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Key Ref</span>}
                        </span>
                        <span className={`text-sm font-bold ${row.color}`}>${Math.floor(row.value!).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {privatePartyAvg && sub.offered_price && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Savings vs Private Sale</span>
                        <span className="font-bold text-[#003b80]">
                          Customer saves ~${Math.floor(privatePartyAvg - sub.offered_price).toLocaleString()} in hassle
                        </span>
                      </div>
                    </div>
                  )}
                </SectionCard>
              );
            })()}

            {/* Acquisition Tracker (Status + Pipeline) */}
            <SectionCard icon={TrendingUp} title="Acquisition Tracker" headerRight={
              sub.progress_status !== "new" && sub.progress_status !== "dead_lead" ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 rounded px-2 py-0.5"><Check className="w-3 h-3 text-emerald-500" /> Synced</span>
              ) : undefined
            }>
              {/* Status chips */}
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  { check: sub.appointment_set, label: "Inspection", activeLabel: "Scheduled", pendingLabel: "Not Set", icon: CalendarDays },
                  { check: sub.docs_uploaded, label: "Docs", activeLabel: "Uploaded", pendingLabel: "Pending", icon: FileText },
                  { check: sub.photos_uploaded, label: "Photos", activeLabel: "Uploaded", pendingLabel: "Pending", icon: Camera },
                ].map(chip => (
                  <div key={chip.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    chip.check
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-50 text-slate-400 border-slate-200"
                  }`}>
                    {chip.check ? <CheckCircle2 className="w-3.5 h-3.5" /> : <chip.icon className="w-3.5 h-3.5" />}
                    {chip.label} {chip.check ? chip.activeLabel : chip.pendingLabel}
                  </div>
                ))}
              </div>

              {sub.progress_status === "dead_lead" ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <span className="font-bold text-red-700 text-sm block">Dead Lead</span>
                    <span className="text-xs text-red-500">This opportunity has been closed</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-0 w-full">
                  {stages.filter(s => s.key !== "dead_lead").map((stage, i, arr) => {
                    const isComplete = i < currentStageIdx;
                    const isCurrent = i === currentStageIdx;
                    return (
                      <div key={stage.key} className="flex items-center flex-1 min-w-0">
                        <div className="flex flex-col items-center w-full">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-300 ${
                            isComplete ? "bg-emerald-500 text-white" :
                            isCurrent ? "bg-[#003b80] text-white ring-[3px] ring-[#003b80]/20" :
                            "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}>
                            {isComplete ? <Check className="w-4 h-4" /> : <stage.icon className="w-3.5 h-3.5" />}
                          </div>
                          <span className={`text-[10px] mt-2 text-center leading-tight max-w-[70px] transition-colors ${
                            isCurrent ? "font-extrabold text-[#003b80]" :
                            isComplete ? "font-semibold text-slate-700" :
                            "text-slate-400"
                          }`}>
                            {stage.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`h-[2px] flex-1 min-w-[8px] -mt-5 rounded-full transition-all ${
                            isComplete ? "bg-emerald-500" : "bg-slate-200"
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(sub.progress_status === "inspection_completed" || sub.progress_status === "manager_approval_inspection") && (
                <div className="mt-3 flex justify-end">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.open(getDocsUrl(sub.token), "_blank")}>
                    <Upload className="w-3 h-3 mr-1" /> Upload Appraisal
                  </Button>
                </div>
              )}

              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Update Status</label>
                <Select
                  value={sub.progress_status}
                  disabled={!canUpdateStatus || (["deal_finalized", "check_request_submitted", "purchase_complete"].includes(sub.progress_status) && !canApprove)}
                  onValueChange={(val) => {
                    if (["deal_finalized", "check_request_submitted", "purchase_complete"].includes(val) && !canApprove) {
                      toast({ title: "Not authorized", description: "Only GSM/GM can approve.", variant: "destructive" });
                      return;
                    }
                    updateField({ progress_status: val });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_STATUS_OPTIONS.map(s => {
                      const locked = ["deal_finalized", "check_request_submitted", "purchase_complete"].includes(s.key) && !canApprove;
                      return <SelectItem key={s.key} value={s.key} disabled={locked}>{s.label}{locked ? " (GSM/GM only)" : ""}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </SectionCard>

            {/* Assigned Store */}
            <SectionCard icon={MapPin} title="Assigned Store">
              <Select value={sub.store_location_id || "unassigned"} onValueChange={(v) => updateField({ store_location_id: v === "unassigned" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">— Not Assigned —</SelectItem>
                  {dealerLocations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</SelectItem>)}
                </SelectContent>
              </Select>
            </SectionCard>

            {/* Appointment — Premium */}
            <SectionCard icon={CalendarDays} title="Appointment" accent={sub.appointment_set ? "success" : undefined}>
              {sub.appointment_set && sub.appointment_date ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-900 font-bold">
                        {new Date(sub.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        {selectedApptTime && <span className="text-emerald-700 font-semibold ml-1.5">at {selectedApptTime}</span>}
                      </p>
                      {selectedApptLocation && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {getLocationLabel(selectedApptLocation)}</p>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-lg h-9 text-xs font-semibold border-slate-300 bg-white text-slate-700" onClick={() => onScheduleAppointment(sub)}>
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Reschedule
                  </Button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Button variant="outline" size="sm" className="rounded-lg h-9 text-xs font-semibold border-slate-300 bg-white text-slate-700" onClick={() => onScheduleAppointment(sub)}>
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Schedule Appointment
                  </Button>
                </div>
              )}
            </SectionCard>

            {/* Check Request — Premium */}
            <SectionCard icon={ClipboardCheck} title="Check Request" accent={sub.check_request_done ? "success" : undefined}>
              <div className="flex items-center gap-3 mb-4 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <Checkbox id="check-request-done" checked={sub.check_request_done} disabled={!isPriceAgreedOrBeyond || !(sub as any).appraisal_finalized} onCheckedChange={(checked) => updateField({ check_request_done: !!checked })} className="rounded-md" />
                <label htmlFor="check-request-done" className={`text-sm font-semibold ${isPriceAgreedOrBeyond ? "text-slate-900" : "text-slate-400"}`}>Check Request Completed</label>
              </div>
              {!(sub as any).appraisal_finalized ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">Appraisal must be finalized before generating a check request.</span>
                </div>
              ) : isPriceAgreedOrBeyond ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg h-9 text-xs font-semibold border-slate-300 bg-white text-slate-700" onClick={handleGenerateCheckRequest}>
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> Generate Check Request
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg h-9 text-xs font-semibold border-slate-300 bg-white text-slate-700" onClick={handlePrintAllDocs}>
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> Print All Docs
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400">Check request includes all docs. "Print All Docs" reprints supporting documents only.</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Available once price is agreed and entered.</p>
              )}
            </SectionCard>

            {/* Review Request */}
            {sub.progress_status === "purchase_complete" && sub.email && (
              <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-100">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-[#003b80]/50" />
                    Request Customer Review
                  </h3>
                </div>
                <div className="relative p-5">
                  {sub.review_requested ? (
                    <div className="flex items-center gap-3 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="font-semibold">Review request sent{sub.review_requested_at ? ` on ${new Date(sub.review_requested_at).toLocaleDateString()}` : ""}</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-500">Send an email asking the customer to leave a review for this completed purchase.</p>
                      <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg h-9 font-semibold" onClick={async () => {
                        toast({ title: "Sending...", description: "Sending review request email..." });
                        try {
                          const res = await supabase.functions.invoke("send-review-request", { body: { submission_id: sub.id, submission_token: sub.token } });
                          if (res.error || res.data?.error) { toast({ title: "Failed", description: res.data?.error || "Could not send.", variant: "destructive" }); }
                          else {
                            toast({ title: "Review request sent!", description: "The customer will receive the email shortly." });
                            updateField({ review_requested: true, review_requested_at: new Date().toISOString() });
                            fetchSubmissions();
                          }
                        } catch { toast({ title: "Error", description: "Something went wrong.", variant: "destructive" }); }
                      }}>
                        <Mail className="w-4 h-4 mr-1.5" /> Send Review Request
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save + Delete */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm pt-4 pb-2 border-t border-slate-200 flex gap-3 px-5 -mx-5 -mb-5">
              <Button
                className="flex-1 h-10 px-5 rounded-lg font-semibold text-sm bg-[#003b80] hover:bg-[#002a5c] text-white transition-colors"
                disabled={sub.progress_status === "inspection_completed" && !sub.acv_value}
                onClick={handleSave}
              >
                <Save className="w-4 h-4 mr-2" /> Update Record
              </Button>
              {canDelete && (
                <Button variant="destructive" className="h-10 px-5 rounded-lg font-semibold text-sm" onClick={() => onDelete(sub.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              )}
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────────── */}
          {/* RIGHT COLUMN — scrollable details (~60%)                      */}
          {/* ────────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-5 min-h-0 bg-white">

            {/* Contact + Vehicle */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <SectionCard icon={Users} title="Contact Information" headerRight={
                (sub.phone || sub.email) ? (
                  <div className="flex items-center gap-1">
                    {sub.phone && (
                      <a href={`tel:${sub.phone}`} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer">
                        <Phone className="w-3 h-3" /> Call
                      </a>
                    )}
                    {sub.email && (
                      <a href={`mailto:${sub.email}`} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer">
                        <Mail className="w-3 h-3" /> Email
                      </a>
                    )}
                  </div>
                ) : undefined
              }>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Name</Label>
                    <Input value={sub.name || ""} onChange={(e) => updateField({ name: e.target.value || null })} placeholder="Full name" className="h-9 text-sm rounded-lg border-slate-200 focus:border-[#003b80]/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      Phone
                      {sub.phone && (
                        <a href={`tel:${sub.phone}`} title="Call this number" className="text-primary/60 hover:text-primary transition-colors">
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                    </Label>
                    <Input value={sub.phone || ""} onChange={(e) => updateField({ phone: e.target.value || null })} placeholder="(555) 123-4567" className="h-9 text-sm rounded-lg border-slate-200 focus:border-[#003b80]/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      Email
                      {sub.email && (
                        <a href={`mailto:${sub.email}`} title="Send email" className="text-primary/60 hover:text-primary transition-colors">
                          <Mail className="w-3 h-3" />
                        </a>
                      )}
                    </Label>
                    <Input type="email" value={sub.email || ""} onChange={(e) => updateField({ email: e.target.value || null })} placeholder="email@example.com" className="h-9 text-sm rounded-lg border-slate-200 focus:border-[#003b80]/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ZIP</Label>
                    <Input value={sub.zip || ""} onChange={(e) => updateField({ zip: e.target.value || null })} placeholder="ZIP code" className="h-9 text-sm rounded-lg border-slate-200 focus:border-[#003b80]/40" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/30">
                  <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-2.5">Address</Label>
                  <div className="space-y-2.5">
                    <Input value={sub.address_street || ""} onChange={(e) => updateField({ address_street: e.target.value || null })} placeholder="Street address" className="h-9 text-sm rounded-lg border-slate-200 focus:border-[#003b80]/40" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={sub.address_city || ""} onChange={(e) => updateField({ address_city: e.target.value || null })} placeholder="City" className="h-9 text-sm rounded-lg border-slate-200 focus:border-[#003b80]/40" />
                      <Input value={sub.address_state || ""} onChange={(e) => updateField({ address_state: e.target.value || null })} placeholder="State" className="h-9 text-sm rounded-lg border-slate-200 focus:border-[#003b80]/40" />
                      <Input value={sub.zip || ""} placeholder="ZIP" className="h-9 text-sm rounded-xl border-border/60 opacity-50" disabled />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={Car}
                title="Vehicle Details"
                headerRight={(() => {
                  const INSPECTED_STATUSES = ['inspection_completed','appraisal_completed','manager_approval','price_agreed','title_verified','ownership_verified','purchase_complete'];
                  const isInspected = INSPECTED_STATUSES.includes(sub.progress_status);
                  const inspClass = isInspected
                    ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 border-0"
                    : "bg-gradient-to-r from-orange-400 to-amber-500 text-white hover:from-orange-500 hover:to-amber-600 border-0";
                  const inspLabel = isInspected ? "Inspection Completed" : "Inspection Needed";
                  return (
                    <Button size="sm" className={`h-7 text-xs gap-1 ${inspClass}`} onClick={() => { routerNavigate(`/inspection/${sub.id}`); }}>
                      <ClipboardList className="w-3.5 h-3.5" /> {inspLabel}
                    </Button>
                  );
                })()}
              >
                {sub.vehicle_year && sub.vehicle_make && sub.vehicle_model && (
                  <div className="mb-4 rounded-lg overflow-hidden bg-slate-100" style={{ aspectRatio: "16/7" }}>
                    <VehicleImage year={sub.vehicle_year} make={sub.vehicle_make} model={sub.vehicle_model} selectedColor={sub.exterior_color || ""} compact />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Year/Make/Model" value={`${sub.vehicle_year || ""} ${sub.vehicle_make || ""} ${sub.vehicle_model || ""}`.trim() || null} icon={<Car className="w-3.5 h-3.5" />} />
                  <DetailRow label="VIN" value={
                    sub.vin ? (
                      <span className="flex items-center gap-1.5">
                        {sub.vin}
                        {(sub as any).vin_verified && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 rounded-full px-1.5 py-0.5" title="VIN verified via document OCR">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </span>
                    ) : null
                  } icon={<Info className="w-3.5 h-3.5" />} />
                  <DetailRow label="Plate" value={sub.plate} icon={<FileText className="w-3.5 h-3.5" />} />
                  <DetailRow label="Mileage" value={sub.mileage} icon={<Gauge className="w-3.5 h-3.5" />} />
                  <DetailRow label="Exterior Color" value={sub.exterior_color} icon={<Palette className="w-3.5 h-3.5" />} />
                  <DetailRow label="Drivetrain" value={sub.drivetrain} icon={<Settings2 className="w-3.5 h-3.5" />} />
                  <DetailRow label="Modifications" value={sub.modifications} icon={<Settings2 className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>
            </div>

            {/* Condition + Loan */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <SectionCard icon={Search} title="Condition & History">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Overall" value={sub.overall_condition} icon={<Sparkles className="w-3.5 h-3.5" />} />
                  <DetailRow label="Drivable" value={sub.drivable} icon={<Car className="w-3.5 h-3.5" />} />
                  <ArrayDetail label="Exterior Damage" value={sub.exterior_damage} icon={<Palette className="w-3.5 h-3.5" />} />
                  <DetailRow label="Windshield" value={sub.windshield_damage} icon={<Wind className="w-3.5 h-3.5" />} />
                  <DetailRow label="Moonroof" value={sub.moonroof} />
                  <ArrayDetail label="Interior Damage" value={sub.interior_damage} icon={<CircleDot className="w-3.5 h-3.5" />} />
                  <ArrayDetail label="Tech Issues" value={sub.tech_issues} icon={<Search className="w-3.5 h-3.5" />} />
                  <ArrayDetail label="Engine Issues" value={sub.engine_issues} icon={<Settings2 className="w-3.5 h-3.5" />} />
                  <ArrayDetail label="Mechanical Issues" value={sub.mechanical_issues} icon={<Wrench className="w-3.5 h-3.5" />} />
                  <DetailRow label="Accidents" value={sub.accidents} icon={<Car className="w-3.5 h-3.5" />} />
                  <DetailRow label="Smoked In" value={sub.smoked_in} icon={<Cigarette className="w-3.5 h-3.5" />} />
                  <DetailRow label="Tires Replaced" value={sub.tires_replaced} icon={<CircleDot className="w-3.5 h-3.5" />} />
                  <DetailRow label="Keys" value={sub.num_keys} icon={<Key className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              <SectionCard icon={DollarSign} title="Loan & Info">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Loan Status" value={sub.loan_status} icon={<Info className="w-3.5 h-3.5" />} />
                  <DetailRow label="Loan Company" value={sub.loan_company} icon={<FileText className="w-3.5 h-3.5" />} />
                  <DetailRow label="Loan Balance" value={sub.loan_balance} icon={<DollarSign className="w-3.5 h-3.5" />} />
                  <DetailRow label="Loan Payment" value={sub.loan_payment} icon={<DollarSign className="w-3.5 h-3.5" />} />
                  {/* Verified Payoff Amount (drives equity calc) */}
                  <div className="col-span-2 mt-2 p-3 rounded-xl bg-muted/30 border border-border/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Verified Payoff Amount
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id="loan-payoff-verified"
                          checked={!!(sub as any).loan_payoff_verified}
                          onCheckedChange={(checked) => {
                            updateField({
                              loan_payoff_verified: !!checked,
                              loan_payoff_updated_at: new Date().toISOString(),
                            } as any);
                          }}
                          className="rounded-md h-4 w-4"
                        />
                        <label htmlFor="loan-payoff-verified" className="text-[11px] text-muted-foreground cursor-pointer">
                          Verified with lender
                        </label>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={(sub as any).loan_payoff_amount ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const payoff = raw === "" ? null : Number(raw);
                          const vehicleValue = sub.offered_price ?? sub.estimated_offer_high ?? 0;
                          const equity = vehicleValue && vehicleValue > 0
                            ? vehicleValue - (payoff ?? 0)
                            : null;
                          updateField({
                            loan_payoff_amount: payoff,
                            estimated_equity: equity,
                            loan_payoff_updated_at: new Date().toISOString(),
                          } as any);
                        }}
                        className="h-9 pl-7 text-sm rounded-xl border-border/60 focus:border-primary/40"
                      />
                    </div>
                    {(() => {
                      const vehicleValue = sub.offered_price ?? sub.estimated_offer_high ?? 0;
                      const payoff = (sub as any).loan_payoff_amount ?? null;
                      const result = calculateEquity(vehicleValue, payoff);
                      return (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-muted-foreground">Customer Equity</span>
                          <span className={`text-sm font-bold ${result.color}`}>
                            {result.displayText}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <DetailRow label="Next Step" value={sub.next_step} icon={<TrendingUp className="w-3.5 h-3.5" />} />
                  <div className="flex items-center justify-between col-span-2 mt-1">
                    <span className="text-xs text-muted-foreground">Lead Source</span>
                    <Select value={sub.lead_source} onValueChange={async (val) => {
                      await supabase.from("submissions").update({ lead_source: val }).eq("id", sub.id);
                      updateField({ lead_source: val });
                      toast({ title: "Lead source updated" });
                    }}>
                      <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inventory">Off Street Purchase</SelectItem>
                        <SelectItem value="service">Service Drive</SelectItem>
                        <SelectItem value="trade">Trade-In</SelectItem>
                        <SelectItem value="in_store_trade">In-Store Trade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Retail Market was moved into the "Research & Automation"
                collapsible further down so the top of the right column
                stays focused on deal-critical info. */}

            {/* Internal Notes — Premium
                InspectionVitals replaces the old auto-generated
                "[INSPECTION...]" text dump. Inspector-typed notes still
                live in the textarea below. */}
            <SectionCard icon={StickyNote} title="Internal Notes">
              <InspectionVitals submissionId={sub.id} />
              <Textarea
                placeholder="Add team notes, observations, or follow-up reminders..."
                value={
                  // Strip any legacy auto-generated "[INSPECTION…]" dump so the
                  // field only shows the inspector's actual typed text.
                  (sub.internal_notes || "").replace(/\[INSPECTION[\s\S]*?\](\s*\n)?/g, "").trim()
                }
                onChange={(e) => updateField({ internal_notes: e.target.value || null })}
                rows={4}
                className="rounded-lg border-slate-200 focus:border-[#003b80]/40 resize-none text-sm leading-relaxed text-slate-700"
              />
            </SectionCard>

            {/* Photos + Documents */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <SectionCard icon={Camera} title="Photos" headerRight={
                photos.length > 0 ? (
                  <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-lg px-2 py-0.5">{photos.length}</span>
                ) : undefined
              }>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2.5">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative group/photo rounded-xl overflow-hidden border border-border/30 shadow-sm hover:shadow-lg transition-all duration-300">
                        <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-32 object-cover group-hover/photo:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/photo:opacity-100 transition-opacity duration-300" />
                          <div className="absolute bottom-2 left-2 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-300">
                            <span className="text-[10px] text-white font-medium bg-black/40 backdrop-blur-sm rounded-md px-2 py-0.5">
                              <ExternalLink className="w-2.5 h-2.5 inline mr-1" />View
                            </span>
                          </div>
                        </a>
                        {canDelete && (
                          <button onClick={() => onDeletePhoto(photo.name)} className="absolute top-2 right-2 bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-lg p-1.5 opacity-0 group-hover/photo:opacity-100 transition-all duration-200 hover:bg-destructive shadow-lg" title="Delete photo">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                    <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No photos uploaded</p>
                  </div>
                )}
                <div className="mt-3">
                  <StaffFileUpload token={sub.token} bucket="submission-photos" onUploadComplete={() => onRefresh(sub)} />
                </div>
              </SectionCard>

              <SectionCard icon={FileText} title="Documents" headerRight={
                docs.length > 0 ? (
                  <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-lg px-2 py-0.5">{docs.length}</span>
                ) : undefined
              }>
                {docs.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(docs.reduce<Record<string, typeof docs>>((acc, doc) => { if (!acc[doc.type]) acc[doc.type] = []; acc[doc.type].push(doc); return acc; }, {})).map(([type, typeDocs]) => (
                      <div key={type}>
                        <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">{DOC_TYPE_LABELS[type] || type}</p>
                        <div className="grid grid-cols-3 gap-2.5">
                          {typeDocs.map((doc, i) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);
                            return (
                              <div key={i} className="relative group/doc rounded-xl overflow-hidden border border-border/30 shadow-sm hover:shadow-lg transition-all duration-300">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block">
                                  {isImage ? (
                                    <>
                                      <img src={doc.url} alt={doc.name} className="w-full h-32 object-cover group-hover/doc:scale-105 transition-transform duration-500" />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/doc:opacity-100 transition-opacity duration-300" />
                                    </>
                                  ) : (
                                    <div className="w-full h-32 bg-gradient-to-br from-muted/60 to-muted/30 flex flex-col items-center justify-center hover:from-muted/80 transition-colors border-b border-border/20">
                                      <FileText className="w-8 h-8 text-muted-foreground/40 mb-1.5" />
                                      <span className="text-[10px] text-muted-foreground text-center px-2 truncate w-full font-medium">{doc.name}</span>
                                    </div>
                                  )}
                                </a>
                                {canDelete && (
                                  <button onClick={() => onDeleteDoc(doc.type, doc.name)} className="absolute top-2 right-2 bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-lg p-1.5 opacity-0 group-hover/doc:opacity-100 transition-all duration-200 hover:bg-destructive shadow-lg" title="Delete document">
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
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No documents uploaded</p>
                  </div>
                )}
                <div className="mt-3">
                  <StaffFileUpload token={sub.token} bucket="customer-documents" onUploadComplete={() => onRefresh(sub)} />
                </div>
              </SectionCard>
            </div>

            {/* Customer Documents QR — Premium sharing card */}
            <SectionCard icon={Upload} title="Document Upload Link">
              <p className="text-sm text-slate-500 mb-4">Share this link with the customer to upload their documents securely.</p>
              <div className="flex items-start gap-5">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex-shrink-0">
                  <QRCodeSVG value={getDocsUrl(sub.token)} size={110} />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-[11px] text-slate-500 break-all font-mono leading-relaxed">{getDocsUrl(sub.token)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg h-9 font-semibold text-xs border-slate-300 bg-white text-slate-700" onClick={() => { navigator.clipboard.writeText(getDocsUrl(sub.token)); toast({ title: "Link copied!" }); }}>
                      <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Copy Link
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg h-9 font-semibold text-xs border-slate-300 bg-white text-slate-700" onClick={() => window.open(getDocsUrl(sub.token), "_blank")}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open
                    </Button>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ─────────────────────────────────────────────────────────
                Research & Automation — collapsible so the top of the file
                stays focused on the deal. Contains Retail Market,
                Follow-Up Sequencer, AI Call History, and the full Activity
                Log. All were cluttering the everyday BDC / sales view.
                ───────────────────────────────────────────────────────── */}
            <details className="group/more rounded-xl border border-slate-200 bg-white overflow-hidden [&[open]>summary>svg]:rotate-180">
              <summary className="flex items-center justify-between gap-2 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#003b80]/50" />
                  Research &amp; Automation
                </span>
                <span className="text-[10px] text-slate-400">Market · Follow-ups · Call history · Activity log</span>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-200" />
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-5 border-t border-slate-100">

            {/* Retail Market Context (moved into collapsible) */}
            {(sub.vin || sub.vehicle_year) && (
              <SectionCard icon={TrendingUp} title="Retail Market">
                <RetailMarketPanel
                  vin={sub.vin || undefined}
                  zipcode={sub.zip || undefined}
                  offerHigh={sub.offered_price ?? sub.estimated_offer_high ?? 0}
                />
              </SectionCard>
            )}

            {/* Follow-Up Sequence */}
            <FollowUpPanel submissionId={sub.id} hasOffer={!!(sub.offered_price || sub.estimated_offer_high)} progressStatus={sub.progress_status} />

            {/* AI Call History */}
            {callHistory.length > 0 && (
              <SectionCard icon={Phone} title="AI Call History" headerRight={
                <span className="text-[10px] text-muted-foreground">{callHistory.length} calls</span>
              }>
                <div className="space-y-3">
                  {callHistory.map(call => (
                    <div key={call.id} className="border border-border/30 rounded-xl overflow-hidden">
                      {/* Header: outcome badge + duration + date */}
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Badge className={outcomeColor(call.outcome)}>{call.outcome?.replace(/_/g, ' ') || call.status}</Badge>
                          {call.duration_seconds && <span className="text-xs text-muted-foreground">{Math.round(call.duration_seconds / 60)}m {Math.round(call.duration_seconds % 60)}s</span>}
                          {call.attempt_number > 1 && <span className="text-[10px] text-muted-foreground">Attempt #{call.attempt_number}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(call.created_at).toLocaleString()}</span>
                      </div>

                      {/* Summary */}
                      {call.summary && (
                        <div className="px-3 py-2 text-sm text-card-foreground border-b border-border/20">
                          <p className="font-medium text-xs text-muted-foreground mb-1">Summary</p>
                          {call.summary}
                        </div>
                      )}

                      {/* Expandable Transcript */}
                      {call.transcript && (
                        <details className="group">
                          <summary className="px-3 py-2 text-xs text-primary cursor-pointer hover:bg-muted/10 font-medium">
                            View Full Transcript
                          </summary>
                          <div className="px-3 py-2 bg-muted/10 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                            {call.transcript}
                          </div>
                        </details>
                      )}

                      {/* Recording link */}
                      {call.recording_url && (
                        <div className="px-3 py-1.5 border-t border-border/20">
                          <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Phone className="w-3 h-3" /> Play Recording
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Activity Log — Premium Timeline */}
            {(() => {
              const mergedActivity = [
                ...activityLog,
                ...callHistory.map(c => ({
                  id: `call-${c.id}`,
                  action: `AI Call: ${c.outcome?.replace(/_/g, ' ') || c.status}`,
                  old_value: null,
                  new_value: c.summary || `${Math.round((c.duration_seconds || 0) / 60)}m call`,
                  performed_by: 'Voice AI',
                  created_at: c.created_at,
                }))
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              return (
                <SectionCard icon={History} title="Activity Log" headerRight={
                  mergedActivity.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-0.5 font-medium">{mergedActivity.length} events</span>
                  ) : undefined
                }>
                  {mergedActivity.length > 0 ? (
                    <div className="relative max-h-64 overflow-y-auto pr-1">
                      {/* Timeline line */}
                      <div className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-primary/20 via-border/40 to-transparent rounded-full" />
                      <div className="space-y-0">
                        {mergedActivity.map((log, idx) => (
                          <div key={log.id} className="relative flex items-start gap-4 py-3 group/timeline">
                            {/* Timeline dot */}
                            <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                              idx === 0
                                ? "bg-primary/15 border-2 border-primary shadow-[0_0_8px_rgba(var(--primary),0.15)]"
                                : "bg-muted/60 border border-border/60 group-hover/timeline:border-primary/30 group-hover/timeline:bg-primary/5"
                            }`}>
                              <Clock className={`w-3 h-3 ${idx === 0 ? "text-primary" : "text-muted-foreground/60 group-hover/timeline:text-primary/60"} transition-colors`} />
                            </div>
                            <div className="flex-1 min-w-0 -mt-0.5">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className={`font-semibold text-sm ${idx === 0 ? "text-card-foreground" : "text-card-foreground/80"}`}>{log.action}</span>
                                {log.old_value && log.new_value && (
                                  <span className="text-xs text-muted-foreground">
                                    <span className="line-through opacity-60">{log.old_value}</span>
                                    <span className="mx-1 text-primary">→</span>
                                    <span className="font-medium text-card-foreground/80">{log.new_value}</span>
                                  </span>
                                )}
                                {!log.old_value && log.new_value && (
                                  <span className="text-xs text-muted-foreground font-medium">{log.new_value}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/70">
                                {log.performed_by && (
                                  <span className="inline-flex items-center gap-1 capitalize bg-muted/40 rounded-md px-1.5 py-0.5">
                                    <Users className="w-2.5 h-2.5" />
                                    {log.performed_by.replace(/_/g, " ")}
                                  </span>
                                )}
                                <span>{new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-2">
                        <History className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                    </div>
                  )}
                </SectionCard>
              );
            })()}

              </div>
            </details>
            {/* ── END Research & Automation collapsible ── */}
          </div>
          {/* ── END RIGHT COLUMN ── */}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ── V2 — Three-column redesign matching approved design ──
// RefreshedSheet above is kept as V1 dead code for rollback.
const SubmissionDetailSheetV2 = ({
  selected,
  onClose,
  photos,
  docs,
  activityLog,
  duplicateWarnings,
  optOutStatus,
  selectedApptTime,
  selectedApptLocation,
  dealerLocations,
  canSetPrice,
  canApprove,
  canDelete,
  canUpdateStatus,
  auditLabel,
  userName,
  onUpdate,
  onDelete,
  onRefresh,
  onScheduleAppointment,
  onDeletePhoto,
  onDeleteDoc,
  fetchActivityLog,
  fetchSubmissions,
}: SubmissionDetailSheetProps) => {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const routerNavigate = useNavigate();
  const [editState, setEditState] = useState<Submission | null>(null);
  const [callHistory, setCallHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!selected?.id) { setCallHistory([]); return; }
    let cancelled = false;
    (async () => {
      const { data: calls } = await (supabase as any)
        .from("voice_call_log")
        .select("id, status, outcome, duration_seconds, transcript, summary, recording_url, customer_name, created_at, attempt_number")
        .eq("submission_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled && calls) setCallHistory(calls);
    })();
    return () => { cancelled = true; };
  }, [selected?.id]);

  const sub = editState?.id === selected?.id ? editState : selected;

  const updateField = (updates: Partial<Submission>) => {
    if (!sub) return;
    setEditState({ ...sub, ...updates });
  };

  const getDocsUrl = (token: string) => `${window.location.origin}/docs/${token}`;

  const getLocationLabel = (loc: string | null) => {
    if (!loc) return null;
    const found = dealerLocations.find(l => l.id === loc || l.name.toLowerCase().replace(/\s+/g, "_") === loc);
    if (found) return `${found.name} — ${found.city}, ${found.state}`;
    return loc;
  };

  const handlePrint = () => {
    if (!sub) return;
    const stages = getProgressStages(sub);
    printSubmissionDetail(sub, photos, docs, stages, getStageIndex, getDocsUrl(sub.token), DOC_TYPE_LABELS);
  };

  const handleSave = async () => {
    if (!sub) return;
    const { error } = await supabase.from("submissions").update({
      progress_status: sub.progress_status,
      offered_price: sub.offered_price,
      acv_value: sub.acv_value,
      check_request_done: sub.check_request_done,
      internal_notes: sub.internal_notes,
      name: sub.name,
      phone: sub.phone,
      email: sub.email,
      zip: sub.zip,
      address_street: sub.address_street,
      address_city: sub.address_city,
      address_state: sub.address_state,
      store_location_id: sub.store_location_id || null,
      status_updated_at: new Date().toISOString(),
      loan_payoff_amount: (sub as any).loan_payoff_amount ?? null,
      loan_payoff_verified: (sub as any).loan_payoff_verified ?? false,
      loan_payoff_updated_at: (sub as any).loan_payoff_updated_at ?? null,
      estimated_equity: (sub as any).estimated_equity ?? null,
    } as any).eq("id", sub.id);

    if (!error) {
      if (selected && selected.progress_status !== sub.progress_status) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id, action: "Status Changed",
          old_value: getStatusLabel(selected.progress_status),
          new_value: getStatusLabel(sub.progress_status),
          performed_by: auditLabel,
        });
      }
      if (selected && selected.offered_price !== sub.offered_price) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id, action: "Price Updated",
          old_value: selected.offered_price ? `$${selected.offered_price.toLocaleString()}` : "None",
          new_value: sub.offered_price ? `$${sub.offered_price.toLocaleString()}` : "None",
          performed_by: auditLabel,
        });
      }
      const ctx = { from: "SubmissionDetailSheetV2.save", submission_id: sub.id } as const;
      if (selected) {
        if (!selected.offered_price && sub.offered_price)
          safeInvoke("send-notification", { body: { trigger_key: "customer_offer_ready", submission_id: sub.id }, context: ctx });
        if (selected.progress_status !== "purchase_complete" && sub.progress_status === "purchase_complete") {
          safeInvoke("send-notification", { body: { trigger_key: "staff_deal_completed", submission_id: sub.id }, context: ctx });
          safeInvoke("send-notification", { body: { trigger_key: "customer_purchase_complete", submission_id: sub.id }, context: ctx });
        }
        if (selected.progress_status !== sub.progress_status)
          safeInvoke("send-notification", { body: { trigger_key: "status_change", submission_id: sub.id }, context: ctx });
      }
      const { data: refreshed } = await supabase.from("submissions").select("*").eq("id", sub.id).maybeSingle();
      if (refreshed) { setEditState(refreshed as any); onUpdate(refreshed as any); }
      fetchActivityLog(sub.id);
      toast({ title: "Record updated", description: "All changes have been saved." });
    } else {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  };

  // Next Action logic — tells BDC/sales exactly what to do based on status
  const getNextAction = (status: string) => {
    switch (status) {
      case "new_lead":        return { label: "Call now — just submitted", icon: Phone, color: "from-blue-600 to-blue-500", action: "call" };
      case "in_progress":    return { label: "Schedule an inspection", icon: CalendarDays, color: "from-emerald-600 to-emerald-500", action: "schedule" };
      case "appointment_set": return { label: "Inspection scheduled — prepare", icon: CheckCircle2, color: "from-emerald-600 to-emerald-500", action: "view" };
      case "inspection_completed":
      case "manager_approval_inspection": return { label: "Build the offer — inspection done", icon: DollarSign, color: "from-[#003b80] to-[#005bb5]", action: "appraise" };
      case "deal_finalized": return { label: "Complete the check request", icon: ClipboardCheck, color: "from-amber-600 to-amber-500", action: "checkreq" };
      case "check_request_submitted": return { label: "Awaiting final approval", icon: Clock, color: "from-slate-600 to-slate-500", action: "none" };
      case "purchase_complete": return { label: "Deal closed! Request a review", icon: Star, color: "from-emerald-600 to-emerald-500", action: "review" };
      case "dead_lead":      return { label: "Lead is closed", icon: XCircle, color: "from-slate-500 to-slate-400", action: "none" };
      default:               return { label: "Follow up with the customer", icon: Bell, color: "from-[#003b80] to-[#005bb5]", action: "followup" };
    }
  };

  const [photoIdx, setPhotoIdx] = useState(0);

  if (!sub) return null;

  const currentStageIdx = getStageIndex(sub.progress_status);
  const stages = getProgressStages(sub);
  const isPriceAgreedOrBeyond = sub.progress_status !== "dead_lead" && currentStageIdx >= getStageIndex("deal_finalized") && sub.offered_price;
  const nextAction = getNextAction(sub.progress_status);

  // Intent label from lead_source
  const intentLabel = (() => {
    switch (sub.lead_source) {
      case "trade": case "in_store_trade": return { label: "Trade-In", sub: "Buying another car here" };
      case "service": return { label: "Service Drive", sub: "Brought in for service" };
      case "inventory": return { label: "Sell", sub: "Looking to sell their vehicle" };
      default: return { label: "Sell", sub: "Looking to sell their vehicle" };
    }
  })();

  // Driver's license doc(s) from docs prop
  const dlDocs = docs.filter(d => d.type === "drivers_license" || d.type === "drivers_license_front" || d.type === "drivers_license_back");

  // Next action card details per status
  const naCard = (() => {
    const hasOffer = !!(sub.offered_price || sub.estimated_offer_high);
    switch (sub.progress_status) {
      case "new_lead": return { title: "Call the customer", desc: "They just submitted — first contact is critical.", cta: "Call Now", ctaHref: sub.phone ? `tel:${sub.phone.replace(/\D/g,"")}` : null, ctaAction: null };
      case "in_progress": return { title: "Schedule an inspection", desc: "Customer is engaged. Lock in a time.", cta: "Schedule", ctaHref: null, ctaAction: "schedule" };
      case "appointment_set": return { title: "Prepare for inspection", desc: "Inspection is booked. Review vehicle info.", cta: "View Inspection", ctaHref: null, ctaAction: "inspect" };
      case "inspection_completed": case "manager_approval_inspection": return { title: "Build the offer", desc: "Inspection is done. Set your ACV and offer.", cta: "Open Appraisal", ctaHref: null, ctaAction: "appraise" };
      case "offer_sent": case "deal_finalized": return hasOffer ? { title: "Review Offer", desc: "Customer has an offer. Follow up to close.", cta: "Send Follow-Up", ctaHref: null, ctaAction: "followup" } : { title: "Send the offer", desc: "Build and send the offer to the customer.", cta: "Open Appraisal", ctaHref: null, ctaAction: "appraise" };
      case "check_request_submitted": return { title: "Complete check request", desc: "Price agreed. Generate and submit the check request.", cta: "Generate", ctaHref: null, ctaAction: "checkreq" };
      case "purchase_complete": return { title: "Deal closed!", desc: "Great work. Consider requesting a review.", cta: "Send Review Request", ctaHref: null, ctaAction: "review" };
      case "dead_lead": return { title: "Lead is closed", desc: "This opportunity has been marked as dead.", cta: null, ctaHref: null, ctaAction: null };
      default: return { title: "Follow up", desc: "Stay in touch with the customer.", cta: "Send Follow-Up", ctaHref: null, ctaAction: "followup" };
    }
  })();

  return (
    <Sheet open={!!selected} onOpenChange={() => { setEditState(null); onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-5xl lg:max-w-6xl p-0 flex flex-col overflow-hidden [&>button]:hidden">

        {/* ══ STICKY HEADER ══ */}
        <div className="sticky top-0 z-10 shrink-0 bg-gradient-to-r from-[#003b80] to-[#005bb5] text-white">

          {/* ── Top bar: X + "Customer File" | Notes + Print ── */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditState(null); onClose(); }}
                className="w-7 h-7 rounded-lg border border-white/25 flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white transition-all print:hidden">
                <X className="w-3.5 h-3.5" />
              </button>
              <span className="text-white/70 text-xs font-semibold tracking-wide">Customer File</span>
            </div>
            <div className="flex items-center gap-1.5 print:hidden">
              <button onClick={() => {}}
                className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-white/25 text-white/80 hover:bg-white/15 hover:text-white text-[11px] font-semibold transition-all">
                <StickyNote className="w-3 h-3" /> Notes
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-white/25 text-white/80 hover:bg-white/15 hover:text-white text-[11px] font-semibold transition-all">
                <Printer className="w-3 h-3" /> Print
              </button>
            </div>
          </div>

          {/* ── Vehicle info (left) + Offer (right) ── */}
          <div className="flex items-start justify-between px-5 pt-3 pb-4 gap-6">

            {/* Left: year/mi · make/model · VIN box · plate/color · 3 badges */}
            <div className="flex-1 min-w-0">

              {/* Year — Mileage */}
              <div className="text-[11px] font-semibold text-white/55 uppercase tracking-[0.12em] mb-1">
                {[sub.vehicle_year, sub.mileage ? `${Number(sub.mileage).toLocaleString()} MI` : null].filter(Boolean).join("  ·  ")}
              </div>

              {/* Make / Model (large bold) */}
              <SheetTitle className="text-[22px] font-display font-bold leading-tight text-white mb-2">
                {[sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "Submission Details"}
              </SheetTitle>

              {/* VIN box · Plate · Color */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {sub.vin && (
                  <span className="font-mono text-[10px] bg-white/15 border border-white/20 rounded-md px-2 py-0.5 text-white tracking-widest whitespace-nowrap">
                    {sub.vin}
                  </span>
                )}
                {sub.plate && (
                  <span className="text-[11px] text-white/75 font-medium">
                    Plate · {[sub.address_state, sub.plate].filter(Boolean).join(" ")}
                  </span>
                )}
                {sub.exterior_color && (
                  <span className="text-[11px] text-white/50">· {sub.exterior_color}</span>
                )}
              </div>

              {/* Three rounded indicator badges: Offer status · Intent · Lead quality */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Offer status */}
                {sub.offered_price ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-emerald-400/20 text-emerald-100 border border-emerald-300/40 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" /> Offer Sent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-white/10 text-white/60 border border-white/20 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" /> No Offer
                  </span>
                )}

                {/* Intent: Trade-In / Sell / Not Sure */}
                {(sub.lead_source === "trade" || sub.lead_source === "in_store_trade") ? (
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-sky-400/20 text-sky-100 border border-sky-300/35 whitespace-nowrap">Trade-In</span>
                ) : sub.lead_source ? (
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-white/10 text-white/70 border border-white/25 whitespace-nowrap">Sell</span>
                ) : (
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-white/10 text-white/50 border border-white/20 whitespace-nowrap">Not Sure</span>
                )}

                {/* Lead quality */}
                {sub.is_hot_lead ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-orange-400/25 text-orange-100 border border-orange-300/50 whitespace-nowrap">🔥 Hot Lead</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-sky-400/15 text-sky-100 border border-sky-300/30 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-300 shrink-0" /> Warm Lead
                  </span>
                )}
              </div>
            </div>

            {/* Right: Offer amount + ACV + spread + submitted */}
            <div className="text-right shrink-0 min-w-[160px]">
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/50 font-semibold mb-0.5">
                {sub.offered_price ? "OFFER GIVEN" : sub.estimated_offer_high ? "ESTIMATED" : "NO OFFER YET"}
              </div>
              {(sub.offered_price || sub.estimated_offer_high) ? (
                <>
                  <div className="font-display text-[36px] leading-none font-bold">
                    ${Math.floor(sub.offered_price || sub.estimated_offer_high || 0).toLocaleString()}
                  </div>
                  {sub.acv_value != null && (
                    <div className="text-[11px] text-white/60 mt-1.5">
                      ACV ${Number(sub.acv_value).toLocaleString()}
                      {sub.offered_price != null && (
                        <span className={`ml-2 font-bold ${sub.offered_price >= sub.acv_value ? "text-emerald-300" : "text-red-300"}`}>
                          {sub.offered_price >= sub.acv_value ? "+" : ""}${Math.floor(sub.offered_price - sub.acv_value).toLocaleString()} spread
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[15px] font-semibold text-white/40 mt-1">—</div>
              )}
              <div className="text-[10px] text-white/35 mt-3">
                Submitted {new Date(sub.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Arrived / On-the-way banners */}
          {(sub as any).arrived_at && sub.progress_status === "arrived" && (
            <div className="bg-red-600 px-5 py-2.5 flex items-center gap-3 border-t border-red-900/30">
              <span className="relative flex shrink-0"><span className="absolute inline-flex h-3 w-3 rounded-full bg-white/60 animate-ping" /><span className="relative inline-flex h-3 w-3 rounded-full bg-white" /></span>
              <span className="text-sm font-semibold text-white">Customer Arrived · {new Date((sub as any).arrived_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — Go greet them now</span>
            </div>
          )}
          {(sub as any).on_the_way_at && sub.progress_status === "on_the_way" && (
            <div className="bg-amber-600 px-5 py-2.5 flex items-center gap-3 border-t border-amber-900/30">
              <span className="relative flex shrink-0"><span className="absolute inline-flex h-3 w-3 rounded-full bg-white/60 animate-ping" /><span className="relative inline-flex h-3 w-3 rounded-full bg-white" /></span>
              <span className="text-sm font-semibold text-white">Customer On The Way · {new Date((sub as any).on_the_way_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — Prepare</span>
            </div>
          )}
        </div>
        {/* ══ END HEADER ══ */}

        {/* ══ TWO-COLUMN BODY ══ */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 bg-[#f4f6f9]">

          {/* ── LEFT PANEL (flex-1, ~65%) ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">

            {/* Alerts */}
            {(duplicateWarnings[sub.id]?.length > 0 || optOutStatus.email || optOutStatus.sms) && (
              <div className="space-y-2">
                {duplicateWarnings[sub.id]?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-700">Possible Duplicate</p>
                      {duplicateWarnings[sub.id].map((w, i) => <p key={i} className="text-[11px] text-red-600/80 mt-0.5">{w}</p>)}
                    </div>
                  </div>
                )}
                {(optOutStatus.email || optOutStatus.sms) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                    <Bell className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700">Customer Unsubscribed</p>
                      <div className="flex gap-1.5 mt-1">
                        {optOutStatus.email && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700"><Mail className="w-3 h-3 mr-1" />Email</Badge>}
                        {optOutStatus.sms && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700"><Phone className="w-3 h-3 mr-1" />SMS</Badge>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TOP ROW: Photos carousel (left) + ID/Intent (right) ── */}
            <div className="flex gap-3 items-stretch">

              {/* Vehicle Photos — Carousel */}
              <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden min-w-0">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vehicle Photos</h3>
                  {photos.length > 0 && <span className="text-[10px] font-semibold text-slate-400">{photos.length} photos</span>}
                </div>
                <div className="p-3">
                  {photos.length > 0 ? (
                    <div>
                      <div className="relative rounded-lg overflow-hidden bg-slate-100 mb-2 group" style={{ aspectRatio: "4/3" }}>
                        <a href={photos[photoIdx]?.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                          <img src={photos[photoIdx]?.url} alt={`Photo ${photoIdx + 1}`} className="w-full h-full object-cover" />
                        </a>
                        {photos.length > 1 && (
                          <>
                            <button onClick={(e) => { e.preventDefault(); setPhotoIdx(i => (i - 1 + photos.length) % photos.length); }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all z-10">
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.preventDefault(); setPhotoIdx(i => (i + 1) % photos.length); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-all z-10">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
                              {photoIdx + 1} / {photos.length}
                            </div>
                          </>
                        )}
                        {canDelete && (
                          <button onClick={() => onDeletePhoto(photos[photoIdx].name)}
                            className="absolute top-2 left-2 bg-destructive/90 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {photos.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {photos.map((photo, i) => (
                            <button key={i} onClick={() => setPhotoIdx(i)}
                              className={`flex-shrink-0 w-12 h-9 rounded-md overflow-hidden border-2 transition-all ${i === photoIdx ? "border-[#003b80]" : "border-transparent opacity-50 hover:opacity-100 hover:border-slate-300"}`}>
                              <img src={photo.url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                      <Camera className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No photos yet</p>
                    </div>
                  )}
                  <div className="mt-2">
                    <StaffFileUpload token={sub.token} bucket="submission-photos" onUploadComplete={() => onRefresh(sub)} />
                  </div>
                </div>
              </div>

              {/* ID + Intent stacked */}
              <div className="w-[44%] flex flex-col gap-3 shrink-0">

                {/* ID / Driver's License */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">ID</h3>
                  </div>
                  <div className="p-3">
                    {dlDocs.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <a href={dlDocs[0].url} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 w-16 h-11 rounded-md overflow-hidden border border-slate-200 bg-slate-100 hover:opacity-80 transition-opacity">
                          {/\.(jpg|jpeg|png|gif|webp)$/i.test(dlDocs[0].name)
                            ? <img src={dlDocs[0].url} alt="DL" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><FileText className="w-5 h-5 text-slate-300" /></div>
                          }
                        </a>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Driver's License</p>
                          <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> Verified on file
                          </p>
                        </div>
                        <a href={dlDocs[0].url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] font-bold text-[#003b80] hover:underline shrink-0">View</a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 py-1">
                        <FileText className="w-7 h-7 shrink-0 text-slate-300" />
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500">No ID on file</p>
                          <p className="text-[10px] text-slate-400">Customer uploads via QR link</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Intent */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-1">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Intent</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-[22px] font-bold text-slate-900 mb-0.5 leading-tight">{intentLabel.label}</p>
                    <p className="text-xs text-slate-500">{intentLabel.sub}</p>
                  </div>
                </div>

              </div>
            </div>
            {/* ── END TOP ROW ── */}

            {/* ── CUSTOMER + VEHICLE ROW ── */}
            <div className="grid grid-cols-2 gap-3">

              {/* Customer */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Customer</h3>
                </div>
                <div className="p-4 space-y-2.5">
                  {sub.name && (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-slate-400 shrink-0">Name</span>
                      <span className="text-sm font-semibold text-slate-900 text-right">{sub.name}</span>
                    </div>
                  )}
                  {sub.phone && (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-slate-400 shrink-0">Phone</span>
                      <a href={`tel:${sub.phone}`} className="text-sm font-semibold text-[#003b80] hover:underline">{sub.phone}</a>
                    </div>
                  )}
                  {sub.email && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-slate-400 shrink-0">Email</span>
                      <a href={`mailto:${sub.email}`} className="text-xs font-semibold text-[#003b80] hover:underline text-right break-all">{sub.email}</a>
                    </div>
                  )}
                  {(sub.address_street || sub.address_city) && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-slate-400 shrink-0">Address</span>
                      <span className="text-xs font-semibold text-slate-900 text-right leading-relaxed">
                        {sub.address_street && <span className="block">{sub.address_street}</span>}
                        {[sub.address_city, sub.address_state, sub.zip].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vehicle</h3>
                </div>
                <div className="p-4 space-y-2.5">
                  {[
                    { label: "Year", value: sub.vehicle_year?.toString() || null },
                    { label: "Make / Model", value: [sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || null },
                    { label: "VIN", value: sub.vin || null, mono: true },
                    { label: "Plate", value: [sub.address_state, sub.plate].filter(Boolean).join(" ") || null },
                    { label: "Mileage", value: sub.mileage ? `${Number(sub.mileage).toLocaleString()} mi` : null },
                    { label: "Color", value: sub.exterior_color || null },
                    { label: "Drivable", value: sub.drivable || null },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-slate-400 shrink-0">{row.label}</span>
                      <span className={`text-sm font-semibold text-slate-900 text-right min-w-0 break-words [overflow-wrap:anywhere] ${(row as any).mono ? "font-mono text-xs" : ""}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ── INSPECTION SUMMARY ── */}
            {sub.id && (() => {
              const inspDone = ['inspection_completed','appraisal_completed','manager_approval','price_agreed','title_verified','ownership_verified','purchase_complete'].includes(sub.progress_status);
              return (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Inspection Summary</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${inspDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {inspDone ? "Completed" : "Pending"}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <InspectionVitals submissionId={sub.id} />
                    <CompactOBDIndicator submissionId={sub.id} token={sub.token} />
                    <div className="flex items-center gap-4 pt-1">
                      <button onClick={() => routerNavigate(`/inspection/${sub.id}`)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#003b80] hover:underline">
                        <ClipboardList className="w-3.5 h-3.5" /> View Full Inspection
                      </button>
                      <button onClick={() => routerNavigate(`/appraisal/${sub.token}`)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline">
                        Re-Appraise
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
          {/* ── END LEFT PANEL ── */}

          {/* ── RIGHT PANEL (~35%) — Next Action · Deal · Offer · Loan · Notes · Activity ── */}
          <div className="lg:w-[35%] overflow-y-auto p-4 space-y-3 shrink-0 border-l border-slate-200 bg-white">

            {/* ── NEXT ACTION CARD ── */}
            {(() => {
              const isForManager = ["deal_finalized","check_request_submitted","manager_approval_inspection"].includes(sub.progress_status);
              const bgClass = sub.progress_status === "purchase_complete"
                ? "from-emerald-700 to-emerald-600"
                : sub.progress_status === "dead_lead"
                ? "from-slate-600 to-slate-500"
                : "from-[#1b5e35] to-[#217a42]";
              return (
                <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200">
                  <div className={`bg-gradient-to-br ${bgClass} p-4`}>
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/65">Next Action</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 border ${isForManager ? "bg-amber-400/25 border-amber-300/40 text-amber-100" : "bg-white/15 border-white/25 text-white"}`}>
                        {isForManager ? "For Manager" : "For Sales"}
                      </span>
                    </div>
                    <p className="text-[20px] font-bold text-white leading-tight mb-1">{naCard.title}</p>
                    <p className="text-[12px] text-white/70 leading-relaxed">{naCard.desc}</p>
                    {naCard.cta && (
                      <div className="mt-3">
                        {naCard.ctaHref ? (
                          <a href={naCard.ctaHref}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors">
                            {naCard.cta} ›
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              if (naCard.ctaAction === "schedule") onScheduleAppointment(sub);
                              else if (naCard.ctaAction === "appraise") routerNavigate(`/appraisal/${sub.token}`);
                              else if (naCard.ctaAction === "inspect") routerNavigate(`/inspection/${sub.id}`);
                            }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors">
                            {naCard.cta} ›
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Follow-up row: SMS · Email · AI Call */}
                  {!["dead_lead","purchase_complete"].includes(sub.progress_status) && (
                    <div className="flex border-t border-slate-100 bg-white">
                      {[
                        { label: "SMS", icon: Phone },
                        { label: "Email", icon: Mail },
                        { label: "AI Call", icon: Phone },
                      ].map((item, i, arr) => (
                        <button key={item.label}
                          className={`flex-1 py-2.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors ${i < arr.length - 1 ? "border-r border-slate-100" : ""}`}>
                          <item.icon className="w-3 h-3" /> {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── DEAL STATUS ── */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Deal Status</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Current Step</p>
                  <p className="text-sm font-bold text-slate-900">{getStatusLabel(sub.progress_status)}</p>
                </div>
                {sub.appointment_set && sub.appointment_date && (
                  <div className="rounded-lg bg-[#003b80]/8 border border-[#003b80]/15 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#003b80]/60 mb-0.5">Appointment</p>
                    <p className="text-sm font-bold text-slate-900">
                      {new Date(sub.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {selectedApptTime && <span className="text-[#003b80] ml-1.5">· {selectedApptTime}</span>}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Select value={sub.progress_status}
                    disabled={!canUpdateStatus || (["deal_finalized","check_request_submitted","purchase_complete"].includes(sub.progress_status) && !canApprove)}
                    onValueChange={(val) => {
                      if (["deal_finalized","check_request_submitted","purchase_complete"].includes(val) && !canApprove) {
                        toast({ title: "Not authorized", description: "Only GSM/GM can approve.", variant: "destructive" }); return;
                      }
                      updateField({ progress_status: val });
                    }}>
                    <SelectTrigger className="flex-1 h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_STATUS_OPTIONS.map(s => {
                        const locked = ["deal_finalized","check_request_submitted","purchase_complete"].includes(s.key) && !canApprove;
                        return <SelectItem key={s.key} value={s.key} disabled={locked}>{s.label}{locked ? " (GSM/GM)" : ""}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="h-9 px-3 rounded-lg text-xs font-semibold border-slate-300 text-slate-700 shrink-0"
                    onClick={() => onScheduleAppointment(sub)}>
                    Schedule
                  </Button>
                </div>
              </div>
            </div>

            {/* ── OFFER BREAKDOWN ── */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Offer Breakdown</h3>
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-500">Offer Given</span>
                  {canSetPrice ? (
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">$</span>
                      <Input type="text" inputMode="decimal" placeholder="0"
                        className="h-8 pl-6 text-sm font-bold text-right border-slate-200 rounded-lg"
                        value={sub.offered_price != null ? sub.offered_price.toLocaleString("en-US") : ""}
                        onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); updateField({ offered_price: raw ? Number(raw) : null }); }} />
                    </div>
                  ) : (
                    <span className="text-xl font-bold text-slate-900">{sub.offered_price ? `$${Number(sub.offered_price).toLocaleString()}` : "—"}</span>
                  )}
                </div>
                {sub.acv_value != null && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-slate-500">ACV</span>
                    <span className="text-sm font-semibold text-slate-700">${Number(sub.acv_value).toLocaleString()}</span>
                  </div>
                )}
                {(sub as any).loan_payoff_amount != null && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-slate-500">Loan Payoff</span>
                    <span className="text-sm font-semibold text-red-600">-${Number((sub as any).loan_payoff_amount).toLocaleString()}</span>
                  </div>
                )}
                {(() => {
                  const v = sub.offered_price ?? sub.estimated_offer_high ?? 0;
                  const result = calculateEquity(v, (sub as any).loan_payoff_amount ?? null);
                  if (!v) return null;
                  return (
                    <div className="flex items-baseline justify-between pt-2.5 border-t border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Customer Equity</span>
                      <span className={`text-base font-bold ${result.color}`}>{result.displayText}</span>
                    </div>
                  );
                })()}
                {/* Payoff input */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-500 font-semibold">Verified Payoff</label>
                    <div className="flex items-center gap-1.5">
                      <Checkbox id="rp-payoff-verified" checked={!!(sub as any).loan_payoff_verified}
                        onCheckedChange={(c) => updateField({ loan_payoff_verified: !!c, loan_payoff_updated_at: new Date().toISOString() } as any)} />
                      <label htmlFor="rp-payoff-verified" className="text-[11px] text-slate-500 cursor-pointer">Confirmed</label>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <Input type="number" inputMode="decimal" placeholder="Payoff amount"
                      value={(sub as any).loan_payoff_amount ?? ""}
                      onChange={(e) => {
                        const payoff = e.target.value === "" ? null : Number(e.target.value);
                        const v = sub.offered_price ?? sub.estimated_offer_high ?? 0;
                        updateField({ loan_payoff_amount: payoff, estimated_equity: v > 0 ? v - (payoff ?? 0) : null, loan_payoff_updated_at: new Date().toISOString() } as any);
                      }}
                      className="h-9 pl-7 text-sm rounded-lg border-slate-200" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── LOAN ── */}
            {(sub.loan_status || sub.loan_company || sub.loan_balance) && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Loan</h3>
                </div>
                <div className="p-4 space-y-2.5">
                  {[
                    { label: "Status", value: sub.loan_status },
                    { label: "Lender", value: sub.loan_company },
                    { label: "Balance", value: sub.loan_balance ? `$${Number(sub.loan_balance).toLocaleString()}` : null },
                    { label: "Verified Payoff", value: (sub as any).loan_payoff_amount ? `$${Number((sub as any).loan_payoff_amount).toLocaleString()}` : null },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-slate-500 shrink-0">{row.label}</span>
                      <span className="text-sm font-semibold text-slate-900 text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── NOTES ── */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Notes</h3>
              </div>
              <div className="p-4">
                <Textarea placeholder="Add team notes, observations, or follow-up reminders..."
                  value={(sub.internal_notes || "").replace(/\[INSPECTION[\s\S]*?\](\s*\n)?/g, "").trim()}
                  onChange={(e) => updateField({ internal_notes: e.target.value || null })}
                  rows={3} className="rounded-lg border-slate-200 focus:border-[#003b80]/40 resize-none text-sm text-slate-700" />
              </div>
            </div>

            {/* ── FOLLOW-UP SEQUENCE ── */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Follow-up Sequence
                </h3>
              </div>
              <div className="p-4">
                <FollowUpPanel submissionId={sub.id} hasOffer={!!(sub.offered_price || sub.estimated_offer_high)} progressStatus={sub.progress_status} />
              </div>
            </div>

            {/* ── ACTIVITY LOG ── */}
            {(() => {
              const mergedActivity = [
                ...activityLog,
                ...callHistory.map(c => ({
                  id: `call-${c.id}`, action: `AI Call: ${c.outcome?.replace(/_/g, ' ') || c.status}`,
                  old_value: null, new_value: c.summary || `${Math.round((c.duration_seconds || 0) / 60)}m call`,
                  performed_by: 'Voice AI', created_at: c.created_at,
                }))
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              if (mergedActivity.length === 0) return null;
              return (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> Activity
                    </h3>
                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{mergedActivity.length}</span>
                  </div>
                  <div className="p-4 max-h-48 overflow-y-auto space-y-3">
                    {mergedActivity.map((log, idx) => (
                      <div key={log.id} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${idx === 0 ? "bg-[#003b80]/15 border-2 border-[#003b80]" : "bg-slate-100 border border-slate-200"}`}>
                          <Clock className={`w-2.5 h-2.5 ${idx === 0 ? "text-[#003b80]" : "text-slate-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800">{log.action}</p>
                          {log.new_value && <p className="text-[11px] text-slate-500 mt-0.5">{log.new_value}</p>}
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            {log.performed_by && ` · ${log.performed_by}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── SAVE / DELETE ── sticky footer */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm pt-3 pb-3 border-t border-slate-200 flex gap-2 -mx-4 px-4 -mb-4">
              <Button className="flex-1 h-10 rounded-lg font-semibold text-sm bg-[#003b80] hover:bg-[#002a5c] text-white"
                disabled={sub.progress_status === "inspection_completed" && !sub.acv_value}
                onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" /> Update Record
              </Button>
              {canDelete && (
                <Button variant="destructive" className="h-10 px-4 rounded-lg font-semibold text-sm" onClick={() => onDelete(sub.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

          </div>
          {/* ── END RIGHT COLUMN ── */}

        </div>
        {/* ── END TWO-COLUMN BODY ── */}

      </SheetContent>
    </Sheet>
  );
};

export default function SubmissionDetailSheet(props: SubmissionDetailSheetProps) {
  return <SubmissionDetailSheetV2 {...props} />;
}
