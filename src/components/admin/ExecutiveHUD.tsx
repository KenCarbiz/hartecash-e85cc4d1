import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3, TrendingUp, Users, DollarSign, Flame, Clock, AlertTriangle, Loader2,
} from "lucide-react";
import { calculateHoldingCost, formatHoldingMoney, type TenantHoldingConfig } from "@/lib/holdingCost";

/**
 * ExecutiveHUD — GM / owner / admin dashboard. Owner-adjacent metrics
 * that GSM and below don't need to see every day.
 *
 * Gated at the sidebar + renderer level to EXECUTIVE_HUD_ROLES
 * (admin, gm, platform_admin).
 *
 * Four panels in the MVP:
 *   1. 30-day acquisition funnel (submissions → appointments → shows
 *      → acquired). Tells the GM where the funnel is actually leaking.
 *   2. Top decline reasons aggregated from the declined_reason field.
 *      Shows which objections cost the dealer the most deals.
 *   3. Top competitors aggregated from competitor_mentioned.
 *      Marketing signal: which competitors are we actually losing
 *      deals to?
 *   4. Aged inventory holding cost summary. Total daily burn + count
 *      of units past the target holding window.
 *
 * Deliberately narrow — full rep-level performance leaderboards and
 * lead-source-ROI dashboards are next iterations.
 */

interface FunnelCounts {
  submitted: number;
  offerMade: number;
  appointmentSet: number;
  inspectionCompleted: number;
  acquired: number;
}

interface Bucket {
  key: string;
  count: number;
}

// User-selectable window. Default 30 days; GMs can switch to short
// pulses (7d) or quarterly views (90d / YTD) without leaving the page.
const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "YTD", days: 0 }, // 0 means use Jan 1 of current year
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]["label"];

function rangeStart(label: RangeKey): Date {
  const opt = RANGE_OPTIONS.find((r) => r.label === label);
  if (!opt) return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (opt.days === 0) {
    // YTD — Jan 1 of the current year, local time.
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  }
  return new Date(Date.now() - opt.days * 24 * 60 * 60 * 1000);
}

type DrillDown =
  | { kind: "progress"; value: string; label?: string; chip?: string }
  | { kind: "decline_reason"; value: string; label?: string }
  | { kind: "competitor"; value: string; label?: string };

interface ExecutiveHUDProps {
  /** Drill-down handler — opens All Leads pre-filtered. Optional so
   *  the HUD still renders when mounted standalone (super-admin view,
   *  storybook). When not provided the tiles render as plain divs. */
  onDrillDown?: (target: DrillDown) => void;
}

