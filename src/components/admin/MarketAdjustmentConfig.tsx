import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { MarketAdjustmentConfig as MAConfig, MarketDaysSupplyBracket } from "@/lib/offerCalculator";
import { DEFAULT_MARKET_ADJUSTMENT } from "@/lib/offerCalculator";

interface Props {
  config: MAConfig;
  onChange: (config: MAConfig) => void;
}

const BRACKET_LABELS = [
  "Critical scarcity — step up",
  "Low supply — buy confidently",
  "Balanced market — no change",
  "Oversupply — hold firm",
  "High supply — discount or pass",
];

export default function MarketAdjustmentConfigPanel({ config, onChange }: Props) {
  const cfg = config || DEFAULT_MARKET_ADJUSTMENT;

  const updateBracket = (index: number, field: keyof MarketDaysSupplyBracket, value: number) => {
    const brackets = [...cfg.days_supply_brackets];
    brackets[index] = { ...brackets[index], [field]: value };
    onChange({ ...cfg, days_supply_brackets: brackets });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-bold">Enable Live Market Multiplier</Label>
          <p className="text-[10px] text-muted-foreground">
            Automatically adjust offers based on Black Book Market Days Supply data.
          </p>
        </div>
        <Switch checked={cfg.enabled} onCheckedChange={v => onChange({ ...cfg, enabled: v })} />
      </div>

      {cfg.enabled && (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_1fr] gap-0 text-[9px] font-bold uppercase text-muted-foreground bg-muted/50 px-3 py-1.5">
              <span>Range</span>
              <span className="text-center">Max Days</span>
              <span className="text-center">Adj %</span>
              <span>Description</span>
            </div>
            {cfg.days_supply_brackets.map((bracket, i) => {
              const prevMax = i > 0 ? cfg.days_supply_brackets[i - 1].max_days : 0;
              const rangeLabel = bracket.max_days >= 9999
                ? `${prevMax}+ days`
                : `${prevMax}–${bracket.max_days} days`;
              return (
                <div key={i} className="grid grid-cols-[1fr_80px_80px_1fr] gap-0 items-center px-3 py-1.5 border-t border-border hover:bg-muted/20">
                  <div className="flex items-center gap-1.5">
                    {bracket.adjustment_pct > 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                    ) : bracket.adjustment_pct < 0 ? (
                      <TrendingDown className="w-3 h-3 text-destructive" />
                    ) : (
                      <span className="w-3 h-3 text-muted-foreground">—</span>
                    )}
                    <span className="text-xs text-card-foreground">{rangeLabel}</span>
                  </div>
                  <Input
                    type="number"
                    value={bracket.max_days >= 9999 ? "" : bracket.max_days}
                    onChange={e => updateBracket(i, "max_days", e.target.value ? Number(e.target.value) : 9999)}
                    placeholder="∞"
                    className="h-6 text-[10px] text-center"
                    disabled={bracket.max_days >= 9999}
                  />
                  <div className="flex items-center justify-center">
                    <Input
                      type="number"
                      value={bracket.adjustment_pct}
                      onChange={e => updateBracket(i, "adjustment_pct", Number(e.target.value))}
                      className="h-6 text-[10px] text-center w-16"
                      step={1}
                      min={-20}
                      max={20}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground italic">
                    {BRACKET_LABELS[i] || `${bracket.adjustment_pct > 0 ? "+" : ""}${bracket.adjustment_pct}%`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Soft Market Penalty %</Label>
              <p className="text-[9px] text-muted-foreground mb-1">If sold avg is far below asking</p>
              <Input
                type="number" value={cfg.soft_penalty_pct} step={0.5} min={0} max={10}
                onChange={e => onChange({ ...cfg, soft_penalty_pct: Number(e.target.value) })}
                className="h-7 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Tight Market Bonus %</Label>
              <p className="text-[9px] text-muted-foreground mb-1">If sold ≈ asking (within 2%)</p>
              <Input
                type="number" value={cfg.soft_bonus_pct} step={0.5} min={0} max={10}
                onChange={e => onChange({ ...cfg, soft_bonus_pct: Number(e.target.value) })}
                className="h-7 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Sold vs Asking Threshold %</Label>
              <p className="text-[9px] text-muted-foreground mb-1">Spread % to trigger penalty</p>
              <Input
                type="number" value={cfg.sold_vs_asking_threshold_pct} step={1} min={1} max={20}
                onChange={e => onChange({ ...cfg, sold_vs_asking_threshold_pct: Number(e.target.value) })}
                className="h-7 text-sm"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
