import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, TrendingUp, Zap, SlidersHorizontal } from "lucide-react";
import { STRATEGY_MODE_PRESETS, type StrategyMode } from "@/lib/offerCalculator";

const MODE_META: Record<StrategyMode, { icon: React.ReactNode; color: string; border: string; desc: string }> = {
  conservative: {
    icon: <Shield className="w-5 h-5" />,
    color: "text-muted-foreground",
    border: "border-border hover:border-muted-foreground/60",
    desc: "Protect margin. Wholesale anchor. Never overpay.",
  },
  standard: {
    icon: <TrendingUp className="w-5 h-5" />,
    color: "text-primary",
    border: "border-primary/30 hover:border-primary/60",
    desc: "Normal acquisition. Trade-in anchor with market multiplier.",
  },
  aggressive: {
    icon: <Zap className="w-5 h-5" />,
    color: "text-amber-600",
    border: "border-amber-500/30 hover:border-amber-500/60",
    desc: "Step up to win cars. Trade-in clean floor across all tiers.",
  },
  predator: {
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-destructive",
    border: "border-destructive/30 hover:border-destructive/60",
    desc: "Show retail up front. Inspector deducts bring it down.",
  },
  custom: {
    icon: <SlidersHorizontal className="w-5 h-5" />,
    color: "text-muted-foreground",
    border: "border-border hover:border-muted-foreground/60",
    desc: "Manual configuration. No auto-populate.",
  },
};

const BB_SHORT: Record<string, string> = {
  wholesale_xclean: "WS X-Clean", wholesale_clean: "WS Clean", wholesale_avg: "WS Avg", wholesale_rough: "WS Rough",
  tradein_clean: "TI Clean", tradein_avg: "TI Avg", tradein_rough: "TI Rough",
  retail_xclean: "Ret X-Clean", retail_clean: "Ret Clean", retail_avg: "Ret Avg", retail_rough: "Ret Rough",
};

interface Props {
  value: StrategyMode;
  onChange: (mode: StrategyMode) => void;
}

export default function StrategyModeSelector({ value, onChange }: Props) {
  const modes: StrategyMode[] = ["conservative", "standard", "aggressive", "predator", "custom"];

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
          return (
            <button
              key={mode}
              onClick={() => onChange(mode)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                isActive
                  ? `${meta.border.split(" ")[0]} bg-card ring-2 ring-primary/20 shadow-md scale-[1.02]`
                  : `${meta.border} bg-card hover:shadow-sm`
              }`}
            >
              <div className={`flex items-center gap-1.5 mb-1 ${meta.color}`}>
                {meta.icon}
                <span className="font-bold text-xs">{preset.label}</span>
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
