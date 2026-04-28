import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, MessageSquare } from "lucide-react";
import { scoreBdcLead, type ScoreInputs } from "@/lib/bdcLeadScore";
import { formatPhone, cn } from "@/lib/utils";

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

// Status pill: derive from progress_status with a few hot-state overrides
const pillFor = (l: Lead): { label: string; cls: string; dot: string } | null => {
  if (l.progress_status === "customer_arrived")
    return { label: "Arrived", cls: "bg-red-100 text-red-700", dot: "bg-red-500" };
  if (l.progress_status === "on_the_way")
    return { label: "On the way", cls: "bg-amber-100 text-amber-700", dot: "" };
  if (l.progress_status === "offer_accepted" || l.progress_status === "price_agreed")
    return { label: "Offer accepted", cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" };
  if (l.progress_status === "inspection_completed" || l.progress_status === "appraisal_completed")
    return { label: "Inspected", cls: "bg-blue-100 text-blue-700", dot: "bg-blue-500" };
  if (l.progress_status === "contacted")
    return { label: "Contacted", cls: "bg-blue-100 text-blue-700", dot: "bg-blue-500" };
  if (l.progress_status === "new")
    return { label: "New", cls: "bg-muted text-muted-foreground", dot: "" };
  if (l.is_hot_lead)
    return { label: "Hot", cls: "bg-red-100 text-red-700", dot: "bg-red-500" };
  return null;
};

// Per-row subline — gives the BDC rep a one-glance "why this row".
const sublineFor = (l: Lead, isSlaBreach: boolean): { text: string; cls: string } => {
  if (l.progress_status === "customer_arrived")
    return { text: "Arrived · On the lot", cls: "text-red-600 font-semibold" };
  if (l.progress_status === "on_the_way")
    return { text: "On the way · Prep file", cls: "text-amber-600 font-semibold" };
  if (l.progress_status === "offer_accepted" || l.progress_status === "price_agreed")
    return { text: "Accepted · Book the appointment", cls: "text-emerald-700 font-semibold" };
  if (isSlaBreach)
    return { text: "SLA breach · Call immediately", cls: "text-blue-700 font-semibold" };
  if (l.appointment_set)
    return { text: "Booked · Confirm + remind", cls: "text-muted-foreground" };
  return { text: "Keep warm", cls: "text-orange-600 font-semibold" };
};

const BDCPriorityQueue = ({ onOpenSubmission }: { onOpenSubmission?: (id: string) => void }) => {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, is_hot_lead, dealership_id, created_at, status_updated_at, offered_price, estimated_offer_high, appointment_set, progress_status, declined_reason, customer_walk_away_number, competitor_mentioned, portal_view_count, hot_followup_2h_sent_at",
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
        <Tile label="Call now" value={counts.now} sub="score ≥ 80" valueClass="text-red-600" />
        <Tile label="Today" value={counts.today} sub="score 65–80" valueClass="text-orange-500" />
        <Tile label="Later" value={counts.later} sub="score < 65" />
        <Tile label="SLA breach" value={counts.sla} sub="> 2h open" valueClass="text-blue-600" />
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
                    lead.progress_status === "customer_arrived" && "border-l-4 border-l-red-500 bg-red-50 hover:bg-red-100/70",
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                    {initialsOf(lead.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {pill && (
                        <span className={cn("text-[10px] font-bold rounded px-2 py-0.5 inline-flex items-center gap-1.5", pill.cls)}>
                          {pill.dot && <span className={cn("w-1.5 h-1.5 rounded-full", pill.dot)} />}
                          {pill.label}
                        </span>
                      )}
                      <span className="text-sm font-bold text-card-foreground truncate">{lead.name || "Unnamed"}</span>
                      <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 rounded-full bg-muted text-foreground text-[11px] font-bold">
                        {result.score}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {ymm(lead)}
                      {lead.phone && <> · {formatPhone(lead.phone)}</>}
                    </div>
                    <div className={cn("text-[12px] mt-1", subline.cls)}>{subline.text}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.phone ? (
                      <>
                        <a href={`tel:${lead.phone}`}>
                          <Button className="h-9 bg-slate-900 hover:bg-slate-800 text-white gap-1.5">
                            <Phone className="w-3.5 h-3.5" />
                            Call
                          </Button>
                        </a>
                        <a href={`sms:${lead.phone}`} aria-label="Text">
                          <Button variant="outline" size="icon" className="h-9 w-9">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </a>
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
