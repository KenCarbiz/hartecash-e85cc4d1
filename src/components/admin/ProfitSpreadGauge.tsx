import { useMemo } from "react";
import { Target, TrendingUp, TrendingDown, ShieldCheck, AlertTriangle, BarChart3 } from "lucide-react";

interface Props {
  offerHigh: number;
  wholesaleAvg: number;
  tradeinAvg: number;
  retailAvg: number;
  msrp: number;
  retailClean?: number;
  wholesaleRough?: number;
  soldAvg?: number | null;
  closestCompPrice?: number | null;
  retailListings?: { avgPrice?: number; medianPrice?: number; count?: number } | null;
}

export default function ProfitSpreadGauge({
  offerHigh,
  wholesaleAvg,
  tradeinAvg,
  retailAvg,
  msrp,
  retailClean,
  wholesaleRough,
  soldAvg,
  closestCompPrice,
  retailListings,
}: Props) {
  const data = useMemo(() => {
    if (!retailAvg || !offerHigh) return null;

    const projectedProfit = retailAvg - offerHigh;
    const profitPct = retailAvg > 0 ? (projectedProfit / retailAvg) * 100 : 0;

    // Build all value points for the gauge — MSRP excluded from scale
    const allValues = [wholesaleAvg, tradeinAvg, retailAvg, offerHigh];
    if (wholesaleRough && wholesaleRough > 0) allValues.push(wholesaleRough);
    if (retailClean && retailClean > 0) allValues.push(retailClean);
    if (closestCompPrice && closestCompPrice > 0) allValues.push(closestCompPrice);
    if (soldAvg && soldAvg > 0) allValues.push(soldAvg);
    if (retailListings?.avgPrice) allValues.push(retailListings.avgPrice);

    const rangeMin = Math.min(...allValues) * 0.88;
    const rangeMax = Math.max(...allValues) * 1.06;
    const range = rangeMax - rangeMin;

    const pctPos = (val: number) =>
      range > 0 ? Math.max(1, Math.min(99, ((val - rangeMin) / range) * 100)) : 50;

    // Sweet spot assessment
    let zone: "sweet" | "aggressive" | "conservative" | "overpaying" = "sweet";
    let zoneLabel = "Sweet Spot";
    let zoneIcon = ShieldCheck;
    let zoneBg = "from-green-500/10 to-green-500/5";
    let zoneBorder = "border-green-500/30";
    let zoneText = "text-green-600 dark:text-green-400";

    if (offerHigh < wholesaleAvg * 0.85) {
      zone = "conservative";
      zoneLabel = "Conservative — Risk Losing Deal";
      zoneIcon = TrendingDown;
      zoneBg = "from-amber-500/10 to-amber-500/5";
      zoneBorder = "border-amber-500/30";
      zoneText = "text-amber-600 dark:text-amber-400";
    } else if (offerHigh > tradeinAvg * 1.05) {
      zone = "overpaying";
      zoneLabel = "Overpaying — Margin Risk";
      zoneIcon = AlertTriangle;
      zoneBg = "from-destructive/10 to-destructive/5";
      zoneBorder = "border-destructive/30";
      zoneText = "text-destructive";
    } else if (offerHigh > wholesaleAvg && offerHigh <= tradeinAvg) {
      zone = "sweet";
      zoneLabel = "Sweet Spot";
      zoneIcon = ShieldCheck;
    } else if (offerHigh <= wholesaleAvg) {
      zone = "aggressive";
      zoneLabel = "Aggressive — May Not Close";
      zoneIcon = TrendingDown;
      zoneBg = "from-amber-500/10 to-amber-500/5";
      zoneBorder = "border-amber-500/30";
      zoneText = "text-amber-600 dark:text-amber-400";
    }

    return {
      projectedProfit,
      profitPct,
      pctPos,
      zone,
      zoneLabel,
      zoneIcon,
      zoneBg,
      zoneBorder,
      zoneText,
    };
  }, [offerHigh, wholesaleAvg, tradeinAvg, retailAvg, msrp, retailClean, wholesaleRough, soldAvg, closestCompPrice, retailListings]);

  if (!data) return null;

  const { pctPos } = data;
  const offerPos = pctPos(offerHigh);
  const wholesalePos = pctPos(wholesaleAvg);
  const tradeinPos = pctPos(tradeinAvg);
  const retailPos = pctPos(retailAvg);
  const wholesaleRoughPos = wholesaleRough && wholesaleRough > 0 ? pctPos(wholesaleRough) : null;
  const retailCleanPos = retailClean && retailClean > 0 ? pctPos(retailClean) : null;
  const soldAvgPos = soldAvg && soldAvg > 0 ? pctPos(soldAvg) : null;
  const closestCompPos = closestCompPrice && closestCompPrice > 0 ? pctPos(closestCompPrice) : null;
  const liveMarketPos = retailListings?.avgPrice ? pctPos(retailListings.avgPrice) : null;

  const ZoneIcon = data.zoneIcon;

  // Build marker list for the spectrum
  const markers: { label: string; shortLabel: string; pos: number; value: number; color: string; dotColor: string; isPrimary?: boolean }[] = [];

  if (wholesaleRoughPos !== null && wholesaleRough) {
    markers.push({ label: "Wholesale Rough", shortLabel: "WHL RGH", pos: wholesaleRoughPos, value: wholesaleRough, color: "text-gray-500", dotColor: "bg-gray-400" });
  }
  markers.push(
    { label: "Wholesale Avg", shortLabel: "WHL", pos: wholesalePos, value: wholesaleAvg, color: "text-blue-500", dotColor: "bg-blue-500" },
    { label: "Trade-In Avg", shortLabel: "TRD", pos: tradeinPos, value: tradeinAvg, color: "text-primary", dotColor: "bg-primary" },
    { label: "Retail Avg", shortLabel: "RTL", pos: retailPos, value: retailAvg, color: "text-green-500", dotColor: "bg-green-500" },
  );
  if (retailCleanPos !== null && retailClean) {
    markers.push({ label: "Retail Clean", shortLabel: "RTL Clean", pos: retailCleanPos, value: retailClean, color: "text-emerald-600 dark:text-emerald-400", dotColor: "bg-emerald-500" });
  }
  if (closestCompPos !== null && closestCompPrice) {
    markers.push({ label: "Closest Comp", shortLabel: "Comp", pos: closestCompPos, value: closestCompPrice, color: "text-amber-600 dark:text-amber-400", dotColor: "bg-amber-500" });
  }
  if (soldAvgPos !== null && soldAvg) {
    markers.push({ label: "90d Sold Avg", shortLabel: "Sold Avg", pos: soldAvgPos, value: soldAvg, color: "text-emerald-500", dotColor: "bg-emerald-600" });
  }
  if (liveMarketPos !== null && retailListings?.avgPrice) {
    markers.push({ label: "Live Market", shortLabel: "MKT", pos: liveMarketPos, value: retailListings.avgPrice, color: "text-violet-500", dotColor: "bg-violet-500", isPrimary: true });
  }

  // Sort markers by position
  markers.sort((a, b) => a.pos - b.pos);

  // Offer Zone band positions (WHL Avg → RTL Avg)
  const offerZoneLeft = wholesalePos;
  const offerZoneWidth = Math.max(retailPos - wholesalePos, 0);
  const offerInZone = offerHigh >= wholesaleAvg && offerHigh <= retailAvg;
  const offerAboveRetail = offerHigh > retailAvg;

  return (
    <div className="space-y-4">
      {/* Header with zone badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Profit Spread Analysis
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${data.zoneBg} border ${data.zoneBorder}`}>
          <ZoneIcon className={`w-3.5 h-3.5 ${data.zoneText}`} />
          <span className={`text-[11px] font-bold ${data.zoneText}`}>{data.zoneLabel}</span>
        </div>
      </div>

      {/* === SPECTRUM BAR === */}
      <div className="relative pt-6 pb-8">
        {/* Gradient track */}
        <div className="relative h-3 rounded-full overflow-hidden shadow-inner">
          {/* Base gradient: gray → blue → green */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-400/20 via-blue-500/20 via-40% to-green-500/20" />

          {/* Offer Zone band */}
          <div
            className={`absolute top-0 bottom-0 ${
              offerAboveRetail ? "bg-destructive/15" : offerInZone ? "bg-primary/15" : "bg-primary/10"
            }`}
            style={{
              left: `${offerZoneLeft}%`,
              width: `${offerZoneWidth}%`,
            }}
          />
        </div>

        {/* Offer Zone label */}
        {offerZoneWidth > 5 && (
          <div
            className="absolute top-[42px] pointer-events-none"
            style={{
              left: `${offerZoneLeft + offerZoneWidth / 2}%`,
              transform: "translateX(-50%)",
            }}
          >
            <span className="text-[8px] font-semibold text-primary/50 uppercase tracking-widest">
              Offer Zone
            </span>
          </div>
        )}

        {/* Market markers (tick marks + labels) */}
        {markers.map((m, i) => {
          const isAbove = i % 2 === 0;
          return (
            <div
              key={m.label}
              className="absolute"
              style={{ left: `${m.pos}%`, top: 0, bottom: 0 }}
            >
              {/* Tick line */}
              <div className="absolute top-6 w-px h-3" style={{ left: '-0.5px' }}>
                <div className={`w-full h-full ${m.dotColor} opacity-50`} />
              </div>
              {/* Dot on track */}
              <div className="absolute top-[26px]" style={{ left: '-3px' }}>
                <div className={`w-[7px] h-[7px] rounded-full ${m.dotColor} ring-2 ring-background shadow-sm`} />
              </div>
              {/* Label */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 text-center whitespace-nowrap ${isAbove ? '-top-0.5' : 'top-[42px]'}`}
              >
                <div className={`text-[9px] font-bold ${m.color} leading-none`}>{m.shortLabel}</div>
                <div className="text-[9px] text-muted-foreground font-medium leading-tight">
                  ${m.value.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}

        {/* YOUR OFFER — dominant marker: larger diamond + label */}
        <div
          className="absolute z-20"
          style={{ left: `${offerPos}%`, top: '16px' }}
        >
          <div className="relative">
            {/* Glow pulse */}
            <div className="absolute -left-4 -top-4 w-8 h-8 rounded-full bg-primary/25 animate-pulse" />
            {/* Diamond */}
            <div
              className="absolute -left-[9px] -top-[9px] w-[18px] h-[18px] bg-primary rotate-45 rounded-[3px] shadow-lg shadow-primary/50 border-2 border-background"
            />
            {/* Label above */}
            <div className="absolute -top-[28px] left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
              <div className="text-[10px] font-black text-primary leading-none">YOUR OFFER</div>
              <div className="text-[10px] font-bold text-primary leading-tight">
                ${offerHigh.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === KPI CARDS === */}
      <div className="grid grid-cols-3 gap-2">
        {/* Projected Profit */}
        <div className={`relative overflow-hidden rounded-xl border p-3 text-center ${
          data.projectedProfit >= 0
            ? "border-green-500/20 bg-gradient-to-b from-green-500/5 to-transparent"
            : "border-destructive/20 bg-gradient-to-b from-destructive/5 to-transparent"
        }`}>
          <div className="text-[10px] text-muted-foreground font-medium mb-0.5">Projected Profit</div>
          <div className={`text-lg font-bold tabular-nums ${data.projectedProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
            {data.projectedProfit >= 0 ? "+" : ""}${Math.abs(data.projectedProfit).toLocaleString()}
          </div>
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            {data.projectedProfit >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-destructive" />
            )}
            <span className={`text-[10px] font-semibold ${data.projectedProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              vs Retail Avg
            </span>
          </div>
        </div>

        {/* Margin % */}
        <div className={`relative overflow-hidden rounded-xl border p-3 text-center ${
          data.profitPct >= 15
            ? "border-green-500/20 bg-gradient-to-b from-green-500/5 to-transparent"
            : data.profitPct >= 5
            ? "border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent"
            : "border-destructive/20 bg-gradient-to-b from-destructive/5 to-transparent"
        }`}>
          <div className="text-[10px] text-muted-foreground font-medium mb-0.5">Margin</div>
          <div className={`text-lg font-bold tabular-nums ${
            data.profitPct >= 15 ? "text-green-600 dark:text-green-400" : data.profitPct >= 5 ? "text-amber-600 dark:text-amber-400" : "text-destructive"
          }`}>
            {data.profitPct.toFixed(1)}%
          </div>
          <div className="w-full mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                data.profitPct >= 15 ? "bg-green-500" : data.profitPct >= 5 ? "bg-amber-500" : "bg-destructive"
              }`}
              style={{ width: `${Math.min(Math.max(data.profitPct, 0), 40) * 2.5}%` }}
            />
          </div>
        </div>

        {/* Live Market Spread (or Retail Spread fallback) */}
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-muted/30 to-transparent p-3 text-center">
          {retailListings?.avgPrice ? (
            <>
              <div className="text-[10px] text-muted-foreground font-medium mb-0.5 flex items-center justify-center gap-1">
                <BarChart3 className="w-3 h-3 text-violet-500" />
                Live Market Δ
              </div>
              <div className="text-lg font-bold tabular-nums text-card-foreground">
                ${Math.abs(retailListings.avgPrice - offerHigh).toLocaleString()}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {retailListings.count || 0} listings
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] text-muted-foreground font-medium mb-0.5">Spread to Retail</div>
              <div className="text-lg font-bold tabular-nums text-card-foreground">
                ${Math.abs(retailAvg - offerHigh).toLocaleString()}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                Retail Avg basis
              </div>
            </>
          )}
        </div>
      </div>

      {/* === LEGEND === */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
        {wholesaleRough && wholesaleRough > 0 && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-400" /> WHL Rough
          </span>
        )}
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" /> Wholesale
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" /> Trade-In
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" /> Retail
        </span>
        {retailClean && retailClean > 0 && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> RTL Clean
          </span>
        )}
        {closestCompPrice && closestCompPrice > 0 && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" /> Comp
          </span>
        )}
        {soldAvg && soldAvg > 0 && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-600" /> Sold Avg
          </span>
        )}
        {retailListings?.avgPrice && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-500" /> Live Market
          </span>
        )}
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rotate-45 rounded-[2px] bg-primary" /> Your Offer
        </span>
      </div>
    </div>
  );
}
