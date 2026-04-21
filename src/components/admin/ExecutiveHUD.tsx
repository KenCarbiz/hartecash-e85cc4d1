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

const DAYS = 30;

const ExecutiveHUD = () => {
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState<FunnelCounts>({
    submitted: 0, offerMade: 0, appointmentSet: 0, inspectionCompleted: 0, acquired: 0,
  });
  const [declineReasons, setDeclineReasons] = useState<Bucket[]>([]);
  const [competitors, setCompetitors] = useState<Bucket[]>([]);
  const [aged, setAged] = useState<{ count: number; totalAcv: number }>({ count: 0, totalAcv: 0 });
  const [holdingConfig, setHoldingConfig] = useState<TenantHoldingConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

      const [subRes, tenantRes] = await Promise.all([
        supabase
          .from("submissions")
          .select(
            "progress_status, appointment_set, estimated_offer_high, offered_price, declined_reason, competitor_mentioned, acv_value, created_at, inspection_completed_at, check_request_done"
          )
          .eq("dealership_id", tenant.dealership_id)
          .gte("created_at", since),
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

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Executive HUD
        </h2>
        <p className="text-xs text-muted-foreground">Last {DAYS} days. GM + owner + admin view.</p>
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
              { label: "Submitted", value: funnel.submitted, convFrom: null as number | null },
              { label: "Offer", value: funnel.offerMade, convFrom: funnel.submitted },
              { label: "Appt set", value: funnel.appointmentSet, convFrom: funnel.offerMade },
              { label: "Inspected", value: funnel.inspectionCompleted, convFrom: funnel.appointmentSet },
              { label: "Acquired", value: funnel.acquired, convFrom: funnel.inspectionCompleted },
            ].map((step) => (
              <div key={step.label} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {step.label}
                </div>
                <div className="text-2xl font-bold text-card-foreground mt-1">{step.value}</div>
                {step.convFrom !== null && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {pct(step.value, step.convFrom)} step conv
                  </div>
                )}
              </div>
            ))}
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
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Top decline reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {declineReasons.length === 0 ? (
              <p className="text-xs text-muted-foreground">No declines captured yet — BDC is logging reasons in the declined-reason dialog.</p>
            ) : (
              <ul className="space-y-1.5">
                {declineReasons.slice(0, 6).map((b) => (
                  <li key={b.key} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{b.key.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-card-foreground">{b.count}</span>
                  </li>
                ))}
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
              <ul className="space-y-1.5">
                {competitors.slice(0, 6).map((b) => (
                  <li key={b.key} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{b.key}</span>
                    <span className="font-semibold text-card-foreground">{b.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Aged units</div>
                <div className="text-2xl font-bold text-destructive mt-1">{aged.count}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total ACV on lot</div>
                <div className="text-2xl font-bold text-card-foreground mt-1">{formatHoldingMoney(aged.totalAcv)}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Daily burn</div>
                <div className="text-2xl font-bold text-destructive mt-1">{formatHoldingMoney(holding.perDay)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
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
