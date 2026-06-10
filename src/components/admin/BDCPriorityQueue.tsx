import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, MessageSquare } from "lucide-react";
import { scoreBdcLead, type ScoreInputs } from "@/lib/bdcLeadScore";
import { formatPhone, cn } from "@/lib/utils";
import { clickToDial } from "@/lib/clickToDial";

/**
 * BDCPriorityQueue — the "who should I call NEXT?" list for BDC reps.
 *
 * Inclusion logic (per business spec):
 *   - Anyone with an offer (offered_price OR estimated_offer_high) who
 *     hasn't accepted yet — BDC's job is to close the loop within
 *     1 hour during operating hours.
 *   - Customers who accepted but haven't scheduled an appointment —
 *     re-engage to book.
 *   - Orphan accounts (last_outreach_at older than 14 days, not
 *     declined-final, not booked) — quarterly re-poke.
 *   - Excludes purchased / dead / final-state leads.
 *
 * Layout:
 *   - Header + count subline ("N leads ranked by urgency")
 *   - Four KPI tiles: Call now (score ≥80, red), Today (65-80, orange),
 *     Later (<65, black), SLA breach (>2h open without outreach, blue)
 *   - Single ranked QUEUE list (no per-band card grouping). Each row
 *     is avatar + status pill + name + score + vehicle / phone +
 *     subline ("Arrived · On the lot" / "Keep warm" / "SLA breach"
 *     etc) + Call (dark) + SMS icon.
 *
 * Role-gated at the sidebar level — shown to sales_bdc,
 * internet_manager, and admin.
 */

interface Lead extends ScoreInputs {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  is_hot_lead?: boolean | null;
  status_updated_at?: string | null;
  internal_notes?: string | null;
  assigned_bdc_rep_id?: string | null;
}

const FINAL_STATUSES = new Set([
  "purchase_complete", "deal_finalized", "check_request_submitted",
  "title_ownership_verified", "dead_lead", "partial",
]);

const SLA_BREACH_HOURS = 2;

const initialsOf = (name: string | null) =>
  (name || "??")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

const ymm = (l: Lead) =>
  [l.vehicle_year, l.vehicle_make, l.vehicle_model].filter(Boolean).join(" ") || "Vehicle TBD";

const hoursOpen = (created_at: string) =>
  Math.max(0, (Date.now() - new Date(created_at).getTime()) / 3_600_000);

