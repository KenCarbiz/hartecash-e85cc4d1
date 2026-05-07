import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, Inbox, CalendarCheck, Target, DollarSign, ExternalLink } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

type DealershipRow = { dealership_id: string; display_name: string | null };

type SubmissionAgg = {
  dealership_id: string;
  count_total: number;
  count_this_month: number;
  count_last_month: number;
  count_accepted_this_month: number;
  appointments_this_month: number;
  estimated_revenue_this_month: number;
};

interface Props {
  /** Dealerships in the selected group. */
  rooftops: DealershipRow[];
}

function startOfMonth(offsetMonths = 0): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return d;
}

function delta(current: number, prior: number): { pct: number; sign: "up" | "down" | "flat" } {
  if (prior === 0 && current === 0) return { pct: 0, sign: "flat" };
  if (prior === 0) return { pct: 100, sign: "up" };
  const pct = ((current - prior) / prior) * 100;
  if (pct > 1) return { pct, sign: "up" };
  if (pct < -1) return { pct, sign: "down" };
  return { pct: 0, sign: "flat" };
}

function DeltaBadge({ value, prior }: { value: number; prior: number }) {
  const d = delta(value, prior);
  if (d.sign === "flat") {
    return (
      <span className="inline-flex items-center gap-1 text-micro text-muted-foreground">
        <Minus className="w-3 h-3" /> flat
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-micro font-medium ${
        d.sign === "up" ? "text-success" : "text-red-700"
      }`}
    >
      {d.sign === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(d.pct).toFixed(0)}%
    </span>
  );
}

/**
 * Per-rooftop KPI roll-up for a dealer group. Renders inside the
 * GroupManagement detail view. Pulls aggregates directly from
 * submissions + appointments, scoped to each rooftop's dealership_id
 * within the selected group.
 *
 * Audit context: "Group CFO needs aggregated KPIs across all
 * rooftops" was a yellow flag from the May-2026 multi-tenant audit.
 * This is the customer-facing answer.
 *
 * Metrics per rooftop:
 *   - Leads this month vs last month (% delta)
 *   - Appointments this month
 *   - Conversion = accepted / submissions this month
 *   - Estimated revenue this month (sum of accepted offered_price)
 *
 * Plus a top-line group total row.
 */
const GroupKPISummary = ({ rooftops }: Props) => {
  const [loading, setLoading] = useState(true);
  const [aggs, setAggs] = useState<SubmissionAgg[]>([]);
  const { setViewAsTenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drilling, setDrilling] = useState<string | null>(null);

  const drillInto = async (dealershipId: string, displayName: string) => {
    setDrilling(dealershipId);
    const ok = await setViewAsTenant({
      dealership_id: dealershipId,
      display_name: displayName,
      reason: "Group KPI drill-down — viewing rooftop dashboard from group summary",
    });
    setDrilling(null);
    if (!ok) {
      toast({
        title: "Couldn't switch view",
        description: "Make sure you're a platform admin and the rooftop is active.",
        variant: "destructive",
      });
      return;
    }
    navigate("/admin");
  };

  const monthStart = useMemo(() => startOfMonth(0).toISOString(), []);
  const lastMonthStart = useMemo(() => startOfMonth(-1).toISOString(), []);

  useEffect(() => {
    if (rooftops.length === 0) {
      setAggs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const dealershipIds = rooftops.map((r) => r.dealership_id);

      // Pull all relevant rows once and aggregate in memory. For a 30-
      // rooftop group with ~10k submissions/year this is well under
      // 100ms; if it ever grows, push to a stored aggregate function.
      const [{ data: subRows }, { data: apptRows }] = await Promise.all([
        supabase
          .from("submissions")
          .select("dealership_id, created_at, status, offered_price")
          .in("dealership_id", dealershipIds)
          .gte("created_at", lastMonthStart),
        supabase
          .from("appointments")
          .select("dealership_id, created_at")
          .in("dealership_id", dealershipIds)
          .gte("created_at", monthStart),
      ]);

      if (cancelled) return;

      const byRooftop = new Map<string, SubmissionAgg>();
      for (const r of rooftops) {
        byRooftop.set(r.dealership_id, {
          dealership_id: r.dealership_id,
          count_total: 0,
          count_this_month: 0,
          count_last_month: 0,
          count_accepted_this_month: 0,
          appointments_this_month: 0,
          estimated_revenue_this_month: 0,
        });
      }

      for (const s of (subRows as any[]) ?? []) {
        const agg = byRooftop.get(s.dealership_id);
        if (!agg) continue;
        agg.count_total += 1;
        const t = s.created_at as string;
        if (t >= monthStart) {
          agg.count_this_month += 1;
          if (s.status === "accepted" || s.status === "offer_accepted") {
            agg.count_accepted_this_month += 1;
            const price = Number(s.offered_price ?? 0);
            if (Number.isFinite(price)) agg.estimated_revenue_this_month += price;
          }
        } else if (t >= lastMonthStart && t < monthStart) {
          agg.count_last_month += 1;
        }
      }

      for (const a of (apptRows as any[]) ?? []) {
        const agg = byRooftop.get(a.dealership_id);
        if (!agg) continue;
        agg.appointments_this_month += 1;
      }

      setAggs(Array.from(byRooftop.values()));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [rooftops, monthStart, lastMonthStart]);

  // Group totals.
  const totals = useMemo(() => {
    return aggs.reduce(
      (acc, a) => {
        acc.count_this_month += a.count_this_month;
        acc.count_last_month += a.count_last_month;
        acc.count_accepted_this_month += a.count_accepted_this_month;
        acc.appointments_this_month += a.appointments_this_month;
        acc.estimated_revenue_this_month += a.estimated_revenue_this_month;
        return acc;
      },
      {
        count_this_month: 0,
        count_last_month: 0,
        count_accepted_this_month: 0,
        appointments_this_month: 0,
        estimated_revenue_this_month: 0,
      },
    );
  }, [aggs]);

  if (loading) {
    // Skeleton matches the layout of the loaded state so the page
    // doesn't jump on completion. 4 KPI tiles + a table outline.
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading group KPIs">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-xl bg-card p-4 space-y-2">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-7 w-16 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
          </div>
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                <div className="h-3 w-16 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (rooftops.length === 0) return null;

  const conv =
    totals.count_this_month > 0
      ? (totals.count_accepted_this_month / totals.count_this_month) * 100
      : 0;

  return (
    <div className="space-y-4">
      {/* Group totals — 4 KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <Inbox className="w-3.5 h-3.5" />
            Leads (this month)
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{totals.count_this_month.toLocaleString()}</span>
            <DeltaBadge value={totals.count_this_month} prior={totals.count_last_month} />
          </div>
          <div className="text-micro text-muted-foreground mt-1">
            vs {totals.count_last_month.toLocaleString()} last month
          </div>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <CalendarCheck className="w-3.5 h-3.5" />
            Appointments
          </div>
          <div className="mt-2 text-2xl font-semibold">{totals.appointments_this_month.toLocaleString()}</div>
          <div className="text-micro text-muted-foreground mt-1">scheduled this month</div>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <Target className="w-3.5 h-3.5" />
            Conversion
          </div>
          <div className="mt-2 text-2xl font-semibold">{conv.toFixed(1)}%</div>
          <div className="text-micro text-muted-foreground mt-1">
            {totals.count_accepted_this_month.toLocaleString()} accepted offers
          </div>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <DollarSign className="w-3.5 h-3.5" />
            Pipeline value
          </div>
          <div className="mt-2 text-2xl font-semibold">
            ${totals.estimated_revenue_this_month.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-micro text-muted-foreground mt-1">accepted offers MTD</div>
        </div>
      </div>

      {/* Per-rooftop table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Per-rooftop performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Rooftop</th>
                <th className="text-right px-3 py-2.5 font-medium">Leads MTD</th>
                <th className="text-right px-3 py-2.5 font-medium">Δ</th>
                <th className="text-right px-3 py-2.5 font-medium">Appts</th>
                <th className="text-right px-3 py-2.5 font-medium">Conv %</th>
                <th className="text-right px-3 py-2.5 font-medium">Pipeline $</th>
                <th className="text-right px-5 py-2.5 font-medium" aria-label="Drill into rooftop">{" "}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggs
                .sort((a, b) => b.count_this_month - a.count_this_month)
                .map((a) => {
                  const rooftop = rooftops.find((r) => r.dealership_id === a.dealership_id);
                  const conv =
                    a.count_this_month > 0
                      ? (a.count_accepted_this_month / a.count_this_month) * 100
                      : 0;
                  return (
                    <tr key={a.dealership_id} className="hover:bg-muted/20">
                      <td className="px-5 py-2.5">
                        <div className="font-medium">{rooftop?.display_name || a.dealership_id}</div>
                        <div className="text-micro text-muted-foreground font-mono">{a.dealership_id}</div>
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{a.count_this_month.toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5">
                        <DeltaBadge value={a.count_this_month} prior={a.count_last_month} />
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{a.appointments_this_month.toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">
                        {a.count_this_month > 0 ? `${conv.toFixed(0)}%` : "—"}
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">
                        ${a.estimated_revenue_this_month.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right px-5 py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            drillInto(
                              a.dealership_id,
                              rooftop?.display_name || a.dealership_id,
                            )
                          }
                          disabled={drilling === a.dealership_id}
                          aria-label={`Open ${rooftop?.display_name || a.dealership_id} dashboard`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          {drilling === a.dealership_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <>
                              View <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {aggs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                    <p className="font-medium text-card-foreground">No rooftops attached to this group yet.</p>
                    <p className="text-xs mt-1">Use "Attach a rooftop to this group" below to add the first one.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-micro text-muted-foreground italic">
        Live data — refresh the Group page to recompute. Aggregates from submissions + appointments tables, scoped to this group's dealerships.
      </p>
    </div>
  );
};

export default GroupKPISummary;
