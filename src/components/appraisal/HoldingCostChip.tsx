import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, Settings } from "lucide-react";
import { calculateHoldingCost, formatHoldingMoney, type TenantHoldingConfig } from "@/lib/holdingCost";

/**
 * HoldingCostChip — shows the GM / owner what this acquisition will
 * cost per day and over the target holding window. Helps the desk
 * reason about bumps: "if I pay $200 more but turn it in 20 days
 * instead of 40, I save $X in carrying cost."
 *
 * Gated to GM / admin via the parent — this component doesn't gate
 * itself so it stays reusable from anywhere that passes an ACV.
 *
 * Renders null until the tenant config loads and we have an ACV to
 * reason about. If the floor-plan rate isn't configured we render a
 * gentle "configure rate" hint instead of silent nothing.
 */

interface Props {
  acv: number | null | undefined;
  daysInStock?: number | null;
}

const HoldingCostChip = ({ acv, daysInStock }: Props) => {
  const { tenant } = useTenant();
  const [config, setConfig] = useState<TenantHoldingConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tenants")
        .select("floor_plan_rate_annual_pct, overhead_per_day_per_unit, avg_holding_days_target")
        .eq("dealership_id", tenant.dealership_id)
        .maybeSingle();
      if (cancelled) return;
      setConfig((data as any) ?? null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  if (!loaded) return null;
  if (!acv || acv <= 0) return null;

  const breakdown = calculateHoldingCost(acv, config);

  // Rate not configured — show a small hint so the GM knows to set it
  // in system settings, but don't pretend to have a cost answer.
  if (!breakdown.configured) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            Holding Cost
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg bg-muted/30 border border-dashed border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Settings className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Set your floor-plan rate in System Settings to see per-day carrying cost on every acquisition.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const target = config?.avg_holding_days_target ?? 45;
  const aged = daysInStock != null && breakdown.isAged(daysInStock);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          Holding Cost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Per Day</div>
            <div className="text-base font-bold text-card-foreground">{formatHoldingMoney(breakdown.perDay)}</div>
            {breakdown.perDayOverhead > 0 && (
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {formatHoldingMoney(breakdown.perDayInterest)} interest + {formatHoldingMoney(breakdown.perDayOverhead)} overhead
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">At {target}d target</div>
            <div className="text-base font-bold text-card-foreground">{formatHoldingMoney(breakdown.atTarget)}</div>
          </div>
        </div>
        {daysInStock != null && daysInStock > 0 && (
          <div
            className={`rounded-lg border p-2.5 flex items-center justify-between ${
              aged
                ? "border-destructive/30 bg-destructive/10"
                : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {aged && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Accrued · {daysInStock}d in stock
              </span>
            </div>
            <span className={`text-base font-bold ${aged ? "text-destructive" : "text-card-foreground"}`}>
              {formatHoldingMoney(breakdown.atDays(daysInStock))}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HoldingCostChip;