// Compact "3h ago" / "2d ago" formatter for the row's last-touch line.
const fmtAgo = (iso: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1)        return "just now";
  if (minutes < 60)       return `${minutes}m ago`;
  if (minutes < 60 * 24)  return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (60 * 24))}d ago`;
};

// Status pill: derive from progress_status with a few hot-state overrides
const pillFor = (l: Lead): { label: string; cls: string; dot: string } | null => {
  if (l.progress_status === "customer_arrived")
    return { label: "Arrived", cls: "bg-destructive/10 text-destructive", dot: "bg-destructive/100" };
  if (l.progress_status === "on_the_way")
    return { label: "On the way", cls: "bg-warning/15 text-warning", dot: "" };
  if (l.progress_status === "offer_accepted" || l.progress_status === "price_agreed")
    return { label: "Offer accepted", cls: "bg-success/15 text-success", dot: "bg-success" };
  if (l.progress_status === "inspection_completed" || l.progress_status === "appraisal_completed")
    return { label: "Inspected", cls: "bg-info/15 text-info", dot: "bg-info" };
  if (l.progress_status === "contacted")
    return { label: "Contacted", cls: "bg-info/15 text-info", dot: "bg-info" };
  if (l.progress_status === "new")
    return { label: "New", cls: "bg-muted text-muted-foreground", dot: "" };
  if (l.is_hot_lead)
    return { label: "Hot", cls: "bg-destructive/10 text-destructive", dot: "bg-destructive/100" };
  return null;
};

// Per-row subline — gives the BDC rep a one-glance "why this row".
const sublineFor = (l: Lead, isSlaBreach: boolean): { text: string; cls: string } => {
  if (l.progress_status === "customer_arrived")
    return { text: "Arrived · On the lot", cls: "text-destructive font-semibold" };
  if (l.progress_status === "on_the_way")
    return { text: "On the way · Prep file", cls: "text-warning font-semibold" };
  if (l.progress_status === "offer_accepted" || l.progress_status === "price_agreed")
    return { text: "Accepted · Book the appointment", cls: "text-success font-semibold" };
  if (isSlaBreach)
    return { text: "SLA breach · Call immediately", cls: "text-info font-semibold" };
  if (l.appointment_set)
    return { text: "Booked · Confirm + remind", cls: "text-muted-foreground" };
  return { text: "Keep warm", cls: "text-warning font-semibold" };
};

const BDCPriorityQueue = ({ onOpenSubmission }: { onOpenSubmission?: (id: string) => void }) => {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // user_id -> display label, for the assigned-rep chip on each row.
  // Populated lazily from get_all_staff so we don't pay the cost
  // until there's at least one assigned row in the result set.
  const [staffLabels, setStaffLabels] = useState<Record<string, string>>({});
  // Tracks which rows are mid-claim so the button can show a spinner
  // and we don't fire two RPCs against the same lead.
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc(
        "get_all_staff",
        { _dealership_id: tenant.dealership_id } as never,
      );
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      for (const row of data as unknown as Array<{ user_id: string; display_name: string | null; email?: string | null }>) {
        map[row.user_id] = row.display_name || row.email || row.user_id.slice(0, 8);
      }
      setStaffLabels(map);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  // Claim an unclaimed lead OR re-claim an already-claimed one for
  // the current user. Writes through assign_submission_user so the
  // activity_log gets an audit row.
  const claimLead = async (leadId: string) => {
    if (!currentUserId) return;
    setClaiming((p) => ({ ...p, [leadId]: true }));
    try {
      await supabase.rpc(
        "assign_submission_user",
        { _submission_id: leadId, _role: "bdc_rep", _user_id: currentUserId } as never,
      );
      setRows((prev) => prev.map((r) => r.id === leadId ? { ...r, assigned_bdc_rep_id: currentUserId } : r));
    } finally {
      setClaiming((p) => ({ ...p, [leadId]: false }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, is_hot_lead, dealership_id, created_at, status_updated_at, offered_price, estimated_offer_high, appointment_set, progress_status, declined_reason, customer_walk_away_number, competitor_mentioned, portal_view_count, hot_followup_2h_sent_at, last_outreach_at, internal_notes, assigned_bdc_rep_id",
        )
        .eq("dealership_id", tenant.dealership_id)
        .gte("created_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .limit(300);
      if (!cancelled) {
        setRows((data as never as Lead[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant.dealership_id]);

  // Filter to BDC-relevant rows + score them.
  const scored = useMemo(() => {
    return rows
      .filter((l) => {
        if (l.progress_status && FINAL_STATUSES.has(l.progress_status)) return false;
        const hasOffer =
          (l.offered_price && l.offered_price > 0) ||
          (l.estimated_offer_high && l.estimated_offer_high > 0);
        const accepted =
          l.progress_status === "offer_accepted" || l.progress_status === "price_agreed";
        // Three buckets BDC handles: offered-not-accepted, accepted-no-appt, orphan-stale.
        if (hasOffer && !accepted) return true;
        if (accepted && !l.appointment_set) return true;
        // Orphan / cold re-touch: open lead, no appointment, last_outreach old.
        if (!l.appointment_set) {
          const out = l.last_outreach_at
            ? hoursOpen(l.last_outreach_at) / 24
            : hoursOpen(l.created_at) / 24;
          if (out > 14) return true;
        }
        return false;
      })
      .map((lead) => ({ lead, result: scoreBdcLead(lead) }))
      .sort((a, b) => b.result.score - a.result.score);
  }, [rows]);

  // Per-row classification into one of the four KPI buckets.
  const classify = (
    s: { lead: Lead; result: ReturnType<typeof scoreBdcLead> },
  ): "now" | "today" | "later" | "sla" => {
    const isSla =
      hoursOpen(s.lead.created_at) > SLA_BREACH_HOURS &&
      !s.lead.last_outreach_at &&
      !s.lead.appointment_set;
    if (isSla) return "sla";
    if (s.result.score >= 80) return "now";
    if (s.result.score >= 65) return "today";
    return "later";
  };

  const counts = useMemo(() => {
    const c = { now: 0, today: 0, later: 0, sla: 0 };
    for (const e of scored) c[classify(e)]++;
    return c;
  }, [scored]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-card-foreground">BDC priority queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {scored.length} {scored.length === 1 ? "lead" : "leads"} ranked by urgency. Work top to bottom.
        </p>
      </header>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Call now" value={counts.now} sub="score ≥ 80" valueClass="text-destructive" />
        <Tile label="Today" value={counts.today} sub="score 65–80" valueClass="text-warning" />
        <Tile label="Later" value={counts.later} sub="score < 65" />
        <Tile label="SLA breach" value={counts.sla} sub="> 2h open" valueClass="text-info" />
      </section>

      {/* Queue */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Queue</h2>
        </div>
        {loading ? (
          <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="w-4 h-4 animate-spin" />
            Scoring leads…
          </div>
        ) : scored.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground text-center">
            No leads need a call. Quiet day at the desk.
          </div>
        ) : (
          <div className="space-y-2">
            {scored.map((entry) => {
              const { lead, result } = entry;
              const isSla = classify(entry) === "sla";
              const pill = pillFor(lead);
              const subline = sublineFor(lead, isSla);
              return (
                <div
                  key={lead.id}
                  className={cn(
                    "rounded-lg border bg-card hover:bg-muted/30 transition-colors p-4 flex items-center gap-4",
                    lead.progress_status === "customer_arrived" && "border-l-4 border-l-destructive bg-destructive/10 hover:bg-destructive/10/70",
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                    {initialsOf(lead.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {pill && (
                        <span className={cn("text-micro font-bold rounded px-2 py-0.5 inline-flex items-center gap-1.5", pill.cls)}>
                          {pill.dot && <span className={cn("w-1.5 h-1.5 rounded-full", pill.dot)} />}
                          {pill.label}
                        </span>
                      )}
                      <span className="text-sm font-bold text-card-foreground truncate">{lead.name || "Unnamed"}</span>
                      <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 rounded-full bg-muted text-foreground text-[11px] font-bold">
                        {result.score}
                      </span>
                      {/* Assignment chip — shows who's working this lead.
                          Click to claim if unassigned (current user
                          becomes the assigned rep + an audit row lands
                          in activity_log via assign_submission_user). */}
                      {lead.assigned_bdc_rep_id ? (
                        <span
                          className={cn(
                            "text-micro font-bold rounded-full px-2 py-0.5 inline-flex items-center gap-1",
                            lead.assigned_bdc_rep_id === currentUserId
                              ? "bg-info/10 text-info border border-info/30"
                              : "bg-muted text-muted-foreground",
                          )}
                          title={lead.assigned_bdc_rep_id === currentUserId ? "Yours" : `Working: ${staffLabels[lead.assigned_bdc_rep_id] || "Another rep"}`}
                        >
                          {lead.assigned_bdc_rep_id === currentUserId
                            ? "You"
                            : staffLabels[lead.assigned_bdc_rep_id]?.split(" ")[0] || "Rep"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => claimLead(lead.id)}
                          disabled={!currentUserId || claiming[lead.id]}
                          className="text-micro font-bold rounded-full px-2 py-0.5 inline-flex items-center gap-1 border border-dashed border-border text-muted-foreground hover:border-info hover:text-info disabled:opacity-50 transition-colors"
                          title="Claim this lead — you become the assigned rep"
                        >
                          {claiming[lead.id] ? "…" : "Claim"}
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {ymm(lead)}
                      {lead.phone && <> · {formatPhone(lead.phone)}</>}
                    </div>
                    <div className={cn("text-caption mt-1", subline.cls)}>{subline.text}</div>
                    {/* Last-touch + last-note line. Eliminates the
                        "did anyone touch this recently?" guesswork the
                        rep gets today; reduces double-dialing. Note
                        preview is truncated to 90 chars to keep rows
                        compact. */}
                    {(lead.last_outreach_at || lead.internal_notes) && (
                      <div className="text-[11px] text-muted-foreground mt-1 truncate">
                        {lead.last_outreach_at && (
                          <span>
                            <span className="font-semibold">Last touch:</span> {fmtAgo(lead.last_outreach_at)}
                          </span>
                        )}
                        {lead.last_outreach_at && lead.internal_notes && <span className="opacity-50"> · </span>}
                        {lead.internal_notes && (
                          <span title={lead.internal_notes}>
                            <span className="font-semibold">Note:</span> {lead.internal_notes.length > 90
                              ? `${lead.internal_notes.slice(0, 90)}…`
                              : lead.internal_notes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.phone ? (
                      <>
                        <Button
                          className="h-9 bg-foreground hover:bg-foreground text-white gap-1.5"
                          onClick={() => clickToDial(lead.id)}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Call
                        </Button>
                        {/* Text — opens the customer file inline (which
                            auto-scrolls to the Comms card for BDC reps
                            via the viewerRole anchor system). The legacy
                            sms:<phone> href bypassed the platform's
                            compliance log and ConversationThread,
                            creating TCPA risk. Now every text goes
                            through the in-app threaded surface. */}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          aria-label="Text via customer file"
                          onClick={() => onOpenSubmission && onOpenSubmission(lead.id)}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-9"
                        onClick={() => onOpenSubmission && onOpenSubmission(lead.id)}
                      >
                        Open file
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

function Tile({ label, value, sub, valueClass = "" }: { label: string; value: number; sub: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-5">
      <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{label}</div>
      <div className={cn("text-3xl font-bold mt-2", valueClass)}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

export default BDCPriorityQueue;
