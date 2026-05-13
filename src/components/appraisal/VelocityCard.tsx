interface Props {
  marketDaysSupply: number | null;
  lotCostPerDay: number;
  className?: string;
}

const labelFor = (mds: number | null) => {
  if (mds == null) return { headline: "Market data pending", sub: "Live retail listings have not loaded yet.", tone: "neutral" as const };
  if (mds <= 15) return { headline: "Scorching hot market", sub: "Stretch up to retail-clean — this car flies off the lot.", tone: "hot" as const };
  if (mds <= 30) return { headline: "Hot market", sub: "Healthy turn velocity. Comfortable to be aggressive.", tone: "hot" as const };
  if (mds <= 60) return { headline: "Average market", sub: "Standard turn velocity. Hold the line on price.", tone: "warm" as const };
  if (mds <= 90) return { headline: "Slow mover", sub: "Discount aggressively or factor in the holding cost.", tone: "cold" as const };
  return { headline: "Stale segment", sub: "Pass unless the cost-to-market is exceptional.", tone: "cold" as const };
};

const TONE = {
  hot:     { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300", num: "text-emerald-700 dark:text-emerald-300" },
  warm:    { bg: "bg-amber-500/10",   border: "border-amber-500/40",   text: "text-amber-700 dark:text-amber-300",     num: "text-amber-700 dark:text-amber-300"     },
  cold:    { bg: "bg-rose-500/10",    border: "border-rose-500/40",    text: "text-rose-700 dark:text-rose-300",       num: "text-rose-700 dark:text-rose-300"       },
  neutral: { bg: "bg-muted/30",       border: "border-border",         text: "text-muted-foreground",                  num: "text-muted-foreground"                  },
};

export default function VelocityCard({ marketDaysSupply, lotCostPerDay, className = "" }: Props) {
  const meta = labelFor(marketDaysSupply);
  const tone = TONE[meta.tone];
  const holdingCost = marketDaysSupply != null ? Math.round(marketDaysSupply * (lotCostPerDay || 8)) : null;

  return (
    <div className={`rounded-xl border-2 ${tone.bg} ${tone.border} p-4 flex items-center gap-4 shadow-sm ${className}`}>
      <div className="shrink-0 text-center">
        <div className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-0.5">Days on Market</div>
        <div className={`text-3xl font-black tabular-nums ${tone.num}`}>
          {marketDaysSupply != null ? Math.round(marketDaysSupply) : "—"}
          <span className="text-sm font-bold opacity-70 ml-0.5">d</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm ${tone.text}`}>{meta.headline}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{meta.sub}</div>
      </div>
      {holdingCost != null && (
        <div className="shrink-0 text-right border-l border-border/60 pl-4">
          <div className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-0.5">Holding Cost</div>
          <div className="text-xl font-black tabular-nums text-foreground">${holdingCost.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">at ${lotCostPerDay || 8}/day × {Math.round(marketDaysSupply!)}d</div>
        </div>
      )}
    </div>
  );
}
