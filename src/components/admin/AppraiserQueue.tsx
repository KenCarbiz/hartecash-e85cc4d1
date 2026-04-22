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
 *     - progress_status = offer_declined AND acv_value IS NULL
 *     - lead_source IN (walk_in, service, manual_entry) AND acv_value IS NULL
 *
 * Sort order reflects operational urgency:
 *   1. Walk-ins (red)    — customer physically on the lot right now
 *   2. Service-drive (orange) — customer at the dealership but not at sales
 *   3. Manual entry (amber)   — staff-entered lead awaiting a number
 *   4. Manager-flagged (purple) — explicit "please review" queue
 *   5. Declined offers (blue) — recoverable, not urgent
 *   Within each group, oldest first.
 */

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

const classifyRow = (row: QueueRow): QueueReason => {
  // Priority order: explicit manager flag wins over auto-route reasons so
  // a flagged walk-in shows up as "Flagged" (operator intent).
  if (row.lead_source === "walk_in") return "walk_in";
  if (row.lead_source === "service") return "service";
  if (row.lead_source === "manual_entry") return "manual_entry";
  if (row.needs_appraisal) return "flagged";
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

    // Try the full query first (columns + needs_appraisal filter). If it
    // comes back with a "column does not exist" error, fall back to the
    // auto-route criteria only and flag the UI as pre-migration.
    const orParts = ["needs_appraisal.eq.true"];
    if (autoRoute) {
      orParts.push("progress_status.eq.offer_declined");
      orParts.push("lead_source.in.(walk_in,service,manual_entry)");
    }
    let { data, error } = await (supabase as any)
      .from("submissions")
      .select(columnsWithFlag)
      .or(orParts.join(","))
      .is("acv_value", null)
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-black text-card-foreground tracking-tight">
              Appraiser Queue
            </h2>
            <Badge variant="outline" className="text-[10px]">
              {rows.length} {rows.length === 1 ? "lead" : "leads"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vehicles that need a human touch on price — walk-ins, service-drive
            captures, declined offers, and manager-flagged leads.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchQueue}>
          Refresh
        </Button>
      </div>

      {/* AI auto-route status chip */}
      {autoRoute ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-700 dark:text-emerald-400">
            <strong>AI auto-route is ON.</strong> Declined offers, walk-ins,
            service-drive captures, and manual entries without an ACV are
            automatically added to this queue.
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
          <Sparkles className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <strong>AI auto-route is OFF.</strong> This queue shows only
            submissions a manager explicitly flagged with "Send to Appraiser".
            Enable auto-route in <em>Branding → AI & Automation</em> to let
            the system populate the queue automatically.
          </div>
        </div>
      )}

      {/* Schema provisioning banner — shown only when the needs_appraisal
          column is missing from the database (e.g. migration hasn't run
          yet on this environment). Non-blocking: the queue still shows
          auto-route results below if that toggle is on. */}
      {!schemaReady && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Queue provisioning in progress.</strong> The manager-flag
            column hasn't finished provisioning on your database yet. This is
            usually a few-minute window after a platform update. Refresh this
            page in 2-3 minutes, or contact support if you still see this after
            10 minutes. Auto-routed queue entries (walk-ins, service drive,
            declined offers) will still appear below if AI auto-route is on.
          </div>
        </div>
      )}

      {/* Summary strip — counts per reason */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(Object.keys(REASON_META) as QueueReason[]).map(reason => {
          const meta = REASON_META[reason];
          const Icon = meta.icon;
          return (
            <div
              key={reason}
              className={`rounded-lg border p-3 flex items-center gap-2 ${meta.color}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold truncate">
                  {meta.label}
                </div>
                <div className="text-lg font-black leading-none">{counts[reason]}</div>
              </div>
            </div>
          );
        })}
      </div>

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
        <div className="space-y-2">
          {sorted.map(row => {
            const reason = classifyRow(row);
            const meta = REASON_META[reason];
            const Icon = meta.icon;
            const customerExpected = row.offered_price || row.estimated_offer_high || 0;
            return (
              <div
                key={row.id}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge className={`text-[10px] gap-1 ${meta.color}`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </Badge>
                      <h3 className="text-base font-bold text-card-foreground">
                        {vehicleTitle(row)}
                      </h3>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatAge(row.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {row.name && <span className="font-semibold text-card-foreground">{row.name}</span>}
                      {row.vin && <span className="font-mono">VIN {row.vin.slice(-8)}</span>}
                      {row.mileage && <span>{row.mileage} mi</span>}
                      {row.phone && <span>{row.phone}</span>}
                    </div>
                    {customerExpected > 0 && reason === "declined" && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Customer saw {formatCurrency(customerExpected)} — consider a bump or a manual re-val.
                      </p>
                    )}
                    {/* AI re-appraisal suggestion row */}
                    {(() => {
                      const suggestion = suggestions[row.id];
                      if (!suggestion) return null;
                      const isBump = suggestion.delta > 0;
                      const isAutoApplied = suggestion.status === "auto_applied";
                      const chipClass = isAutoApplied
                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                        : isBump
                        ? "bg-violet-500/15 text-violet-600 border-violet-500/30"
                        : "bg-amber-500/15 text-amber-600 border-amber-500/30";
                      return (
                        <div className={`mt-2 rounded-lg border p-2.5 ${chipClass}`}>
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
                            <span className="text-sm font-black">
                              {formatCurrency(suggestion.suggested_offer)}
                            </span>
                            <span className={`text-[11px] font-semibold ${isBump ? "text-emerald-600" : "text-amber-600"}`}>
                              {isBump ? "+" : ""}{formatCurrency(suggestion.delta)}
                            </span>
                          </div>
                          <p className="text-[11px] mt-1 leading-relaxed">{suggestion.reason}</p>
                          {suggestion.status === "suggested" && (
                            <div className="flex gap-1.5 mt-2">
                              <Button
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={() => acceptSuggestion(row, suggestion)}
                              >
                                Accept Bump
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px]"
                                onClick={() => dismissSuggestion(suggestion)}
                              >
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/appraisal/${row.token}`)}
                      className="gap-1"
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      Open Appraisal
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                    {row.needs_appraisal && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissFromQueue(row)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Dismiss from queue"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppraiserQueue;
