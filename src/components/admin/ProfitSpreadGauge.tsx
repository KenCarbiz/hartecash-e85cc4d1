import { useMemo } from "react";
import { Target, TrendingUp, TrendingDown, DollarSign, ShieldCheck, AlertTriangle, BarChart3 } from "lucide-react";

interface Props {
  offerHigh: number;
  wholesaleAvg: number;
  tradeinAvg: number;
  retailAvg: number;
  retailClean: number;
  msrp: number;
  retailListings?: { avgPrice?: number; medianPrice?: number; count?: number } | null;
}

export default function ProfitSpreadGauge({
  offerHigh,
  wholesaleAvg,
  tradeinAvg,
  retailAvg,
  retailClean,
  msrp,
  retailListings,
}: Props) {
  const data = useMemo(() => {
    if (!retailAvg || !offerHigh) return null;

    const projectedProfit = retailAvg - offerHigh;
    const profitPct = retailAvg > 0 ? (projectedProfit / retailAvg) * 100 : 0;

    // Build all value points for the gauge
    const allValues = [wholesaleAvg, tradeinAvg, retailAvg, offerHigh];
    if (retailClean > 0) allValues.push(retailClean);
    if (msrp > 0) allValues.push(msrp);
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
  }, [offerHigh, wholesaleAvg, tradeinAvg, retailAvg, retailClean, msrp, retailListings]);

  if (!data) return null;

  const { pctPos } = data;
  const offerPos = pctPos(offerHigh);
  const wholesalePos = pctPos(wholesaleAvg);
  const tradeinPos = pctPos(tradeinAvg);
  const retailPos = pctPos(retailAvg);
  const retailCleanPos = retailClean > 0 ? pctPos(retailClean) : null;
  const liveMarketPos = retailListings?.avgPrice ? pctPos(retailListings.avgPrice) : null;
  const msrpPos = msrp > 0 ? pctPos(msrp) : null;

  const ZoneIcon = data.zoneIcon;

  // Build marker list for the spectrum
  const markers: { label: string; shortLabel: string; pos: number; value: number; color: string; dotColor: string; isPrimary?: boolean }[] = [
    { label: "Wholesale Avg", shortLabel: "WHL", pos: wholesalePos, value: wholesaleAvg, color: "text-blue-500", dotColor: "bg-blue-500" },
    { label: "Trade-In Avg", shortLabel: "TRD", pos: tradeinPos, value: tradeinAvg, color: "text-primary", dotColor: "bg-primary" },
    { label: "Retail Avg", shortLabel: "RTL", pos: retailPos, value: retailAvg, color: "text-green-500", dotColor: "bg-green-500" },
  ];
  if (retailCleanPos !== null) {
    markers.push({ label: "Retail Clean", shortLabel: "R-CLN", pos: retailCleanPos, value: retailClean, color: "text-emerald-500", dotColor: "bg-emerald-500" });
  }
  if (liveMarketPos !== null && retailListings?.avgPrice) {
    markers.push({ label: "Live Market", shortLabel: "MKT", pos: liveMarketPos, value: retailListings.avgPrice, color: "text-violet-500", dotColor: "bg-violet-500", isPrimary: true });
  }
  if (msrpPos !== null) {
    markers.push({ label: "MSRP", shortLabel: "MSRP", pos: msrpPos, value: msrp, color: "text-muted-foreground", dotColor: "bg-muted-foreground" });
  }

  // Sort markers by position
  markers.sort((a, b) => a.pos - b.pos);

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
          {/* Base gradient: blue → green → amber → red */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-green-500/30 via-60% to-destructive/30" />

          {/* Sweet spot overlay */}
          <div
            className="absolute top-0 bottom-0 bg-green-500/20 backdrop-blur-sm"
            style={{
              left: `${wholesalePos}%`,
              width: `${Math.max(tradeinPos - wholesalePos, 0)}%`,
            }}
          />
        </div>

        {/* Market markers (tick marks + labels above) */}
        {markers.map((m, i) => {
          // Stagger label positions to prevent overlap
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

        {/* YOUR OFFER — prominent diamond marker */}
        <div
          className="absolute z-20"
          style={{ left: `${offerPos}%`, top: '18px' }}
        >
          <div className="relative">
            {/* Glow pulse */}
            <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-primary/20 animate-pulse" />
            {/* Diamond */}
            <div
              className="absolute -left-[7px] -top-[7px] w-[14px] h-[14px] bg-primary rotate-45 rounded-[2px] shadow-lg shadow-primary/40 border-2 border-background"
            />
            {/* Label below */}
            <div className="absolute -left-10 top-4 w-20 text-center">
              <div className="text-[10px] font-extrabold text-primary leading-none">YOUR OFFER</div>
              <div className="text-[11px] font-bold text-primary">${offerHigh.toLocaleString()}</div>
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
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" /> Wholesale
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" /> Trade-In
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" /> Retail
        </span>
        {retailListings?.avgPrice && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-500" /> Live Market
          </span>
        )}
        {msrp > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-2.5 h-2.5" /> MSRP
          </span>
        )}
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rotate-45 rounded-[1px] bg-primary" /> Your Offer
        </span>
      </div>
    </div>
  );
}
