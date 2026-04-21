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
import EscalateToManagerDialog, { ESCALATION_REASONS } from "@/components/admin/EscalateToManagerDialog";
import DeclinedReasonDialog, { DECLINED_REASONS } from "@/components/admin/DeclinedReasonDialog";
import SaveTheDealDialog from "@/components/admin/SaveTheDealDialog";
import ConversationThread from "@/components/admin/ConversationThread";
import { isBDCRole, isSalesFloorRole, isManagerRole, canWorkLeads, isInternetManagerRole } from "@/lib/adminConstants";
import { useTenant } from "@/contexts/TenantContext";
import {
  X, Printer, Users, Car, Search, DollarSign, Info, FileText, Gauge, Palette, BarChart3, ScanLine,
  Settings2, Wrench, Key, Wind, Cigarette, CircleDot, Sparkles, TrendingUp,
  AlertTriangle, Bell, Mail, Phone, StickyNote, CalendarDays, Camera,
  ExternalLink, Upload, Check, XCircle, MapPin, Star, History, Clock,
  ClipboardCheck, ClipboardList, Save, Trash2, CheckCircle2, Activity, ChevronDown, UserCheck, MessageSquare,
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
  /**
   * Read-only pricing visibility. Sales-floor roles get this true even
   * when canSetPrice is false — they can see book values and ACV so
   * they can quote customers, but every edit control stays gated by
   * canSetPrice.
   */
  canViewPricing?: boolean;
  /**
   * True for sales_bdc / sales. Used to hide margin math (profit
   * spread, retail market comps, activity log, AI call transcripts)
   * that internal-operations-level users need but the sales floor
   * does not.
   */
  isSalesFloor?: boolean;
  /**
   * Current user role + email. Needed so BDC-specific affordances
   * (Escalate to Manager, Log Declined Reason) can write audit trail
   * entries attributed to the actor.
   */
  userRole?: string;
  userEmail?: string;
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

// ── Section Card wrapper — premium glass design ──
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
  const accentBorder = accent === "success" ? "border-l-success" : accent === "warning" ? "border-l-amber-500" : accent === "destructive" ? "border-l-destructive" : "border-l-primary/40";
  return (
    <div data-print-section className={`group/card rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.05)] transition-all duration-300 overflow-hidden border-l-[3px] ${accentBorder} ${className}`}>
      <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-5 py-3 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-foreground/80 uppercase tracking-[0.12em] flex items-center gap-2">
          {Icon && (
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 group-hover/card:bg-primary/15 transition-colors">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </span>
          )}
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
    // items-start (not center) so multi-line values don't visually stack on the
    // label. gap-3 enforces a minimum horizontal gutter, shrink-0 stops the
    // label from compressing, min-w-0 + break-words lets long values wrap
    // cleanly, break-all handles unbroken tokens like VINs.
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0 group/row hover:bg-muted/30 -mx-1 px-1 rounded-md transition-colors">
      <span className="text-sm text-muted-foreground flex items-center gap-2 shrink-0">
        {icon && <span className="text-muted-foreground/50 group-hover/row:text-primary/60 transition-colors">{icon}</span>}
        {label}
      </span>
      <span className="text-sm font-semibold text-card-foreground text-right max-w-[65%] min-w-0 break-words [overflow-wrap:anywhere]">{value}</span>
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
    dealership_id: string | null;
  } | null>(null);
  const [inputMode, setInputMode] = useState<"measurement" | "pass_fail">("measurement");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("submissions")
        .select("tire_lf, tire_rf, tire_lr, tire_rr, brake_lf, brake_rf, brake_lr, brake_rr, dealership_id")
        .eq("id", submissionId)
        .maybeSingle();
      // Pull the dealer's tire/brake input preference so we interpret
      // the stored values correctly — 0/1 are pass/fail flags under
      // pass_fail mode, not tread depths.
      let mode: "measurement" | "pass_fail" = "measurement";
      const dealership = (row as any)?.dealership_id;
      if (dealership) {
        const { data: cfg } = await supabase
          .from("inspection_config")
          .select("tire_brake_input_mode")
          .eq("dealership_id", dealership)
          .maybeSingle();
        if ((cfg as any)?.tire_brake_input_mode === "pass_fail") mode = "pass_fail";
      }
      if (!cancelled) {
        setData((row as any) ?? null);
        setInputMode(mode);
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
    if (inputMode === "pass_fail") {
      // 1 = pass (green), 0 = fail (red). No middle band in pass/fail.
      return v === 1 ? "green" : "red";
    }
    if (v >= 6) return "green";
    if (v >= 3) return "yellow";
    return "red";
  };

  const labelFor = (s: State): string => {
    if (s === "empty") return "Not recorded";
    if (inputMode === "pass_fail") return s === "green" ? "Pass" : "Fail";
    return s === "green" ? "Good" : s === "yellow" ? "Fair" : "Replace";
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
            {labelFor(s)}
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
        From the inspection — {inputMode === "pass_fail" ? "Green pass, Red fail." : "Green good, Amber fair, Red replace."}
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

// ── BDCActionStrip ────────────────────────────────────────────────────
// BDC / sales affordances for the top of the customer file.
//
// - Escalation banner: shown to everyone when the lead is escalated.
//   Managers see a "Resolve" button; BDC/sales just see the status.
// - Declined-reason banner: shown to everyone when a reason was logged;
//   sales floor can open the dialog to update it.
// - Action row: BDC / sales get Escalate-to-Manager + Log-Declined-Reason
//   + Book-Inspection buttons. Managers don't need these in their own
//   view — they act on escalations via the queue.
const BDCActionStrip = ({
  sub,
  userRole,
  userEmail,
  isSalesFloor,
  auditLabel,
  onRefresh,
}: {
  sub: any;
  userRole?: string;
  userEmail?: string;
  isSalesFloor: boolean;
  auditLabel?: string;
  onRefresh: () => void;
}) => {
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [saveDealOpen, setSaveDealOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const { toast } = useToast();

  const isManager = isManagerRole(userRole);
  const isSalesOrBDC = isSalesFloorRole(userRole);
  const isBDC = isBDCRole(userRole);
  const isIM = isInternetManagerRole(userRole);
  // Lead-workers = sales floor + internet_manager. This is the tier
  // that actively touches leads — escalating, capturing decline
  // reasons, booking inspections, flipping to appraiser.
  const isLeadWorker = canWorkLeads(userRole);

  const escalated = !!sub.escalated_to_manager;
  const declinedReasonLabel = sub.declined_reason
    ? DECLINED_REASONS.find((r) => r.value === sub.declined_reason)?.label || sub.declined_reason
    : null;
  const escalationReasonLabel = sub.escalation_reason
    ? ESCALATION_REASONS.find((r) => r.value === sub.escalation_reason)?.label || sub.escalation_reason
    : null;

  // Lead looks "declined" when the pipeline status says so — keep this
  // list in sync with the canonical status set. The action button
  // surfaces whenever a reason hasn't been captured yet.
  const declinedLike = ["offer_declined", "lost", "unreachable"].includes(
    sub.progress_status || ""
  );
  const needsDeclinedReason = declinedLike && !sub.declined_reason;

  const noAppointmentYet = !sub.appointment_set;

  const handleResolveEscalation = async () => {
    setResolving(true);
    const { error } = await supabase
      .from("submissions")
      .update({
        escalated_to_manager: false,
        escalation_resolved_at: new Date().toISOString(),
        escalation_resolved_by: userEmail || null,
      } as any)
      .eq("id", sub.id);
    setResolving(false);
    if (error) {
      toast({ title: "Could not resolve", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("activity_log").insert({
      submission_id: sub.id,
      action: "Escalation Resolved",
      old_value: null,
      new_value: null,
      performed_by: userEmail || "unknown",
    } as any);
    toast({ title: "Escalation resolved", description: "Marked as handled." });
    onRefresh();
  };

  // Internet managers share the BDC action affordances per user
  // direction — they still work leads hands-on and escalate just like
  // a BDC rep does, they just have team-level visibility on top.
  const showActionRow = isLeadWorker && !escalated;
  const somethingToShow = escalated || declinedReasonLabel || showActionRow;
  if (!somethingToShow) return null;

  return (
    <div className="space-y-3">
      {/* Escalation active */}
      {escalated && (
        <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-0.5">
              Escalated to manager
            </p>
            <p className="text-sm font-semibold text-foreground">
              {escalationReasonLabel || "Needs manager attention"}
            </p>
            {sub.escalation_notes && (
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub.escalation_notes}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5">
              by {sub.escalation_created_by || "unknown"} · {sub.escalation_created_at ? new Date(sub.escalation_created_at).toLocaleString() : ""}
            </p>
          </div>
          {isManager && (
            <Button
              size="sm"
              onClick={handleResolveEscalation}
              disabled={resolving}
              className="shrink-0"
            >
              {resolving ? "…" : "Resolve"}
            </Button>
          )}
        </div>
      )}

      {/* Declined reason logged */}
      {declinedReasonLabel && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <XCircle className="w-3.5 h-3.5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-0.5">
              Customer declined
            </p>
            <p className="text-sm font-semibold text-foreground">{declinedReasonLabel}</p>
            {sub.declined_notes && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub.declined_notes}</p>
            )}
            {(sub.customer_walk_away_number || sub.competitor_mentioned) && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {sub.customer_walk_away_number && (
                  <span className="inline-flex items-center text-[10px] font-semibold text-card-foreground bg-background border border-border/60 px-2 py-0.5 rounded-full">
                    Wants: ${Number(sub.customer_walk_away_number).toLocaleString()}
                  </span>
                )}
                {sub.competitor_mentioned && (
                  <span className="inline-flex items-center text-[10px] font-semibold text-card-foreground bg-background border border-border/60 px-2 py-0.5 rounded-full">
                    {sub.competitor_mentioned}
                    {sub.competitor_offer_amount
                      ? `: $${Number(sub.competitor_offer_amount).toLocaleString()}`
                      : ""}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {isManager && (
              <Button
                size="sm"
                onClick={() => setSaveDealOpen(true)}
                className="h-7 text-[11px] bg-success hover:bg-success/90 text-success-foreground"
              >
                Save the Deal
              </Button>
            )}
            {(isSalesOrBDC || isManager) && (
              <Button variant="outline" size="sm" onClick={() => setDeclineOpen(true)} className="h-7 text-[11px]">
                Edit reason
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Action row — BDC / sales / internet manager */}
      {showActionRow && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">
            {isBDC ? "BDC actions" : isIM ? "Internet mgr actions" : "Sales actions"}
          </span>
          {noAppointmentYet && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Scrolls to the appointment section — actual
                // scheduling logic lives there already.
                const el = document.getElementById("appointment-section");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="h-7 text-[11px]"
            >
              <CalendarDays className="w-3 h-3 mr-1" /> Book Inspection
            </Button>
          )}
          {(needsDeclinedReason || !sub.declined_reason) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeclineOpen(true)}
              className={`h-7 text-[11px] ${needsDeclinedReason ? "border-destructive/60 text-destructive" : ""}`}
            >
              <XCircle className="w-3 h-3 mr-1" />
              {needsDeclinedReason ? "Log Declined Reason" : "Log Declined Reason"}
            </Button>
          )}
          {/* Direct to appraiser — shortcut for "this needs an
               appraisal value today, skip the manager bounce". Flips
               needs_appraisal=true which lights up the Appraiser
               Queue. Separate from Escalate-to-Manager which is for
               cross-cutting issues the manager has to decide. */}
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { error } = await supabase
                .from("submissions")
                .update({ needs_appraisal: true } as any)
                .eq("id", sub.id);
              if (error) {
                toast({ title: "Could not send", description: error.message, variant: "destructive" });
                return;
              }
              await supabase.from("activity_log").insert({
                submission_id: sub.id,
                action: "Sent to Appraiser",
                old_value: null,
                new_value: `by ${userEmail || "lead worker"}`,
                performed_by: userEmail || "unknown",
              } as any);
              toast({ title: "Sent to Appraiser", description: "Lead is on the appraiser queue." });
              onRefresh();
            }}
            className="h-7 text-[11px] border-primary/60 text-primary ml-auto"
          >
            <UserCheck className="w-3 h-3 mr-1" /> Send to Appraiser
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEscalateOpen(true)}
            className="h-7 text-[11px] border-amber-500/60 text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle className="w-3 h-3 mr-1" /> Escalate to Manager
          </Button>
        </div>
      )}

      <EscalateToManagerDialog
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        submissionId={sub.id}
        userEmail={userEmail}
        onEscalated={onRefresh}
      />
      <DeclinedReasonDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        submissionId={sub.id}
        userEmail={userEmail}
        initialReason={sub.declined_reason}
        initialNotes={sub.declined_notes}
        initialWalkAway={sub.customer_walk_away_number}
        initialCompetitor={sub.competitor_mentioned}
        initialCompetitorAmount={sub.competitor_offer_amount}
        onSaved={onRefresh}
      />
      <SaveTheDealDialog
        open={saveDealOpen}
        onOpenChange={setSaveDealOpen}
        submissionId={sub.id}
        currentOffer={sub.offered_price ?? sub.estimated_offer_high ?? null}
        bookAvg={sub.bb_tradein_avg ?? sub.bb_wholesale_avg ?? null}
        acv={sub.acv_value ?? null}
        walkAwayNumber={sub.customer_walk_away_number ?? null}
        competitorName={sub.competitor_mentioned ?? null}
        competitorOffer={sub.competitor_offer_amount ?? null}
        auditLabel={auditLabel}
        onSaved={onRefresh}
      />
    </div>
  );
};

export const SubmissionDetailSheetLegacy = ({
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
  canViewPricing = true,
  isSalesFloor = false,
  userRole,
  userEmail,
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
          {/* Gradient mesh background */}
          <div className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground overflow-hidden">
            {/* Decorative mesh pattern */}
            <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 80%, white 1px, transparent 1px)", backgroundSize: "60px 60px, 80px 80px, 40px 40px" }} />
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary-foreground/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />

            <div className="relative px-6 py-5">
              <SheetHeader>
                {/* Top bar: quick actions + close */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    {[
                      // "Inspection" was removed — inspectors have their own
                      // entry points (Inspection Check-In, Appraiser Queue)
                      // and the customer-file header isn't where they start.
                      // "Appraisal" remains — it's the most common jump from
                      // the customer view.
                      { label: "Appraisal", icon: Gauge, onClick: () => { routerNavigate(`/appraisal/${sub.token}`); } },
                      {
                        label: (sub as any).needs_appraisal ? "In Queue" : "Send to Appraiser",
                        icon: Gauge,
                        onClick: async () => {
                          const next = !(sub as any).needs_appraisal;
                          const { error } = await (supabase as any)
                            .from("submissions")
                            .update({ needs_appraisal: next })
                            .eq("id", sub.id);
                          if (error) {
                            // Friendly error when the column hasn't been
                            // provisioned on this environment yet.
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
                            description: next
                              ? "A manager can now see this in the Appraiser Queue."
                              : undefined,
                          });
                          fetchActivityLog(sub.id);
                        },
                      },
                      { label: "Print", icon: Printer, onClick: handlePrint },
                    ].map(action => (
                      <div key={action.label} className="flex flex-col items-center">
                        <Button variant="ghost" size="sm" onClick={action.onClick} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-xl text-xs h-8 print:hidden transition-all">
                          <action.icon className="w-3.5 h-3.5 mr-1.5" /> {action.label}
                        </Button>
                        {action.label === "Appraisal" && (
                          <span className="text-[9px] text-primary-foreground/40 mt-0.5 print:hidden">Opens in this tab</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setEditState(null); onClose(); }} className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 h-9 w-9 rounded-xl transition-all">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Hero: Avatar + Vehicle + Status */}
                <div className="flex items-start gap-4">
                  <CustomerAvatar name={sub.name} />
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-2xl font-extrabold text-primary-foreground font-display tracking-wide leading-tight">
                      {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model || "Submission Details"}
                    </SheetTitle>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-primary-foreground/60 text-sm font-medium">
                        {sub.name || "Unknown Customer"}
                      </span>
                      <span className="text-primary-foreground/30">|</span>
                      <span className="text-primary-foreground/50 text-xs">
                        {new Date(sub.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <Badge className={`text-[10px] font-bold tracking-wider rounded-lg px-2.5 py-0.5 ${
                        sub.progress_status === "purchase_complete" ? "bg-success/20 text-success border-success/30 shadow-[0_0_8px_rgba(34,197,94,0.15)]" :
                        sub.progress_status === "dead_lead" ? "bg-destructive/25 text-destructive-foreground border-destructive/30" :
                        "bg-primary-foreground/15 text-primary-foreground border-primary-foreground/20"
                      }`}>
                        {getStatusLabel(sub.progress_status)}
                      </Badge>
                      {sub.is_hot_lead && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-orange-500/20 text-orange-200 border border-orange-400/30 rounded-lg px-2 py-0.5 animate-pulse">
                          🔥 Hot Lead
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick deal value in header */}
                  {(sub.offered_price || sub.estimated_offer_high) && (
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-primary-foreground/50 text-[10px] uppercase tracking-widest font-semibold mb-0.5">
                        {sub.offered_price ? "Offered" : "Estimated"}
                      </p>
                      <p className="text-2xl font-black text-primary-foreground tracking-tight font-display">
                        ${Math.floor(sub.offered_price || sub.estimated_offer_high || 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </SheetHeader>
            </div>
          </div>
        </div>

        {/* ── Alerts (full width) — premium banner style ── */}
        {(duplicateWarnings[sub.id]?.length > 0 || optOutStatus.email || optOutStatus.sms) && (
          <div className="px-6 pt-4 space-y-2.5 shrink-0">
            {duplicateWarnings[sub.id]?.length > 0 && (
              <div className="bg-destructive/8 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3 backdrop-blur-sm shadow-[0_0_16px_rgba(239,68,68,0.06)]">
                <div className="w-9 h-9 rounded-xl bg-destructive/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-bold text-destructive">Possible Duplicate Detected</p>
                  {duplicateWarnings[sub.id].map((w, i) => <p key={i} className="text-xs text-destructive/70 mt-0.5">{w}</p>)}
                </div>
              </div>
            )}
            {(optOutStatus.email || optOutStatus.sms) && (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Customer Unsubscribed</p>
                  <div className="flex gap-2 mt-1.5">
                    {optOutStatus.email && <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-lg"><Mail className="w-3 h-3 mr-1" /> Email opted out</Badge>}
                    {optOutStatus.sms && <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-lg"><Phone className="w-3 h-3 mr-1" /> SMS opted out</Badge>}
                  </div>
                  <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-1.5">Follow-up messages to opted-out channels will be skipped automatically.</p>
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
          <div className="lg:w-[40%] lg:border-r border-border/30 overflow-y-auto p-5 lg:p-6 space-y-5 shrink-0 bg-gradient-to-b from-muted/10 to-transparent">

            {/* Pinned quick-summary — first thing BDCs / sales see */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <QuickSummary sub={sub} statusLabel={getStatusLabel(sub.progress_status)} />
              </div>
              {/* Driver's license thumbnail is ID-document material —
                   hidden from the sales floor. Managers and inspectors
                   still see it. */}
              {!isSalesFloor && <DLAtAGlance docs={docs} />}
            </div>

            {/* Offered Price — Hero Deal Card */}
            {(canSetPrice || sub.offered_price) && (
              <div data-print-section className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.03] shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Subtle accent glow */}
                {sub.offered_price && <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-success/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />}
                <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-5 py-3 border-b border-border/40 flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-foreground/80 uppercase tracking-[0.12em] flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10">
                      <DollarSign className="w-3.5 h-3.5 text-primary" />
                    </span>
                    Deal Value
                  </h3>
                  {sub.offered_price != null && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg cursor-help transition-colors ${isAutoPopulated ? "bg-accent/10 text-accent border border-accent/20" : "bg-primary/10 text-primary border border-primary/20"}`}>
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
                <div className="relative p-5">
                  {canSetPrice ? (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground/60">$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="pl-10 h-14 text-2xl font-black tracking-tight border-2 focus:border-primary/50 rounded-xl"
                        value={sub.offered_price != null ? Number(sub.offered_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, "");
                          updateField({ offered_price: raw ? Number(raw) : null });
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-4xl font-black text-card-foreground tracking-tight font-display">
                      {(() => {
                        const val = sub.offered_price ?? 0;
                        const [dollars, cents] = val.toFixed(2).split(".");
                        return <>${Number(dollars).toLocaleString()}<span className="text-lg text-muted-foreground font-semibold">.{cents}</span></>;
                      })()}
                    </p>
                  )}
                  {/* Estimated range context */}
                  {sub.estimated_offer_high && sub.offered_price !== sub.estimated_offer_high && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
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
                <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-5 py-3 border-b border-border/40 flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-foreground/80 uppercase tracking-[0.12em] flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      </span>
                      Lead Score
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getScoreColor(ls.score)}`}>
                      {ls.label}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-3xl font-black tracking-tight text-card-foreground">{ls.score}</span>
                      <div className="flex-1">
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              ls.score >= 80 ? "bg-orange-500" :
                              ls.score >= 60 ? "bg-amber-500" :
                              ls.score >= 40 ? "bg-blue-500" :
                              "bg-muted-foreground/40"
                            }`}
                            style={{ width: `${ls.score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {ls.factors.map((f, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground leading-snug">{f}</p>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ACV Value — Premium. Spread / margin hidden from the
                 sales floor (isSalesFloor) — they can see the ACV
                 number but not the dealer-vs-customer-offer delta. */}
            {sub.acv_value && canViewPricing && (
              <SectionCard icon={Gauge} title="Appraisal Value (ACV)" accent="success">
                <div className="flex items-end justify-between mb-3">
                  <p className="text-2xl font-black text-card-foreground tracking-tight font-display">${Number(sub.acv_value).toLocaleString()}</p>
                  {sub.offered_price && sub.acv_value && !isSalesFloor && (
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Spread</p>
                      <p className={`text-sm font-bold ${(sub.acv_value - sub.offered_price) > 0 ? "text-success" : "text-destructive"}`}>
                        {(sub.acv_value - sub.offered_price) > 0 ? "+" : ""}${Math.floor(sub.acv_value - sub.offered_price).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                {sub.appraised_by && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-3">
                    <Users className="w-3 h-3" /> Appraised by: <span className="font-semibold text-card-foreground/70">{sub.appraised_by}</span>
                  </p>
                )}
                {/* Full appraisal tool is margin-math — the sales floor
                     sees the ACV number but doesn't get the tool. */}
                {!isSalesFloor && (
                  <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs font-semibold" onClick={() => { routerNavigate(`/appraisal/${sub.token}`); }}>
                    <Gauge className="w-3.5 h-3.5 mr-1.5" /> Open Appraisal Tool
                  </Button>
                )}
              </SectionCard>
            )}
            {!sub.acv_value && canSetPrice && (
              <div className="rounded-2xl border-2 border-dashed border-border/40 bg-muted/10 p-5 text-center">
                <Gauge className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-3">No ACV set yet</p>
                <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs font-semibold" onClick={() => { routerNavigate(`/appraisal/${sub.token}`); }}>
                  <Gauge className="w-3.5 h-3.5 mr-1.5" /> Open Appraisal Tool
                </Button>
              </div>
            )}

            {/* OBD-II Quick Indicator */}
            {sub.id && <CompactOBDIndicator submissionId={sub.id} token={sub.token} />}

            {/* Black Book Market Values — Private Party reference.
                 Sales floor sees this read-only (they can quote the
                 customer with confidence); managers and above see it
                 plus every edit affordance. Non-pricing roles (e.g.
                 inspector) don't see it at all. */}
            {canViewPricing && (() => {
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
                  <span className="text-[9px] font-semibold text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5 uppercase tracking-wider">Black Book</span>
                }>
                  <div className="space-y-2">
                    {valueRows.map(row => (
                      <div key={row.label} className={`flex items-center justify-between py-2 px-3 rounded-xl transition-colors ${row.highlight ? `${row.bg} border border-amber-500/15` : "hover:bg-muted/30"}`}>
                        <span className="flex items-center gap-2 text-sm">
                          <span className={`w-2 h-2 rounded-full ${row.dotBg}`} />
                          <span className={row.highlight ? "font-bold text-card-foreground" : "text-muted-foreground"}>{row.label}</span>
                          {row.highlight && <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Key Ref</span>}
                        </span>
                        <span className={`text-sm font-bold ${row.color}`}>${Math.floor(row.value!).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {privatePartyAvg && sub.offered_price && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Savings vs Private Sale</span>
                        <span className="font-bold text-primary">
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
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-0.5"><Check className="w-3 h-3 text-success" /> Synced</span>
              ) : undefined
            }>
              {/* Status chips with premium styling */}
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  { check: sub.appointment_set, label: "Inspection", activeLabel: "Scheduled", pendingLabel: "Not Set", icon: CalendarDays },
                  { check: sub.docs_uploaded, label: "Docs", activeLabel: "Uploaded", pendingLabel: "Pending", icon: FileText },
                  { check: sub.photos_uploaded, label: "Photos", activeLabel: "Uploaded", pendingLabel: "Pending", icon: Camera },
                ].map(chip => (
                  <div key={chip.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                    chip.check
                      ? "bg-success/10 text-success border-success/20 shadow-[0_0_8px_rgba(34,197,94,0.08)]"
                      : "bg-muted/40 text-muted-foreground border-border/40"
                  }`}>
                    {chip.check ? <CheckCircle2 className="w-3.5 h-3.5" /> : <chip.icon className="w-3.5 h-3.5" />}
                    {chip.label} {chip.check ? chip.activeLabel : chip.pendingLabel}
                  </div>
                ))}
              </div>

              {sub.progress_status === "dead_lead" ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <div className="w-8 h-8 rounded-xl bg-destructive/15 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <span className="font-bold text-destructive text-sm block">Dead Lead</span>
                    <span className="text-xs text-destructive/70">This opportunity has been closed</span>
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
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-300 ${
                            isComplete ? "bg-gradient-to-br from-success to-success/80 text-success-foreground shadow-[0_2px_8px_rgba(34,197,94,0.25)]" :
                            isCurrent ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_2px_12px_rgba(var(--primary),0.3)] ring-[3px] ring-primary/20 animate-[pulse_3s_ease-in-out_infinite]" :
                            "bg-muted/60 text-muted-foreground/60 border border-border/40"
                          }`}>
                            {isComplete ? <Check className="w-4 h-4" /> : <stage.icon className="w-3.5 h-3.5" />}
                          </div>
                          <span className={`text-[10px] mt-2 text-center leading-tight max-w-[70px] transition-colors ${
                            isCurrent ? "font-extrabold text-primary" :
                            isComplete ? "font-semibold text-card-foreground" :
                            "text-muted-foreground/60"
                          }`}>
                            {stage.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`h-[2px] flex-1 min-w-[8px] -mt-5 rounded-full transition-all ${
                            isComplete ? "bg-gradient-to-r from-success to-success/60" : "bg-border/40"
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
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Update Status</label>
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

            {/* Appointment — Premium. id target for BDC "Book Inspection"
                 quick-action button that lives in BDCActionStrip. */}
            <div id="appointment-section" />
            <SectionCard icon={CalendarDays} title="Appointment" accent={sub.appointment_set ? "success" : undefined}>
              {sub.appointment_set && sub.appointment_date ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-success/5 border border-success/15 rounded-xl p-3">
                    <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-card-foreground font-bold">
                        {new Date(sub.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        {selectedApptTime && <span className="text-success font-semibold ml-1.5">at {selectedApptTime}</span>}
                      </p>
                      {selectedApptLocation && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {getLocationLabel(selectedApptLocation)}</p>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs font-semibold" onClick={() => onScheduleAppointment(sub)}>
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Reschedule
                  </Button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs font-semibold" onClick={() => onScheduleAppointment(sub)}>
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Schedule Appointment
                  </Button>
                </div>
              )}
            </SectionCard>

            {/* Check Request — Premium */}
            <SectionCard icon={ClipboardCheck} title="Check Request" accent={sub.check_request_done ? "success" : undefined}>
              <div className="flex items-center gap-3 mb-4 bg-muted/20 rounded-xl p-3 border border-border/20">
                <Checkbox id="check-request-done" checked={sub.check_request_done} disabled={!isPriceAgreedOrBeyond || !(sub as any).appraisal_finalized} onCheckedChange={(checked) => updateField({ check_request_done: !!checked })} className="rounded-md" />
                <label htmlFor="check-request-done" className={`text-sm font-semibold ${isPriceAgreedOrBeyond ? "text-card-foreground" : "text-muted-foreground"}`}>Check Request Completed</label>
              </div>
              {!(sub as any).appraisal_finalized ? (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/8 border border-amber-500/15 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">Appraisal must be finalized before generating a check request.</span>
                </div>
              ) : isPriceAgreedOrBeyond ? (
                <div className="space-y-3">
                  {/* Same-day check — distinct from "Generate Check Request"
                       (that queues the paperwork for accounting). This button
                       stamps the moment the physical check is in hand and
                       texts the customer to come pick it up. Admin+GSM+GM
                       only. */}
                  {canApprove && (sub as any).check_request_done && !(sub as any).check_ready_at && (
                    <Button
                      size="sm"
                      className="rounded-xl h-10 text-xs font-bold w-full bg-success hover:bg-success/90 text-success-foreground"
                      onClick={async () => {
                        const nowIso = new Date().toISOString();
                        const { error } = await supabase
                          .from("submissions")
                          .update({
                            check_ready_at: nowIso,
                            check_pickup_notified_at: nowIso,
                          } as any)
                          .eq("id", sub.id);
                        if (error) {
                          toast({ title: "Could not mark ready", description: error.message, variant: "destructive" });
                          return;
                        }
                        safeInvoke("send-notification", {
                          body: { trigger_key: "customer_check_ready_for_pickup", submission_id: sub.id },
                          context: { from: "SubmissionDetailSheet.checkReady" },
                        });
                        await supabase.from("activity_log").insert({
                          submission_id: sub.id,
                          action: "Check Ready for Pickup",
                          old_value: null,
                          new_value: "Customer notified",
                          performed_by: auditLabel,
                        } as any);
                        toast({ title: "Customer notified", description: "SMS sent — customer can come pick up their check." });
                        onRefresh(sub);
                      }}
                    >
                      <DollarSign className="w-4 h-4 mr-1.5" /> Mark Check Ready — Notify Customer
                    </Button>
                  )}
                  {(sub as any).check_ready_at && (
                    <div className="rounded-xl bg-success/10 border border-success/30 p-3 text-xs text-success flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Check ready since {new Date((sub as any).check_ready_at).toLocaleString()} — customer notified.
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs font-semibold" onClick={handleGenerateCheckRequest}>
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> Generate Check Request
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs font-semibold" onClick={handlePrintAllDocs}>
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> Print All Docs
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">Check request includes all docs. "Print All Docs" reprints supporting documents only.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Available once price is agreed and entered.</p>
              )}
            </SectionCard>

            {/* Review Request — Premium celebration card */}
            {sub.progress_status === "purchase_complete" && sub.email && (
              <div className="relative rounded-2xl border border-success/20 bg-gradient-to-br from-success/5 via-card to-success/[0.03] overflow-hidden shadow-[0_2px_12px_rgba(34,197,94,0.06)]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-success/8 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="bg-gradient-to-r from-success/12 to-success/5 px-5 py-3 border-b border-success/15">
                  <h3 className="text-[11px] font-bold text-foreground/80 uppercase tracking-[0.12em] flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-success/15">
                      <Star className="w-3.5 h-3.5 text-success" />
                    </span>
                    Request Customer Review
                  </h3>
                </div>
                <div className="relative p-5">
                  {sub.review_requested ? (
                    <div className="flex items-center gap-3 text-sm text-success bg-success/8 rounded-xl p-3 border border-success/15">
                      <div className="w-8 h-8 rounded-xl bg-success/15 flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="font-semibold">Review request sent{sub.review_requested_at ? ` on ${new Date(sub.review_requested_at).toLocaleDateString()}` : ""}</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Send an email asking the customer to leave a review for this completed purchase.</p>
                      <Button variant="outline" size="sm" className="border-success/30 text-success hover:bg-success/10 rounded-xl h-9 font-semibold" onClick={async () => {
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

            {/* Save + Delete — Premium floating action bar */}
            <div className="sticky bottom-0 bg-gradient-to-t from-card via-card/98 to-card/90 backdrop-blur-md pt-4 pb-2 border-t border-border/30 flex gap-3 shadow-[0_-8px_32px_rgba(0,0,0,0.08)] rounded-t-2xl px-5 -mx-5 -mb-5">
              <Button
                className="flex-1 h-11 rounded-xl font-bold text-sm shadow-[0_2px_12px_rgba(var(--primary),0.2)] hover:shadow-[0_4px_20px_rgba(var(--primary),0.3)] transition-all"
                disabled={sub.progress_status === "inspection_completed" && !sub.acv_value}
                onClick={handleSave}
              >
                <Save className="w-4 h-4 mr-2" /> Update Record
              </Button>
              {canDelete && (
                <Button variant="destructive" className="h-11 rounded-xl font-bold text-sm px-5 shadow-sm hover:shadow-md transition-all" onClick={() => onDelete(sub.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              )}
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────────── */}
          {/* RIGHT COLUMN — scrollable details (~60%)                      */}
          {/* ────────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-6 min-h-0">

            {/* ── BDC / Escalation / Declined-reason banners ────────────── */}
            <BDCActionStrip
              sub={sub}
              userRole={userRole}
              userEmail={userEmail}
              isSalesFloor={isSalesFloor}
              auditLabel={auditLabel}
              onRefresh={() => onRefresh(sub)}
            />

            {/* Contact + Vehicle */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <SectionCard icon={Users} title="Contact Information" headerRight={
                (sub.phone || sub.email) ? (
                  <div className="flex items-center gap-1">
                    {sub.phone && (
                      <a href={`tel:${sub.phone}`} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors cursor-pointer">
                        <Phone className="w-3 h-3" /> Call
                      </a>
                    )}
                    {sub.email && (
                      <a href={`mailto:${sub.email}`} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer">
                        <Mail className="w-3 h-3" /> Email
                      </a>
                    )}
                  </div>
                ) : undefined
              }>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Name</Label>
                    <Input value={sub.name || ""} onChange={(e) => updateField({ name: e.target.value || null })} placeholder="Full name" className="h-9 text-sm rounded-xl border-border/60 focus:border-primary/40" />
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
                    <Input value={sub.phone || ""} onChange={(e) => updateField({ phone: e.target.value || null })} placeholder="(555) 123-4567" className="h-9 text-sm rounded-xl border-border/60 focus:border-primary/40" />
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
                    <Input type="email" value={sub.email || ""} onChange={(e) => updateField({ email: e.target.value || null })} placeholder="email@example.com" className="h-9 text-sm rounded-xl border-border/60 focus:border-primary/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">ZIP</Label>
                    <Input value={sub.zip || ""} onChange={(e) => updateField({ zip: e.target.value || null })} placeholder="ZIP code" className="h-9 text-sm rounded-xl border-border/60 focus:border-primary/40" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/30">
                  <Label className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block mb-2.5">Address</Label>
                  <div className="space-y-2.5">
                    <Input value={sub.address_street || ""} onChange={(e) => updateField({ address_street: e.target.value || null })} placeholder="Street address" className="h-9 text-sm rounded-xl border-border/60 focus:border-primary/40" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={sub.address_city || ""} onChange={(e) => updateField({ address_city: e.target.value || null })} placeholder="City" className="h-9 text-sm rounded-xl border-border/60 focus:border-primary/40" />
                      <Input value={sub.address_state || ""} onChange={(e) => updateField({ address_state: e.target.value || null })} placeholder="State" className="h-9 text-sm rounded-xl border-border/60 focus:border-primary/40" />
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
                  <div className="mb-4 rounded-lg overflow-hidden bg-gradient-to-b from-muted/30 to-transparent" style={{ aspectRatio: "16/7" }}>
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
                className="rounded-xl border-border/40 focus:border-primary/40 resize-none text-sm leading-relaxed"
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
                  <div className="text-center py-6 border-2 border-dashed border-border/40 rounded-xl">
                    <Camera className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No photos uploaded</p>
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
                  <div className="text-center py-6 border-2 border-dashed border-border/40 rounded-xl">
                    <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No documents uploaded</p>
                  </div>
                )}
                <div className="mt-3">
                  <StaffFileUpload token={sub.token} bucket="customer-documents" onUploadComplete={() => onRefresh(sub)} />
                </div>
              </SectionCard>
            </div>

            {/* Customer Documents QR — Premium sharing card */}
            <SectionCard icon={Upload} title="Document Upload Link">
              <p className="text-sm text-muted-foreground mb-4">Share this link with the customer to upload their documents securely.</p>
              <div className="flex items-start gap-5">
                <div className="bg-white p-3 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/20 flex-shrink-0">
                  <QRCodeSVG value={getDocsUrl(sub.token)} size={110} />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="bg-muted/30 rounded-xl p-3 border border-border/30">
                    <p className="text-[11px] text-muted-foreground break-all font-mono leading-relaxed">{getDocsUrl(sub.token)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl h-9 font-semibold text-xs" onClick={() => { navigator.clipboard.writeText(getDocsUrl(sub.token)); toast({ title: "Link copied!" }); }}>
                      <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Copy Link
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl h-9 font-semibold text-xs" onClick={() => window.open(getDocsUrl(sub.token), "_blank")}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open
                    </Button>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Follow-Up Sequence — hoisted above the collapsible so
                 the sales floor can see pending next steps at a glance.
                 This is the primary sales action list and belongs in
                 the top of the right column, not buried in Research. */}
            <FollowUpPanel submissionId={sub.id} hasOffer={!!(sub.offered_price || sub.estimated_offer_high)} progressStatus={sub.progress_status} />

            {/* ─────────────────────────────────────────────────────────
                Research & Automation — collapsible so the top of the file
                stays focused on the deal. Contains Retail Market,
                AI Call History, and the full Activity Log. Hidden for
                the sales floor (isSalesFloor) — they're follow-up-focused,
                not internal-ops focused.
                ───────────────────────────────────────────────────────── */}
            {!isSalesFloor && (
            <details className="group/more rounded-2xl border border-border/40 bg-card/40 overflow-hidden [&[open]>summary>svg]:rotate-180">
              <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  Research &amp; Automation
                </span>
                <span className="text-[10px] text-muted-foreground">Market · Call history · Activity log</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-5 border-t border-border/30">

            {/* Unified Conversation Thread — replaces the old separate
                 AI Call History + Activity Log panels. Reads from
                 conversation_events which auto-populates from every
                 existing source via triggers. Pins to the top of the
                 collapsible so it's the first thing managers see. */}
            <SectionCard icon={MessageSquare} title="Conversation">
              <ConversationThread
                submissionId={sub.id}
                customerPhone={sub.phone}
                customerEmail={sub.email}
                dealershipId={(sub as any).dealership_id}
                userEmail={userEmail}
              />
            </SectionCard>

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


              </div>
            </details>
            )}
            {/* ── END Research & Automation collapsible ── */}
          </div>
          {/* ── END RIGHT COLUMN ── */}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SubmissionDetailSheetLegacy;
