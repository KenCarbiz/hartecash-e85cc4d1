import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { isManagerRole } from "@/lib/adminConstants";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Gauge, Flame, Wrench, Car, UserX, ArrowRight, Clock,
  Sparkles, ShieldAlert, Loader2, Plus, X,
} from "lucide-react";

/**
 * Appraiser Queue — Phase 1
 *
 * A focused work queue for used car managers (and users granted the
 * Appraiser credential) showing every submission that needs a human
 * touch on price.
 *
 * Inclusion rules:
 *   - ALWAYS: needs_appraisal = true AND acv_value IS NULL
 *     (manager explicitly flagged it via "Send to Appraiser")
 *   - IF site_config.auto_route_appraiser_queue = true, ALSO include:
 *     - progress_status = offer_declined  (customer told us no on the phone)
 *     - lead_source IN (walk_in, service, manual_entry) AND acv_value IS NULL
 *       (showroom + service-drive captures awaiting an initial number)
 *     - Stale offers: offered_price > 0 AND status_updated_at older than
 *       STALE_OFFER_HOURS AND status not in any accepted/final state.
 *       The customer got a number but hasn't moved — appraiser should
 *       reappraise and send a counteroffer; BDC then re-engages.
 *
 * Sort order reflects operational urgency:
 *   1. Walk-ins (red)    — customer physically on the lot right now
 *   2. Service-drive (orange) — customer at the dealership but not at sales
 *   3. Manual entry (amber)   — staff-entered lead awaiting a number
 *   4. Manager-flagged + stale offers (purple) — explicit + auto re-review
 *   5. Declined offers (blue) — recoverable, not urgent
 *   Within each group, oldest first.
 */

const STALE_OFFER_HOURS = 1;
const ACCEPTED_OR_FINAL_STATUSES = [
  "offer_accepted", "price_agreed", "deal_finalized",
  "title_ownership_verified", "check_request_submitted",
  "purchase_complete", "dead_lead", "partial",
];

interface QueueRow {
  id: string;
  token: string;
  created_at: string;
  status_updated_at: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  mileage: string | null;
  lead_source: string;
  progress_status: string;
  offered_price: number | null;
  estimated_offer_high: number | null;
  estimated_offer_low: number | null;
  acv_value: number | null;
  needs_appraisal: boolean;
  internal_notes: string | null;
}

type QueueReason =
  | "walk_in"
  | "service"
  | "manual_entry"
  | "flagged"
  | "declined";

