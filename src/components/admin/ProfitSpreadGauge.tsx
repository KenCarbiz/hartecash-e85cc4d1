import { useMemo } from "react";
import { Target, TrendingUp, TrendingDown, AlertTriangle, DollarSign } from "lucide-react";

interface Props {
  offerHigh: number;
  wholesaleAvg: number;
  tradeinAvg: number;
  retailAvg: number;
  retailClean: number;
  msrp: number;
}

export default function ProfitSpreadGauge({
  offerHigh,
  wholesaleAvg,
  tradeinAvg,
  retailAvg,
  retailClean,
  msrp,
}: Props) {
  const data = useMemo(() => {
    if (!retailAvg || !offerHigh) return null;

    const projectedProfit = retailAvg - offerHigh;
    const profitPct = retailAvg > 0 ? (projectedProfit / retailAvg) * 100 : 0;

    // Position offer on a scale from wholesale to retail
    const rangeMin = Math.min(wholesaleAvg, offerHigh) * 0.9;
    const rangeMax = Math.max(retailClean || retailAvg, msrp || retailAvg) * 1.05;
    const range = rangeMax - rangeMin;

    const pctPos = (val: number) => range > 0 ? Math.max(0, Math.min(100, ((val - rangeMin) / range) * 100)) : 50;

    const offerPos = pctPos(offerHigh);
    const wholesalePos = pctPos(wholesaleAvg);
    const tradeinPos = pctPos(tradeinAvg);
    const retailPos = pctPos(retailAvg);
    const retailCleanPos = pctPos(retailClean || retailAvg);

    // Sweet spot assessment
    let zone: "sweet" | "aggressive" | "conservative" | "overpaying" = "sweet";
    let zoneLabel = "Sweet Spot";
    let zoneColor = "text-green-600";

    if (offerHigh < wholesaleAvg * 0.85) {
      zone = "conservative";
      zoneLabel = "Too Low — Risk Losing Deal";
      zoneColor = "text-amber-600";
    } else if (offerHigh > tradeinAvg * 1.05) {
      zone = "overpaying";
      zoneLabel = "Overpaying — Margin Risk";
      zoneColor = "text-destructive";
    } else if (offerHigh > wholesaleAvg && offerHigh <= tradeinAvg) {
      zone = "sweet";
      zoneLabel = "Sweet Spot";
      zoneColor = "text-green-600";
    } else if (offerHigh <= wholesaleAvg) {
      zone = "aggressive";
      zoneLabel = "Aggressive — May Lose Deal";
      zoneColor = "text-amber-500";
    }

    return {
      projectedProfit,
      profitPct,
      offerPos,
      wholesalePos,
      tradeinPos,
      retailPos,
      retailCleanPos,
      zone,
      zoneLabel,
      zoneColor,
    };
  }, [offerHigh, wholesaleAvg, tradeinAvg, retailAvg, retailClean, msrp]);

  if (!data) return null;

  const markers = [
    { label: "Wholesale", pos: data.wholesalePos, value: wholesaleAvg, color: "bg-blue-500" },
    { label: "Trade-In", pos: data.tradeinPos, value: tradeinAvg, color: "bg-primary" },
    { label: "Retail", pos: data.retailPos, value: retailAvg, color: "bg-green-500" },
  ];

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Profit Spread & Sweet Spot
          </span>
        </div>
        <span className={`text-xs font-bold ${data.zoneColor}`}>{data.zoneLabel}</span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-8 rounded-full overflow-hidden bg-gradient-to-r from-amber-500/20 via-green-500/20 to-destructive/20 border border-border">
        {/* Zone overlay */}
        <div
          className="absolute top-0 bottom-0 bg-green-500/15 border-l border-r border-green-500/30"
          style={{ left: `${data.wholesalePos}%`, width: `${data.tradeinPos - data.wholesalePos}%` }}
        />

        {/* Market markers */}
        {markers.map(m => (
          <div
            key={m.label}
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${m.pos}%` }}
          >
            <div className={`w-0.5 h-full ${m.color} opacity-40`} />
            <div className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-muted-foreground whitespace-nowrap`}>
              {m.label}
            </div>
          </div>
        ))}

        {/* YOUR OFFER pointer */}
        <div
          className="absolute top-0 bottom-0 z-10"
          style={{ left: `${data.offerPos}%` }}
        >
          <div className="relative w-0 h-full">
            <div className="absolute -left-1 top-0 bottom-0 w-2 bg-primary rounded-full shadow-lg shadow-primary/30" />
            <div className="absolute -left-8 -bottom-5 w-16 text-center">
              <span className="text-[10px] font-bold text-primary">Your Offer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profit metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground font-medium">Projected Profit</div>
          <div className={`text-sm font-bold ${data.projectedProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
            {data.projectedProfit >= 0 ? "+" : ""}${data.projectedProfit.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground font-medium">Margin %</div>
          <div className={`text-sm font-bold ${data.profitPct >= 0 ? "text-green-600" : "text-destructive"}`}>
            {data.profitPct.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground font-medium">vs Retail Avg</div>
          <div className="flex items-center justify-center gap-1">
            {data.projectedProfit > 0 ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-destructive" />
            )}
            <span className="text-sm font-bold text-card-foreground">
              ${Math.abs(retailAvg - offerHigh).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Market values reference */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" /> Wholesale: ${wholesaleAvg.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" /> Trade-In: ${tradeinAvg.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" /> Retail: ${retailAvg.toLocaleString()}
        </span>
        {msrp > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-2.5 h-2.5" /> MSRP: ${msrp.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
