import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, ArrowDown } from "lucide-react";
import type { OfferSettings } from "@/lib/offerCalculator";

interface WaterfallStep {
  label: string;
  value: number;       // the adjustment amount (positive or negative)
  runningTotal: number; // cumulative total after this step
  type: "base" | "add" | "subtract" | "total";
}

interface Props {
  baseValue: number;
  conditionMultiplier: number;
  deductions: number;
  reconCost: number;
  equipmentTotal: number;
  ageTierAdjustment: number;
  mileageTierAdjustment: number;
  regionalPct: number;
  globalPct: number;
  rulesAdjustment: number;
  finalHigh: number;
  floor: number;
  ceiling: number | null;
}

export default function OfferWaterfall({
  baseValue,
  conditionMultiplier,
  deductions,
  reconCost,
  equipmentTotal,
  ageTierAdjustment,
  mileageTierAdjustment,
  regionalPct,
  globalPct,
  rulesAdjustment,
  finalHigh,
  floor,
  ceiling,
}: Props) {
  const steps = useMemo(() => {
    const result: WaterfallStep[] = [];
    let running = baseValue;

    // 1. Base Value
    result.push({ label: "Base Value", value: baseValue, runningTotal: running, type: "base" });

    // 2. Condition
    const condAdj = Math.round(baseValue * conditionMultiplier) - baseValue;
    if (condAdj !== 0) {
      running += condAdj;
      result.push({ label: "Condition", value: condAdj, runningTotal: running, type: condAdj >= 0 ? "add" : "subtract" });
    }

    // 3. Equipment
    if (equipmentTotal !== 0) {
      running += equipmentTotal;
      result.push({ label: "Equipment", value: equipmentTotal, runningTotal: running, type: equipmentTotal >= 0 ? "add" : "subtract" });
    }

    // 4. Deductions
    if (deductions > 0) {
      running -= deductions;
      result.push({ label: "Deductions", value: -deductions, runningTotal: running, type: "subtract" });
    }

    // 5. Recon Cost
    if (reconCost > 0) {
      running -= reconCost;
      result.push({ label: "Recon Cost", value: -reconCost, runningTotal: running, type: "subtract" });
    }

    // 6. Global %
    if (globalPct !== 0) {
      const adj = Math.round(running * (globalPct / 100));
      running += adj;
      result.push({ label: `Global (${globalPct > 0 ? "+" : ""}${globalPct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract" });
    }

    // 7. Regional %
    if (regionalPct !== 0) {
      const adj = Math.round(running * (regionalPct / 100));
      running += adj;
      result.push({ label: `Regional (${regionalPct > 0 ? "+" : ""}${regionalPct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract" });
    }

    // 8. Age Tier
    if (ageTierAdjustment !== 0) {
      const adj = Math.round(running * (ageTierAdjustment / 100));
      running += adj;
      result.push({ label: "Age Tier", value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract" });
    }

    // 9. Mileage Tier (flat)
    if (mileageTierAdjustment !== 0) {
      running += mileageTierAdjustment;
      result.push({ label: "Mileage Tier", value: mileageTierAdjustment, runningTotal: running, type: mileageTierAdjustment >= 0 ? "add" : "subtract" });
    }

    // 10. Rules
    if (rulesAdjustment !== 0) {
      const adj = finalHigh - running; // derive from actual final vs our running
      if (adj !== 0) {
        running += adj;
        result.push({ label: "Rules", value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract" });
      }
    }

    // Floor/ceiling applied
    let clampedRunning = Math.max(running, floor);
    if (ceiling && ceiling > 0) clampedRunning = Math.min(clampedRunning, ceiling);

    // Final
    result.push({ label: "Final Offer", value: finalHigh, runningTotal: finalHigh, type: "total" });

    return result;
  }, [baseValue, conditionMultiplier, deductions, reconCost, equipmentTotal, ageTierAdjustment, mileageTierAdjustment, regionalPct, globalPct, rulesAdjustment, finalHigh, floor, ceiling]);

  // Find max value for scaling
  const maxVal = Math.max(...steps.map(s => Math.max(Math.abs(s.runningTotal), Math.abs(s.value), s.type === "base" ? s.value : 0)));

  return (
    <div className="space-y-1 pt-2">
      <div className="flex items-center gap-1.5 mb-2">
        <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Offer Waterfall</span>
      </div>
      {steps.map((step, i) => {
        const barWidth = maxVal > 0 ? Math.abs(step.type === "total" || step.type === "base" ? step.runningTotal : step.value) / maxVal * 100 : 0;
        const isPositive = step.type === "add";
        const isNegative = step.type === "subtract";
        const isBase = step.type === "base";
        const isTotal = step.type === "total";

        return (
          <div key={i} className="flex items-center gap-2 group">
            {/* Label */}
            <div className="w-24 shrink-0 text-right">
              <span className={`text-[11px] leading-tight ${isTotal ? "font-bold text-card-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>

            {/* Bar */}
            <div className="flex-1 h-6 relative">
              <div
                className={`h-full rounded-sm transition-all duration-300 flex items-center ${
                  isBase ? "bg-primary/20 border border-primary/30" :
                  isTotal ? "bg-primary border border-primary/40" :
                  isPositive ? "bg-green-500/20 border border-green-500/30" :
                  "bg-destructive/20 border border-destructive/30"
                }`}
                style={{ width: `${Math.max(barWidth, 3)}%` }}
              >
                <span className={`text-[10px] font-bold px-1.5 truncate ${
                  isTotal ? "text-primary-foreground" : 
                  isBase ? "text-primary" :
                  isPositive ? "text-green-600 dark:text-green-400" :
                  "text-destructive"
                }`}>
                  {isBase || isTotal
                    ? `$${step.runningTotal.toLocaleString()}`
                    : `${step.value >= 0 ? "+" : ""}$${step.value.toLocaleString()}`
                  }
                </span>
              </div>
            </div>

            {/* Icon */}
            <div className="w-4 shrink-0">
              {isPositive && <TrendingUp className="w-3 h-3 text-green-500" />}
              {isNegative && <TrendingDown className="w-3 h-3 text-destructive" />}
              {(isBase || isTotal) && <Minus className="w-3 h-3 text-muted-foreground" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