const REASON_META: Record<QueueReason, { label: string; color: string; icon: React.ElementType; priority: number }> = {
  walk_in:     { label: "Walk-In",     color: "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400", icon: Flame,    priority: 1 },
  service:     { label: "Service",     color: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400", icon: Wrench, priority: 2 },
  manual_entry:{ label: "Manual",      color: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400", icon: Plus, priority: 3 },
  flagged:     { label: "Flagged",     color: "bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-400", icon: Sparkles, priority: 4 },
  declined:    { label: "Declined",    color: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400", icon: UserX, priority: 5 },
};

const isStaleOffer = (row: QueueRow): boolean => {
  if (!row.offered_price || row.offered_price <= 0) return false;
  if (ACCEPTED_OR_FINAL_STATUSES.includes(row.progress_status)) return false;
  // Use status_updated_at when available (last journey-change timestamp)
  // and fall back to created_at so newer leads still surface eventually.
  const ts = row.status_updated_at || row.created_at;
  if (!ts) return false;
  const ageMs = Date.now() - new Date(ts).getTime();
  return ageMs >= STALE_OFFER_HOURS * 60 * 60 * 1000;
};

const classifyRow = (row: QueueRow): QueueReason => {
  // Priority order: lead-source bucketing wins so a walk-in with a
  // stale offer still shows under Walk-ins (operator intent — they
  // walked in). Manager flag and stale-offer both fall under "flagged"
  // for the count tile.
  if (row.lead_source === "walk_in") return "walk_in";
  if (row.lead_source === "service") return "service";
  if (row.lead_source === "manual_entry") return "manual_entry";
  if (row.needs_appraisal) return "flagged";
  if (isStaleOffer(row)) return "flagged";
  return "declined";
};

const formatAge = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatCurrency = (n: number | null): string =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;

const vehicleTitle = (r: QueueRow): string =>
  [r.vehicle_year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ") || "Vehicle";

interface AppraiserQueueProps {
  /** Passed down from AdminSectionRenderer so we know who's looking. */
  userRole?: string;
  isAppraiser?: boolean;
}

interface AIReappraisalSuggestion {
  id: string;
  submission_id: string;
  old_offer: number | null;
  suggested_offer: number;
  delta: number;
  ai_confidence: number | null;
  photos_analyzed: number;
  reason: string;
  status: string;
  created_at: string;
}

const AppraiserQueue = ({ userRole = "", isAppraiser = false }: AppraiserQueueProps) => {
  const { tenant } = useTenant();
  const { config } = useSiteConfig();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, AIReappraisalSuggestion>>({});
  const [loading, setLoading] = useState(true);

  const autoRoute = Boolean((config as any).auto_route_appraiser_queue);
  // Visibility: admins + any manager-tier role, OR anyone with the
  // additive Appraiser credential regardless of their base role.
  // Manager helper picks up used_car_manager, new_car_manager, gsm_gm
  // from the canonical MANAGER_ROLES list.
  const canAccess =
    userRole === "admin" || isManagerRole(userRole) || isAppraiser;

  const [schemaReady, setSchemaReady] = useState<boolean>(true);

  const fetchQueue = async () => {
    setLoading(true);
    // Column list — only include needs_appraisal if we've confirmed the
    // column exists. Lovable migrations can lag behind a code push by a
    // few minutes; we want the queue to degrade gracefully during that
    // window instead of showing a red error toast.
    const columnsWithFlag =
      "id, token, created_at, status_updated_at, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, mileage, lead_source, progress_status, offered_price, estimated_offer_high, estimated_offer_low, acv_value, needs_appraisal, internal_notes";
    const columnsWithoutFlag =
      "id, token, created_at, status_updated_at, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, mileage, lead_source, progress_status, offered_price, estimated_offer_high, estimated_offer_low, acv_value, internal_notes";

    // OR-clause inclusion. Using PostgREST's nested and(...) groups so
    // each rule carries its own AND-conditions (acv_value scope, status
    // gates) and we don't need a global .is("acv_value", null) outside
    // the OR — that filter would have hidden stale-offer leads, which
    // by definition already have a number.
    const cutoffIso = new Date(Date.now() - STALE_OFFER_HOURS * 60 * 60 * 1000).toISOString();
    const acceptedFinalCsv = ACCEPTED_OR_FINAL_STATUSES.join(",");
    const orParts = [
      "and(needs_appraisal.eq.true,acv_value.is.null)",
    ];
    if (autoRoute) {
      // Phone/in-person decline — already had a number, customer said no.
      orParts.push("progress_status.eq.offer_declined");
      // Showroom + service-drive captures awaiting an initial number.
      orParts.push("and(lead_source.in.(walk_in,service,manual_entry),acv_value.is.null)");
      // Stale offers — got a number but no movement after STALE_OFFER_HOURS.
      orParts.push(
        `and(offered_price.gt.0,status_updated_at.lt.${cutoffIso},progress_status.not.in.(${acceptedFinalCsv}))`,
      );
    }
    let { data, error } = await (supabase as any)
      .from("submissions")
      .select(columnsWithFlag)
      .or(orParts.join(","))
      .order("created_at", { ascending: false });

    // Graceful degradation — the needs_appraisal column hasn't been
    // provisioned yet. Fall back to a column-free query so the page
    // still renders something useful, and set a flag so the UI can
    // explain the situation instead of showing an empty red toast.
    const columnMissing =
      error?.message?.includes("needs_appraisal") ||
      error?.message?.includes("column") && error?.message?.includes("does not exist");

    if (columnMissing) {
      setSchemaReady(false);
      if (autoRoute) {
        // Still run the auto-route path — it doesn't depend on the flag
        const fallback = await (supabase as any)
          .from("submissions")
          .select(columnsWithoutFlag)
          .or("progress_status.eq.offer_declined,lead_source.in.(walk_in,service,manual_entry)")
          .is("acv_value", null)
          .order("created_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      } else {
        // No auto-route and no column → nothing to show yet
        data = [];
        error = null;
      }
    } else {
      setSchemaReady(true);
    }

    if (error) {
      console.error("[AppraiserQueue] fetch failed:", error);
      // Silent fail — don't toast. Empty state below will communicate
      // that the queue is clear, and schemaReady === false banner
      // will explain if it's actually a schema provisioning gap.
      setRows([]);
      setLoading(false);
      return;
    }
    const queueRows = ((data as QueueRow[]) || []).map((r) => ({
      ...r,
      // Default the flag to false on rows fetched from the fallback query
      // so downstream classifyRow() doesn't choke on undefined.
      needs_appraisal: (r as any).needs_appraisal ?? false,
    }));
    setRows(queueRows);

    // Fetch pending AI re-appraisal suggestions for the submissions in view
    if (queueRows.length > 0) {
      try {
        const submissionIds = queueRows.map(r => r.id);
        const { data: sugData } = await (supabase as any)
          .from("ai_reappraisal_log")
          .select("id, submission_id, old_offer, suggested_offer, delta, ai_confidence, photos_analyzed, reason, status, created_at")
          .in("submission_id", submissionIds)
          .in("status", ["suggested", "auto_applied"])
          .order("created_at", { ascending: false });
        if (sugData) {
          // One suggestion per submission — newest wins
          const byId: Record<string, AIReappraisalSuggestion> = {};
          for (const s of sugData as AIReappraisalSuggestion[]) {
            if (!byId[s.submission_id]) byId[s.submission_id] = s;
          }
          setSuggestions(byId);
        }
      } catch (e) {
        console.error("Failed to load AI suggestions:", e);
      }
    } else {
      setSuggestions({});
    }
    setLoading(false);
  };

  const acceptSuggestion = async (row: QueueRow, suggestion: AIReappraisalSuggestion) => {
    // Apply the AI-recommended offer and mark the log entry accepted.
    // The DB trigger auto_flag_subject_to_inspection will set
    // offer_subject_to_inspection = true automatically because the new
    // offered_price is above the algorithmic baseline.
    const { data: userData } = await supabase.auth.getUser();
    const actorEmail = userData?.user?.email || "unknown";
    const { error: updateErr } = await supabase
      .from("submissions")
      .update({ offered_price: suggestion.suggested_offer })
      .eq("id", row.id);
    if (updateErr) {
      toast({ title: "Failed to apply bump", description: updateErr.message, variant: "destructive" });
      return;
    }
    await (supabase as any).from("ai_reappraisal_log").update({
      status: "accepted",
      decided_at: new Date().toISOString(),
      decided_by: actorEmail,
    }).eq("id", suggestion.id);

    // Audit trail
    await supabase.from("activity_log").insert({
      submission_id: row.id,
      action: "AI Bump Accepted",
      old_value: suggestion.old_offer ? `$${suggestion.old_offer.toLocaleString()}` : "None",
      new_value: `$${suggestion.suggested_offer.toLocaleString()}`,
      performed_by: actorEmail,
    });

    // Customer notification
    safeInvoke("send-notification", {
      body: { trigger_key: "customer_offer_increased", submission_id: row.id },
      context: { from: "AppraiserQueue.applyBump" },
    });

    toast({
      title: "Bump applied",
      description: `Offer raised to $${suggestion.suggested_offer.toLocaleString()}. Customer will be notified.`,
    });
    fetchQueue();
  };

  const dismissSuggestion = async (suggestion: AIReappraisalSuggestion) => {
    const { data: userData } = await supabase.auth.getUser();
    const actorEmail = userData?.user?.email || "unknown";
    await (supabase as any).from("ai_reappraisal_log").update({
      status: "dismissed",
      decided_at: new Date().toISOString(),
      decided_by: actorEmail,
    }).eq("id", suggestion.id);
    toast({ title: "Suggestion dismissed" });
    fetchQueue();
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.dealership_id, autoRoute, canAccess]);

  // Sort with the priority defined in REASON_META, then oldest first.
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const pa = REASON_META[classifyRow(a)].priority;
      const pb = REASON_META[classifyRow(b)].priority;
      if (pa !== pb) return pa - pb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [rows]);

  // Counts per reason for the summary strip
  const counts = useMemo(() => {
    const c: Record<QueueReason, number> = {
      walk_in: 0, service: 0, manual_entry: 0, flagged: 0, declined: 0,
    };
    rows.forEach(r => { c[classifyRow(r)]++; });
    return c;
  }, [rows]);

  const dismissFromQueue = async (row: QueueRow) => {
    // Clears the manager flag. Leaves other auto-route rows alone because
    // needs_appraisal was their only entry criterion.
    const { error } = await (supabase as any)
      .from("submissions")
      .update({ needs_appraisal: false })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Dismiss failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows(prev => prev.filter(r => r.id !== row.id));
    toast({ title: "Removed from queue" });
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-semibold text-foreground">Appraiser access required</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md">
          The Appraiser Queue is visible to Used Car Managers, GSM/GM, Admins,
          and any staff member granted the Appraiser credential from
          Staff & Permissions.
        </p>
      </div>
    );
  }

  // Tile counts roll manual_entry into walk-ins so the dashboard shows
  // four buckets (WALK-INS / SERVICE DRIVE / FLAGGED / DECLINED) per
  // the approved design. Internal sort still uses the 5-way classify.
  const tileCounts = {
    walk_ins: counts.walk_in + counts.manual_entry,
    service: counts.service,
    flagged: counts.flagged,
    declined: counts.declined,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-card-foreground">
            Appraiser queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} {rows.length === 1 ? "vehicle needs" : "vehicles need"} a number.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchQueue}>
          Refresh
        </Button>
      </header>

      {/* Schema provisioning banner — only when needs_appraisal column
          hasn't migrated yet. Non-blocking: queue still shows auto-route
          rows below. */}
      {!schemaReady && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Queue provisioning in progress.</strong> The manager-flag
            column hasn't finished provisioning on your database yet. Refresh
            in 2-3 minutes; auto-routed queue entries still appear below.
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QueueTile label="Walk-ins" value={tileCounts.walk_ins} valueClass="text-red-600" />
        <QueueTile label="Service drive" value={tileCounts.service} valueClass="text-orange-500" />
        <QueueTile label="Flagged" value={tileCounts.flagged} valueClass="text-blue-600" />
        <QueueTile label="Declined" value={tileCounts.declined} valueClass="text-foreground" />
      </section>

      {/* Rows */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading queue…
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Gauge className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">Queue clear</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {autoRoute
              ? "Every lead that needs a human appraisal has one. Walk-ins, service-drive captures, and declined offers will automatically appear here."
              : "No one has flagged a lead for appraisal review. When a manager taps \"Send to Appraiser\" on a customer file, it'll show up here."}
          </p>
        </div>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Queue</h2>
            {autoRoute && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI auto-route on
              </span>
            )}
          </div>
          <div className="space-y-2">
            {sorted.map((row) => (
              <QueueRowItem
                key={row.id}
                row={row}
                reason={classifyRow(row)}
                suggestion={suggestions[row.id]}
                onOpen={() => navigate(`/appraisal/${row.token}`)}
                onDismiss={row.needs_appraisal ? () => dismissFromQueue(row) : undefined}
                onAcceptSuggestion={(s) => acceptSuggestion(row, s)}
                onDismissSuggestion={(s) => dismissSuggestion(s)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

/* ─────────────── Sub-components ─────────────── */

function QueueTile({ label, value, valueClass }: { label: string; value: number; valueClass: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</div>
    </div>
  );
}

function QueueRowItem({
  row, reason, suggestion, onOpen, onDismiss, onAcceptSuggestion, onDismissSuggestion,
}: {
  row: QueueRow;
  reason: QueueReason;
  suggestion: AIReappraisalSuggestion | undefined;
  onOpen: () => void;
  onDismiss?: () => void;
  onAcceptSuggestion: (s: AIReappraisalSuggestion) => void;
  onDismissSuggestion: (s: AIReappraisalSuggestion) => void;
}) {
  // Status pill: shows where the customer is in the journey, not just
  // the queue reason. Falls back to the queue reason label when there's
  // no journey signal we can show distinctly.
  const pill = (() => {
    if (row.progress_status === "customer_arrived") return { label: "Arrived", cls: "bg-red-100 text-red-700", dot: "bg-red-500" };
    if (row.progress_status === "on_the_way") return { label: "On the way", cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500" };
    if (row.progress_status === "inspection_completed") return { label: "Inspected", cls: "bg-blue-100 text-blue-700", dot: "bg-blue-500" };
    if (row.progress_status === "offer_declined") return { label: "Declined", cls: "bg-slate-200 text-slate-700", dot: "bg-slate-500" };
    const m = REASON_META[reason];
    return { label: m.label, cls: m.color, dot: "" };
  })();

  const customerExpected = row.offered_price || row.estimated_offer_high || 0;

  return (
    <div className="rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Car className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold rounded px-2 py-0.5 inline-flex items-center gap-1.5 ${pill.cls}`}>
              {pill.dot && <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />}
              {pill.label}
            </span>
            <span className="text-sm font-bold text-card-foreground truncate">{vehicleTitle(row)}</span>
            {row.mileage && <span className="text-xs text-muted-foreground">· {row.mileage} mi</span>}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {row.name || "Unnamed"}
            {row.phone && <> · {row.phone}</>}
            {customerExpected > 0 && reason === "declined" && (
              <> · saw {formatCurrency(customerExpected)}</>
            )}
            <> · {formatAge(row.created_at)}</>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={onOpen}
            className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
          >
            <Gauge className="w-3.5 h-3.5" />
            Open appraisal
          </Button>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-muted-foreground hover:text-destructive"
              title="Dismiss from queue"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {/* AI re-appraisal suggestion — when present, sits inline beneath
          the row so the appraiser sees the recommended bump without
          opening the file. */}
      {suggestion && (() => {
        const isBump = suggestion.delta > 0;
        const isAutoApplied = suggestion.status === "auto_applied";
        const chipClass = isAutoApplied
          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
          : isBump
            ? "bg-violet-500/10 text-violet-700 border-violet-500/20"
            : "bg-amber-500/10 text-amber-700 border-amber-500/20";
        return (
          <div className={`mx-3 mb-3 rounded-md border p-2.5 ${chipClass}`}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {isAutoApplied ? "AI Auto-Applied" : "AI Recommends"}
              </span>
              <span className="text-[10px] opacity-70">
                · {suggestion.photos_analyzed} {suggestion.photos_analyzed === 1 ? "photo" : "photos"}
                · {suggestion.ai_confidence ?? "—"}% confidence
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] line-through opacity-60">
                {suggestion.old_offer ? formatCurrency(suggestion.old_offer) : "—"}
              </span>
              <ArrowRight className="w-3 h-3 opacity-60" />
              <span className="text-sm font-black">{formatCurrency(suggestion.suggested_offer)}</span>
              <span className={`text-[11px] font-semibold ${isBump ? "text-emerald-700" : "text-amber-700"}`}>
                {isBump ? "+" : ""}{formatCurrency(suggestion.delta)}
              </span>
            </div>
            <p className="text-[11px] mt-1 leading-relaxed">{suggestion.reason}</p>
            {suggestion.status === "suggested" && (
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" className="h-7 text-[11px]" onClick={() => onAcceptSuggestion(suggestion)}>
                  Accept Bump
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onDismissSuggestion(suggestion)}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default AppraiserQueue;
