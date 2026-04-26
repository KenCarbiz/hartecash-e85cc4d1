// AppraiserQueue — calmer 4-card KPI row + pill AI banner + clean card
// rows. See frontend-redesign/CLAUDE_CODE_BRIEF.md §4.
//
// The legacy dense-queue view and the kill-switch wrapper have been
// removed. This is now the only AppraiserQueue.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { isManagerRole } from "@/lib/adminConstants";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Gauge, Car, ArrowRight, Sparkles, ShieldAlert, Loader2, X,
} from "lucide-react";

interface AppraiserQueueProps {
  /** Passed down from AdminSectionRenderer so we know who's looking. */
  userRole?: string;
  isAppraiser?: boolean;
}

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

// Priorities preserved from the legacy file so sort order is identical.
const REASON_PRIORITY: Record<QueueReason, number> = {
  walk_in: 1,
  service: 2,
  manual_entry: 3,
  flagged: 4,
  declined: 5,
};

const REASON_LABEL: Record<QueueReason, string> = {
  walk_in: "Walk-In",
  service: "Service",
  manual_entry: "Manual",
  flagged: "Flagged",
  declined: "Declined",
};

const classifyRow = (row: QueueRow): QueueReason => {
  if (row.lead_source === "walk_in") return "walk_in";
  if (row.lead_source === "service") return "service";
  if (row.lead_source === "manual_entry") return "manual_entry";
  if (row.needs_appraisal) return "flagged";
  return "declined";
};

const formatCurrency = (n: number | null): string =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;