const ExecutiveHUD = ({ onDrillDown }: ExecutiveHUDProps = {}) => {
  const { tenant } = useTenant();
  const [range, setRange] = useState<RangeKey>("30d");
  const DAYS = useMemo(() => {
    const opt = RANGE_OPTIONS.find((r) => r.label === range);
    if (!opt) return 30;
    if (opt.days === 0) {
      // YTD day count — used in the subtitle and the holding-cost
      // "average days in inventory" comparison.
      return Math.max(
        1,
        Math.ceil((Date.now() - rangeStart(range).getTime()) / (1000 * 60 * 60 * 24)),
      );
    }
    return opt.days;
  }, [range]);
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState<FunnelCounts>({
    submitted: 0, offerMade: 0, appointmentSet: 0, inspectionCompleted: 0, acquired: 0,
  });
  // Prior period (same length, immediately before) so each funnel
  // tile and decline row can show a "▲ 12% vs prev 30d" delta.
  // Item 25a from the audit: turns the HUD from a vanity dashboard
  // into something a GM can read for direction.
  const [funnelPrev, setFunnelPrev] = useState<FunnelCounts>({
    submitted: 0, offerMade: 0, appointmentSet: 0, inspectionCompleted: 0, acquired: 0,
  });
  const [declineReasons, setDeclineReasons] = useState<Bucket[]>([]);
  const [declinePrev, setDeclinePrev] = useState<Record<string, number>>({});
  const [competitors, setCompetitors] = useState<Bucket[]>([]);
  const [aged, setAged] = useState<{ count: number; totalAcv: number }>({ count: 0, totalAcv: 0 });
  const [holdingConfig, setHoldingConfig] = useState<TenantHoldingConfig | null>(null);
  // Per-rep breakdown — count of appraisals + acceptance + acquisition
  // grouped by submissions.appraised_by (free-text staff identifier set
  // when an offer is finalized). GMs use this to spot who's converting.
  const [repBreakdown, setRepBreakdown] = useState<Array<{
    rep: string;
    appraisals: number;
    accepted: number;
    acquired: number;
  }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = rangeStart(range).toISOString();
      // Prior period of the same length, immediately before `since`,
      // so deltas read "vs prev 30d" rather than "vs all time".
      const sinceMs = new Date(since).getTime();
      const periodMs = Date.now() - sinceMs;
      const prevSince = new Date(sinceMs - periodMs).toISOString();
      const prevUntil = since;

      const [subRes, prevRes, tenantRes] = await Promise.all([
        supabase
          .from("submissions")
          .select(
            "progress_status, appointment_set, estimated_offer_high, offered_price, declined_reason, competitor_mentioned, acv_value, created_at, inspection_completed_at, check_request_done, appraised_by"
          )
          .eq("dealership_id", tenant.dealership_id)
          .gte("created_at", since),
        supabase
          .from("submissions")
          .select(
            "progress_status, appointment_set, estimated_offer_high, offered_price, declined_reason, created_at"
          )
          .eq("dealership_id", tenant.dealership_id)
          .gte("created_at", prevSince)
          .lt("created_at", prevUntil),
        supabase
          .from("tenants")
          .select("floor_plan_rate_annual_pct, overhead_per_day_per_unit, avg_holding_days_target")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const rows = (subRes.data as any[]) || [];

      const fc: FunnelCounts = {
        submitted: rows.length,
        offerMade: rows.filter((r) => r.estimated_offer_high || r.offered_price).length,
        appointmentSet: rows.filter((r) => r.appointment_set).length,
        inspectionCompleted: rows.filter(
          (r) => r.progress_status === "inspection_completed" ||
            r.progress_status === "deal_finalized" ||
            r.progress_status === "check_request_submitted" ||
            r.progress_status === "purchase_complete"
        ).length,
        acquired: rows.filter(
          (r) => r.progress_status === "purchase_complete" ||
            r.progress_status === "check_request_submitted"
        ).length,
      };
      setFunnel(fc);

      // ── Prior-period funnel + decline reasons (for trend deltas) ──
      const prevRows = (prevRes.data as any[]) || [];
      const prevFunnel: FunnelCounts = {
        submitted: prevRows.length,
        offerMade: prevRows.filter((r) => r.estimated_offer_high || r.offered_price).length,
        appointmentSet: prevRows.filter((r) => r.appointment_set).length,
        inspectionCompleted: prevRows.filter(
          (r) => r.progress_status === "inspection_completed" ||
            r.progress_status === "deal_finalized" ||
            r.progress_status === "check_request_submitted" ||
            r.progress_status === "purchase_complete"
        ).length,
        acquired: prevRows.filter(
          (r) => r.progress_status === "purchase_complete" ||
            r.progress_status === "check_request_submitted"
        ).length,
      };
      setFunnelPrev(prevFunnel);

      const prevReasonMap: Record<string, number> = {};
      prevRows.forEach((r) => {
        if (r.declined_reason) {
          prevReasonMap[r.declined_reason] = (prevReasonMap[r.declined_reason] || 0) + 1;
        }
      });
      setDeclinePrev(prevReasonMap);

      // Decline reasons bucket
      const reasonMap: Record<string, number> = {};
      rows.forEach((r) => {
        if (r.declined_reason) {
          reasonMap[r.declined_reason] = (reasonMap[r.declined_reason] || 0) + 1;
        }
      });
      setDeclineReasons(
        Object.entries(reasonMap)
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count)
      );

      // Competitor bucket
      const competitorMap: Record<string, number> = {};
      rows.forEach((r) => {
        if (r.competitor_mentioned) {
          const name = String(r.competitor_mentioned).trim().toLowerCase();
          competitorMap[name] = (competitorMap[name] || 0) + 1;
        }
      });
      setCompetitors(
        Object.entries(competitorMap)
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count)
      );

      setHoldingConfig((tenantRes.data as any) ?? null);

      // Aged inventory — purchased vehicles still on the lot past
      // avg_holding_days_target. Approximate days_in_stock as (now -
      // check_request_done / purchase_complete transition). Without a
      // dedicated inventory table this is a simple proxy.
      const target = ((tenantRes.data as any)?.avg_holding_days_target as number) ?? 45;
      const inventoryRows = rows.filter(
        (r) => r.check_request_done && r.acv_value && r.progress_status !== "retail_sold"
      );
      const now = Date.now();
      const agedRows = inventoryRows.filter((r) => {
        const acquired = new Date(r.inspection_completed_at || r.created_at).getTime();
        const daysIn = (now - acquired) / (24 * 60 * 60 * 1000);
        return daysIn > target;
      });
      setAged({
        count: agedRows.length,
        totalAcv: agedRows.reduce((sum, r) => sum + Number(r.acv_value || 0), 0),
      });

      // Per-rep breakdown — group submissions with a non-null
      // appraised_by, count their appraisals (any offer set),
      // acceptance (price_agreed / offer_accepted forward), and
      // acquisition (purchase_complete / check_request_submitted).
      const ACCEPTED_STATUSES = new Set([
        "offer_accepted",
        "price_agreed",
        "deal_finalized",
        "title_ownership_verified",
        "check_request_submitted",
        "purchase_complete",
      ]);
      const ACQUIRED_STATUSES = new Set([
        "check_request_submitted",
        "purchase_complete",
      ]);
      const repMap: Record<string, { appraisals: number; accepted: number; acquired: number }> = {};
      rows.forEach((r) => {
        const rep = (r as { appraised_by?: string | null }).appraised_by;
        if (!rep || typeof rep !== "string" || !rep.trim()) return;
        const key = rep.trim();
        if (!repMap[key]) repMap[key] = { appraisals: 0, accepted: 0, acquired: 0 };
        repMap[key].appraisals += 1;
        if (ACCEPTED_STATUSES.has(r.progress_status)) repMap[key].accepted += 1;
        if (ACQUIRED_STATUSES.has(r.progress_status)) repMap[key].acquired += 1;
      });
      setRepBreakdown(
        Object.entries(repMap)
          .map(([rep, v]) => ({ rep, ...v }))
          .sort((a, b) => b.appraisals - a.appraisals)
      );

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id, range]);

  const holding = useMemo(() => calculateHoldingCost(aged.totalAcv, holdingConfig), [aged.totalAcv, holdingConfig]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading executive metrics…
      </div>
    );
  }

  const pct = (num: number, denom: number) =>
    denom > 0 ? `${Math.round((num / denom) * 100)}%` : "—";

  // Trend delta vs the immediately-preceding period of the same
  // length. Returns null when there's nothing to compare against
  // (zero in both periods, or very low absolute counts where a %
  // is misleading) so the tile stays uncluttered. Direction is the
  // raw delta sign — for decline reasons the chip is colored
  // red-on-up + green-on-down (more declines = bad), for funnel
  // tiles it's the opposite.
  const trend = (current: number, previous: number) => {
    if (current === 0 && previous === 0) return null;
    if (current < 3 && previous < 3) return null;
    if (previous === 0) return { dir: "up" as const, pct: 100 };
    const diff = Math.round(((current - previous) / previous) * 100);
    if (diff === 0) return null;
    return { dir: diff > 0 ? ("up" as const) : ("down" as const), pct: Math.abs(diff) };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Executive HUD
          </h2>
          <p className="text-xs text-muted-foreground">
            {range === "YTD"
              ? `Year-to-date — ${DAYS} day${DAYS === 1 ? "" : "s"}.`
              : `Last ${DAYS} days.`}{" "}
            GM + owner + admin view.
          </p>
        </div>
        {/* Range toggle */}
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setRange(opt.label)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                range === opt.label
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Acquisition funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {[
              // Each tile carries the drill-down it should fire when
              // clicked + the previous-period value for the trend chip.
              { label: "Submitted", value: funnel.submitted,           prev: funnelPrev.submitted,           convFrom: null as number | null, drill: null as DrillDown | null },
              { label: "Offer",     value: funnel.offerMade,           prev: funnelPrev.offerMade,           convFrom: funnel.submitted,           drill: { kind: "progress", value: "offer_sent",           label: "Offer sent",          chip: "all" } as DrillDown },
              { label: "Appt set",  value: funnel.appointmentSet,      prev: funnelPrev.appointmentSet,      convFrom: funnel.offerMade,           drill: { kind: "progress", value: "appointment_set",      label: "Appointment set",     chip: "appointments" } as DrillDown },
              { label: "Inspected", value: funnel.inspectionCompleted, prev: funnelPrev.inspectionCompleted, convFrom: funnel.appointmentSet,      drill: { kind: "progress", value: "inspection_completed", label: "Inspection completed" } as DrillDown },
              { label: "Acquired",  value: funnel.acquired,            prev: funnelPrev.acquired,            convFrom: funnel.inspectionCompleted, drill: { kind: "progress", value: "purchase_complete",    label: "Acquired" } as DrillDown },
            ].map((step) => {
              const clickable = !!(step.drill && onDrillDown);
              const t = trend(step.value, step.prev);
              return (
                <button
                  key={step.label}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onDrillDown?.(step.drill!)}
                  className={`rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors ${
                    clickable ? "hover:bg-muted/60 cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                      {step.label}
                    </div>
                    {t && (
                      <span
                        className={`text-micro font-bold tabular-nums ${
                          t.dir === "up" ? "text-success" : "text-destructive"
                        }`}
                        title={`vs prior ${DAYS}d: ${step.prev}`}
                      >
                        {t.dir === "up" ? "▲" : "▼"} {t.pct}%
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-card-foreground mt-1">{step.value}</div>
                  {step.convFrom !== null && (
                    <div className="text-micro text-muted-foreground mt-0.5">
                      {pct(step.value, step.convFrom)} step conv
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {funnel.submitted > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              End-to-end acquisition rate:{" "}
              <strong className="text-foreground">{pct(funnel.acquired, funnel.submitted)}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decline reasons + Competitors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-warning" /> Top decline reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {declineReasons.length === 0 ? (
              <p className="text-xs text-muted-foreground">No declines captured yet — BDC is logging reasons in the declined-reason dialog.</p>
            ) : (
              <ul className="space-y-1">
                {declineReasons.slice(0, 6).map((b) => {
                  const t = trend(b.count, declinePrev[b.key] || 0);
                  return (
                  <li key={b.key}>
                    <button
                      type="button"
                      disabled={!onDrillDown}
                      onClick={() => onDrillDown?.({ kind: "decline_reason", value: b.key, label: b.key.replace(/_/g, " ") })}
                      className={`w-full flex items-center justify-between text-sm rounded-md px-2 py-1.5 transition-colors ${
                        onDrillDown ? "hover:bg-muted/60 cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <span className="capitalize">{b.key.replace(/_/g, " ")}</span>
                      <span className="flex items-center gap-2">
                        {t && (
                          // Decline trends are inverse: more declines
                          // is bad. Up = red (destructive), down = green.
                          <span
                            className={`text-micro font-bold tabular-nums ${
                              t.dir === "up" ? "text-destructive" : "text-success"
                            }`}
                            title={`vs prior ${DAYS}d: ${declinePrev[b.key] || 0}`}
                          >
                            {t.dir === "up" ? "▲" : "▼"} {t.pct}%
                          </span>
                        )}
                        <span className="font-semibold text-card-foreground tabular-nums">{b.count}</span>
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" /> Competitors mentioned
            </CardTitle>
          </CardHeader>
          <CardContent>
            {competitors.length === 0 ? (
              <p className="text-xs text-muted-foreground">No competitor mentions captured yet.</p>
            ) : (
              <ul className="space-y-1">
                {competitors.slice(0, 6).map((b) => (
                  <li key={b.key}>
                    <button
                      type="button"
                      disabled={!onDrillDown}
                      onClick={() => onDrillDown?.({ kind: "competitor", value: b.key, label: b.key })}
                      className={`w-full flex items-center justify-between text-sm rounded-md px-2 py-1.5 transition-colors ${
                        onDrillDown ? "hover:bg-muted/60 cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <span className="capitalize">{b.key}</span>
                      <span className="font-semibold text-card-foreground">{b.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-rep breakdown — appraisals → acceptance → acquisition. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-primary" /> Per-rep performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {repBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No appraisals attributed to a rep yet for this window. Reps need to set <span className="font-mono">appraised_by</span> when finalizing an offer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="text-left font-medium py-1.5 pr-3">Rep</th>
                    <th className="text-right font-medium py-1.5 pr-3">Appraisals</th>
                    <th className="text-right font-medium py-1.5 pr-3">Accepted</th>
                    <th className="text-right font-medium py-1.5 pr-3">Accept rate</th>
                    <th className="text-right font-medium py-1.5 pr-3">Acquired</th>
                    <th className="text-right font-medium py-1.5">Conv. rate</th>
                  </tr>
                </thead>
                <tbody>
                  {repBreakdown.map((row) => (
                    <tr key={row.rep} className="border-b border-border/20 last:border-0">
                      <td className="py-1.5 pr-3 font-medium">{row.rep}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row.appraisals}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row.accepted}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                        {pct(row.accepted, row.appraisals)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row.acquired}</td>
                      <td className="py-1.5 text-right tabular-nums text-success font-semibold">
                        {pct(row.acquired, row.appraisals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aged inventory holding cost */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-destructive" /> Aged inventory — carrying cost burn
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!holding.configured ? (
            <p className="text-xs text-muted-foreground">
              Set your floor-plan rate in System Settings to see holding-cost totals.
            </p>
          ) : aged.count === 0 ? (
            <p className="text-xs text-success">No aged units past your {holdingConfig?.avg_holding_days_target ?? 45}-day target. Clean lot.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">Aged units</div>
                <div className="text-2xl font-bold text-destructive mt-1">{aged.count}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">Total ACV on lot</div>
                <div className="text-2xl font-bold text-card-foreground mt-1">{formatHoldingMoney(aged.totalAcv)}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">Daily burn</div>
                <div className="text-2xl font-bold text-destructive mt-1">{formatHoldingMoney(holding.perDay)}</div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {formatHoldingMoney(holding.atTarget)} at target
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground pt-2">
        <DollarSign className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Rep-level performance leaderboards, lead-source ROI, and CSI trends are queued for the next GM HUD iteration.
        </span>
      </div>
    </div>
  );
};

export default ExecutiveHUD;
