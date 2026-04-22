import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign } from "lucide-react";

interface Props {
  acv: number;
  avgDaysToTurn: number | null;
  floorPlanRatePct: number;
  lotCostPerDay: number;
  projectedProfit: number;
}

export default function CarryingCostPanel({ acv, avgDaysToTurn, floorPlanRatePct, lotCostPerDay, projectedProfit }: Props) {
  if (!avgDaysToTurn || avgDaysToTurn <= 0 || acv <= 0) return null;

  const floorPlanCost = Math.round((acv * (floorPlanRatePct / 100) / 365) * avgDaysToTurn);
  const lotCost = avgDaysToTurn * lotCostPerDay;
  const totalCarrying = floorPlanCost + lotCost;
  const effectiveGross = projectedProfit - totalCarrying;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          Carrying Cost Estimate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Avg Days to Turn</span>
            <span className="font-bold text-card-foreground">{avgDaysToTurn} days</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Floor Plan ({floorPlanRatePct}% APR)</span>
            <span className="font-bold text-destructive">${floorPlanCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Lot Cost (${lotCostPerDay}/day)</span>
            <span className="font-bold text-destructive">${lotCost.toLocaleString()}</span>
          </div>
          <div className="border-t border-border pt-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-card-foreground">Total Carrying Cost</span>
              <span className="font-bold text-destructive">${totalCarrying.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-primary/5 border border-primary/20">
          <span className="font-semibold text-card-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Effective Gross After Carrying
          </span>
          <span className={`font-black text-sm ${effectiveGross >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {effectiveGross >= 0 ? "+" : ""}${effectiveGross.toLocaleString()}
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground">
          Estimated carrying cost at market avg turn ({avgDaysToTurn}d). This reduces your effective gross from ${projectedProfit.toLocaleString()} to ${effectiveGross.toLocaleString()}.
        </p>
      </CardContent>
    </Card>
  );
}
