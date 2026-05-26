import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, TrendingUp, Zap, SlidersHorizontal } from "lucide-react";
import { STRATEGY_MODE_PRESETS, type StrategyMode } from "@/lib/offerCalculator";

const MODE_META: Record<StrategyMode, { icon: React.ReactNode; color: string; border: string; activeBg: string; activeRing: string; gradient: string; desc: string }> = {
  conservative: {
    icon: <Shield className="w-5 h-5" />,
    color: "text-slate-600 dark:text-slate-300",
    border: "border-slate-300/60 hover:border-slate-400",
    activeBg: "bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-900/40 border-slate-500",
    activeRing: "ring-slate-400/30",
    gradient: "from-slate-500/0 to-slate-500/0",
    desc: "Protect margin. Wholesale anchor. Never overpay.",
  },
  standard: {
    icon: <TrendingUp className="w-5 h-5" />,
    color: "text-primary",
    border: "border-primary/30 hover:border-primary/60",
    activeBg: "bg-gradient-to-br from-primary/10 to-primary/5 border-primary",
    activeRing: "ring-primary/30",
    gradient: "from-primary/5 to-transparent",
    desc: "Normal acquisition. Trade-in anchor with market multiplier.",
  },
  aggressive: {
    icon: <Zap className="w-5 h-5" />,
    color: "text-amber-600 dark:text-amber-400",
    border: "border-amber-400/40 hover:border-amber-500/70",
    activeBg: "bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20 border-amber-500",
    activeRing: "ring-amber-400/40",
    gradient: "from-amber-500/5 to-transparent",
    desc: "Step up to win cars. Trade-in clean floor across all tiers.",
  },
  predator: {
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-destructive",
    border: "border-destructive/30 hover:border-destructive/60",
    activeBg: "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive",
    activeRing: "ring-destructive/40",
    gradient: "from-destructive/5 to-transparent",
    desc: "Show retail up front. Inspector deducts bring it down.",
  },
  custom: {
    icon: <SlidersHorizontal className="w-5 h-5" />,
    color: "text-muted-foreground",
    border: "border-dashed border-border hover:border-muted-foreground/60",
    activeBg: "bg-muted/40 border-muted-foreground/40",
    activeRing: "ring-muted-foreground/20",
    gradient: "from-muted/0 to-muted/0",
    desc: "Manual configuration. No auto-populate.",
  },
};

const BB_SHORT: Record<string, string> = {
  wholesale_xclean: "WS X-Clean", wholesale_clean: "WS Clean", wholesale_avg: "WS Avg", wholesale_rough: "WS Rough",
  tradein_clean: "TI Clean", tradein_avg: "TI Avg", tradein_rough: "TI Rough",
  retail_xclean: "Ret X-Clean", retail_clean: "Ret Clean", retail_avg: "Ret Avg", retail_rough: "Ret Rough",
};

// Approximate tier ratios relative to retail avg for a typical vehicle
// These are industry-standard spreads used for illustration only
const TIER_RATIO: Record<string, number> = {
  wholesale_rough: 0.58,
  wholesale_avg: 0.63,
  wholesale_clean: 0.68,
  wholesale_xclean: 0.73,
  tradein_rough: 0.70,
  tradein_avg: 0.75,
  tradein_clean: 0.82,
  retail_rough: 0.88,
  retail_avg: 1.0,
  retail_clean: 1.06,
  retail_xclean: 1.12,
};

function estimateOffer(mode: StrategyMode, retailAvg: number): number {
  if (mode === "custom") return 0;
  const preset = STRATEGY_MODE_PRESETS[mode];
  // Use "good" condition as the typical scenario
  const basis = preset.condition_basis_map.good;
  const ratio = TIER_RATIO[basis] ?? 0.75;
  const base = Math.round(retailAvg * ratio);
  const adjusted = Math.round(base * (1 + preset.global_adjustment_pct / 100));
  return adjusted;
}

interface Props {
  value: StrategyMode;
  onChange: (mode: StrategyMode) => void;
  avgVehicleValue?: number; // avg retail value from submissions, fallback $30k
}

export default function StrategyModeSelector({ value, onChange, avgVehicleValue }: Props) {
  const modes: StrategyMode[] = ["conservative", "standard", "aggressive", "predator", "custom"];
  const refValue = avgVehicleValue && avgVehicleValue > 0 ? avgVehicleValue : 30000;
  const refLabel = `$${Math.round(refValue / 1000)}k`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-card-foreground text-sm">Strategy Mode</h3>
        <Badge variant="outline" className="text-[9px] ml-auto">{STRATEGY_MODE_PRESETS[value].label}</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {modes.map(mode => {
          const meta = MODE_META[mode];
          const preset = STRATEGY_MODE_PRESETS[mode];
          const isActive = value === mode;
          const estOffer = estimateOffer(mode, refValue);
          return (
            <button
              key={mode}
              onClick={() => onChange(mode)}
              className={`relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all duration-200 ${
                isActive
                  ? `${meta.activeBg} ring-4 ${meta.activeRing} shadow-xl scale-[1.03]`
                  : `${meta.border} bg-card hover:shadow-md hover:scale-[1.01]`
              }`}
            >
              {isActive && (
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${meta.color.replace('text-', 'bg-')}`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${meta.color.replace('text-', 'bg-')}`}></span>
                  </span>
                </div>
              )}
              <div className={`flex items-center gap-1.5 mb-1 ${meta.color}`}>
                {meta.icon}
                <span className="font-bold text-xs uppercase tracking-wide">{preset.label}</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-tight mb-2">{meta.desc}</p>
              {mode !== "custom" && (
                <div className="space-y-0.5">
                  {(["excellent", "very_good", "good", "fair"] as const).map(cond => (
                    <div key={cond} className="flex items-center justify-between text-[8px]">
                      <span className="text-muted-foreground capitalize">{cond.replace("_", " ")}</span>
                      <span className="font-mono font-bold text-card-foreground">
                        {BB_SHORT[preset.condition_basis_map[cond]] || preset.condition_basis_map[cond]}
                      </span>
                    </div>
                  ))}
                  {preset.global_adjustment_pct !== 0 && (
                    <div className="text-[8px] font-bold mt-1 text-center" style={{ color: preset.global_adjustment_pct > 0 ? "var(--emerald-600)" : "var(--destructive)" }}>
                      Global: {preset.global_adjustment_pct > 0 ? "+" : ""}{preset.global_adjustment_pct}%
                    </div>
                  )}
                </div>
              )}
              {/* Dollar example */}
              {mode !== "custom" && estOffer > 0 && (
                <div className="mt-2 pt-1.5 border-t border-border">
                  <div className="text-[8px] text-muted-foreground leading-tight">
                    Est. on {refLabel} vehicle (Good):
                  </div>
                  <div className="text-[11px] font-black text-card-foreground tabular-nums">
                    ${estOffer.toLocaleString()}
                  </div>
                </div>
              )}
              {mode === "custom" && (
                <div className="mt-2 pt-1.5 border-t border-border">
                  <div className="text-[8px] text-muted-foreground italic">Configure manually below</div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {value === "predator" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive font-medium">
            Predator Mode active: Customer-facing offer anchors to retail. Inspector deducts are critical — they bring the number to your actual target. Requires strict inspection discipline.
          </p>
        </div>
      )}
    </div>
  );
}