const vehicleTitle = (r: QueueRow): string =>
  [r.vehicle_year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ") || "Vehicle";

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
  const [schemaReady, setSchemaReady] = useState<boolean>(true);

  const autoRoute = Boolean((config as any).auto_route_appraiser_queue);
  const canAccess =
    userRole === "admin" || isManagerRole(userRole) || isAppraiser;

  // ── Data layer ── identical to legacy. See AppraiserQueue.legacy.tsx
  // for the canonical implementation; copy preserved here per brief.
  const fetchQueue = async () => {
    setLoading(true);
    const columnsWithFlag =
      "id, token, created_at, status_updated_at, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, mileage, lead_source, progress_status, offered_price, estimated_offer_high, estimated_offer_low, acv_value, needs_appraisal, internal_notes";
    const columnsWithoutFlag =
      "id, token, created_at, status_updated_at, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, mileage, lead_source, progress_status, offered_price, estimated_offer_high, estimated_offer_low, acv_value, internal_notes";

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

    const columnMissing =
      error?.message?.includes("needs_appraisal") ||
      (error?.message?.includes("column") && error?.message?.includes("does not exist"));

    if (columnMissing) {
      setSchemaReady(false);
      if (autoRoute) {
        const fallback = await (supabase as any)
          .from("submissions")
          .select(columnsWithoutFlag)
          .or("progress_status.eq.offer_declined,lead_source.in.(walk_in,service,manual_entry)")
          .is("acv_value", null)
          .order("created_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      } else {
        data = [];
        error = null;
      }
    } else {
      setSchemaReady(true);
    }

    if (error) {
      console.error("[AppraiserQueue/refreshed] fetch failed:", error);
      setRows([]);
      setLoading(false);
      return;
    }
    const queueRows = ((data as QueueRow[]) || []).map((r) => ({
      ...r,
      needs_appraisal: (r as any).needs_appraisal ?? false,
    }));
    setRows(queueRows);

    if (queueRows.length > 0) {
      try {
        const submissionIds = queueRows.map((r) => r.id);
        const { data: sugData } = await (supabase as any)
          .from("ai_reappraisal_log")
          .select("id, submission_id, old_offer, suggested_offer, delta, ai_confidence, photos_analyzed, reason, status, created_at")
          .in("submission_id", submissionIds)
          .in("status", ["suggested", "auto_applied"])
          .order("created_at", { ascending: false });
        if (sugData) {
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

    await supabase.from("activity_log").insert({
      submission_id: row.id,
      action: "AI Bump Accepted",
      old_value: suggestion.old_offer ? `$${suggestion.old_offer.toLocaleString()}` : "None",
      new_value: `$${suggestion.suggested_offer.toLocaleString()}`,
      performed_by: actorEmail,
    });

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

  const dismissFromQueue = async (row: QueueRow) => {
    const { error } = await (supabase as any)
      .from("submissions")
      .update({ needs_appraisal: false })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Dismiss failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast({ title: "Removed from queue" });
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.dealership_id, autoRoute, canAccess]);

  // Sort identical to legacy: priority first, then oldest within group.
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const pa = REASON_PRIORITY[classifyRow(a)];
      const pb = REASON_PRIORITY[classifyRow(b)];
      if (pa !== pb) return pa - pb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<QueueReason, number> = {
      walk_in: 0, service: 0, manual_entry: 0, flagged: 0, declined: 0,
    };
    rows.forEach((r) => { c[classifyRow(r)]++; });
    return c;
  }, [rows]);

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

  // ── KPI card config ── 4 cards per brief §4. Manual entries roll into
  // FLAGGED's sub-text rather than getting their own card; the count is
  // still tracked above for sort/filter parity with the legacy view.
  const kpis: { reason: QueueReason; label: string; value: number; sub?: string }[] = [
    { reason: "walk_in",  label: "Walk-Ins",      value: counts.walk_in },
    { reason: "service",  label: "Service Drive", value: counts.service },
    {
      reason: "flagged",
      label: "Flagged",
      value: counts.flagged,
      sub: counts.manual_entry > 0 ? `+${counts.manual_entry} manual` : undefined,
    },
    { reason: "declined", label: "Declined",      value: counts.declined },
  ];

  return (
    <div className="space-y-5">
      {/* Header — calmer hierarchy: title + lead count, optional refresh
          button on the right. Removed the gauge-icon-and-badge cluster
          per the brief's "calmer" directive. */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Appraiser Queue
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {rows.length === 0
              ? "Vehicles awaiting a human price"
              : `${rows.length} ${rows.length === 1 ? "vehicle" : "vehicles"} awaiting a human price`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={fetchQueue}>
          Refresh
        </Button>
      </div>

      {/* AI auto-route — single-line pill per brief */}
      <div
        className={
          autoRoute
            ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 h-7 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300"
            : "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 h-7 text-[12px] font-medium text-muted-foreground"
        }
      >
        <Sparkles className="w-3.5 h-3.5" />
        {autoRoute ? (
          "AI auto-route ON"
        ) : (
          <>
            AI auto-route OFF
            <span className="text-muted-foreground/70">· Enable in Branding → AI</span>
          </>
        )}
      </div>

      {/* Schema provisioning banner — same trigger as legacy */}
      {!schemaReady && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Queue provisioning in progress.</strong> The manager-flag
            column hasn't finished provisioning on your database yet. This is
            usually a few-minute window after a platform update. Refresh in 2–3
            minutes, or contact support if you still see this after 10 minutes.
          </div>
        </div>
      )}

      {/* KPI row — 4 calm cards, big numerals, small labels, no chip-with-icon clutter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.reason} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {k.label}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{k.value}</p>
            {k.sub ? (
              <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Rows */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading queue…
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Gauge className="w-9 h-9 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">Queue clear</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {autoRoute
              ? "Every lead that needs a human appraisal has one. Walk-ins, service-drive captures, and declined offers will automatically appear here."
              : "No one has flagged a lead for appraisal review. When a manager taps \"Send to Appraiser\" on a customer file, it'll show up here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((row) => {
            const reason = classifyRow(row);
            const reasonLabel = REASON_LABEL[reason];
            const reasonDot =
              reason === "walk_in"      ? "bg-red-500"
              : reason === "service"    ? "bg-orange-500"
              : reason === "manual_entry" ? "bg-amber-500"
              : reason === "flagged"    ? "bg-violet-500"
                                        : "bg-blue-500";
            const customerExpected = row.offered_price || row.estimated_offer_high || 0;
            const suggestion = suggestions[row.id];
            return (
              <article
                key={row.id}
                className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Vehicle image placeholder — Car icon on a subtle bg.
                      Real thumbnail lookup against submission-photos is
                      out of scope for this step. */}
                  <div className="w-14 h-14 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    <Car className="w-6 h-6 text-muted-foreground/70" />
                  </div>

                  {/* Middle */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ${reasonDot}`} />
                        {reasonLabel}
                      </span>
                      <h3 className="text-[15px] font-semibold text-foreground truncate">
                        {vehicleTitle(row)}
                      </h3>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1 truncate">
                      {row.vin && <span className="font-mono">VIN {row.vin.slice(-8)}</span>}
                      {row.vin && row.mileage && <span> · </span>}
                      {row.mileage && <span>{row.mileage} mi</span>}
                      {row.name && (row.vin || row.mileage) && <span> · </span>}
                      {row.name && <span className="font-medium text-foreground/80">{row.name}</span>}
                    </p>
                    {customerExpected > 0 && reason === "declined" && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Customer saw {formatCurrency(customerExpected)} — consider a bump.
                      </p>
                    )}

                    {/* AI re-appraisal suggestion — restyled to a calmer
                        muted slab with a thin colored left border. Same
                        accept / dismiss actions as the legacy. */}
                    {suggestion && (() => {
                      const isBump = suggestion.delta > 0;
                      const isAutoApplied = suggestion.status === "auto_applied";
                      const accent = isAutoApplied
                        ? "border-l-emerald-500"
                        : isBump
                        ? "border-l-violet-500"
                        : "border-l-amber-500";
                      return (
                        <div className={`mt-3 rounded-md border border-border border-l-4 ${accent} bg-muted/30 p-2.5`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                              {isAutoApplied ? "AI Auto-Applied" : "AI Recommends"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              · {suggestion.photos_analyzed} {suggestion.photos_analyzed === 1 ? "photo" : "photos"}
                              · {suggestion.ai_confidence ?? "—"}% confidence
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] line-through text-muted-foreground">
                              {suggestion.old_offer ? formatCurrency(suggestion.old_offer) : "—"}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm font-bold text-foreground">
                              {formatCurrency(suggestion.suggested_offer)}
                            </span>
                            <span className={`text-[11px] font-semibold ${isBump ? "text-emerald-600" : "text-amber-600"}`}>
                              {isBump ? "+" : ""}{formatCurrency(suggestion.delta)}
                            </span>
                          </div>
                          <p className="text-[11px] mt-1 leading-relaxed text-muted-foreground">{suggestion.reason}</p>
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

                  {/* Right — single primary action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="h-8 text-[12px]"
                      onClick={() => navigate(`/appraisal/${row.token}`)}
                    >
                      Open appraisal
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    {row.needs_appraisal && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => dismissFromQueue(row)}
                        title="Dismiss from queue"
                        aria-label="Dismiss from queue"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppraiserQueue;
