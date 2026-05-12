import { useMemo, useState } from "react";
import { calculateInvestmentScore, TIER_META, type InvestmentScoreInputs, type InvestmentScoreBreakdown } from "@/lib/investmentScore";

type Size = "sm" | "md" | "lg";

interface Props {
  inputs: InvestmentScoreInputs;
  size?: Size;
  showBreakdown?: boolean;
  className?: string;
}

export function InvestmentTierBadge({ inputs, size = "md", showBreakdown = false, className = "" }: Props) {
  const breakdown = useMemo(() => calculateInvestmentScore(inputs), [inputs]);
  const meta = TIER_META[breakdown.tier];
  const [open, setOpen] = useState(false);

  const sizeCls =
    size === "sm" ? "h-6 px-2 text-[10px] gap-1" :
    size === "lg" ? "h-12 px-4 text-sm gap-2" :
    "h-8 px-3 text-xs gap-1.5";

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => showBreakdown && setOpen(o => !o)}
        className={`${sizeCls} ${meta.tw.bg} ${meta.tw.text} ${meta.tw.border} border rounded-full font-bold inline-flex items-center transition hover:brightness-110 ${showBreakdown ? "cursor-pointer" : "cursor-default"}`}
        title={`${meta.label} — ${meta.tagline}`}
      >
        <span className="opacity-80">●</span>
        <span className="uppercase tracking-wide">{meta.label}</span>
        <span className="opacity-60 font-mono">{breakdown.total}/12</span>
      </button>

      {showBreakdown && open && (
        <div className="absolute z-30 top-full left-0 mt-1.5 w-72 rounded-xl border border-border bg-popover shadow-xl p-3 text-xs">
          <div className="flex items-baseline justify-between mb-2">
            <div className={`font-black text-sm ${meta.tw.text}`}>{meta.label} Investment</div>
            <div className="text-muted-foreground">{breakdown.total}/12 pts</div>
          </div>
          <div className="text-muted-foreground italic mb-2.5 leading-snug">{meta.tagline}</div>
          <div className="space-y-1">
            <BreakdownRow label="Market Days Supply" value={breakdown.mdsPoints} max={4} />
            <BreakdownRow
              label="Cost-to-Market"
              value={breakdown.costToMarketPoints}
              max={4}
              detail={breakdown.costToMarketPct != null ? `${(breakdown.costToMarketPct * 100).toFixed(0)}%` : undefined}
            />
            <BreakdownRow label="Condition Grade" value={breakdown.conditionPoints} max={2} />
            <BreakdownRow label="AI Agreement" value={breakdown.aiAgreementPoints} max={1} />
            <BreakdownRow
              label="Holding Cost"
              value={breakdown.holdingCostPoints}
              max={1}
              detail={breakdown.projectedHoldingCost != null ? `$${Math.round(breakdown.projectedHoldingCost)}` : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ label, value, max, detail }: { label: string; value: number; max: number; detail?: string }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-foreground/80">{label}</span>
          <span className="text-muted-foreground font-mono text-[10px]">
            {detail ? `${detail} · ` : ""}{value}/{max}
          </span>
        </div>
        <div className="mt-0.5 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export type { InvestmentScoreBreakdown };
