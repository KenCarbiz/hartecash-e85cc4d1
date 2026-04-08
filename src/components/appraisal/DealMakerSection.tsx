import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, HandCoins, DollarSign, TrendingDown } from "lucide-react";
import type { BBVehicle } from "@/components/sell-form/types";

interface Props {
  customerExpected: number;
  currentAppraisal: number;
  bbVehicle: BBVehicle | null;
  reconCost: number;
  targetGrossMin: number;
  show: boolean;
}

export default function DealMakerSection({ customerExpected, currentAppraisal, bbVehicle, reconCost, targetGrossMin, show }: Props) {
  const [overAllow, setOverAllow] = useState(0);
  const [fiFPVR, setFiFPVR] = useState(1000);
  const [isOpen, setIsOpen] = useState(false);

  if (!show) return null;

  const gap = customerExpected - currentAppraisal;
  const tradeAllowance = currentAppraisal + overAllow;
  const netFrontGross = (bbVehicle?.retail?.clean || bbVehicle?.retail?.avg || 0) - tradeAllowance - reconCost;
  const effectiveGross = netFrontGross + fiFPVR;

  const transportFees = 350;
  const wsXClean = bbVehicle?.wholesale?.xclean || 0;
  const wsClean = bbVehicle?.wholesale?.clean || 0;
  const wsAvg = bbVehicle?.wholesale?.avg || 0;
  const wsRough = bbVehicle?.wholesale?.rough || 0;
  const netAuction = wsAvg - transportFees;

  const recommendation = effectiveGross >= (targetGrossMin || 1500) ? "deal_works" : effectiveGross >= 0 ? "marginal" : "walk";
  const recColors = { deal_works: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700", marginal: "bg-amber-500/10 border-amber-500/30 text-amber-700", walk: "bg-destructive/10 border-destructive/30 text-destructive" };
  const recLabels = { deal_works: "✅ Deal works", marginal: "⚠ Marginal", walk: "🚫 Walk the deal" };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-amber-500/10 transition-colors">
            <div className="flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-sm text-card-foreground">Deal Maker — Close the Gap</span>
              {gap < 0 && (
                <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive">
                  Gap: -${Math.abs(gap).toLocaleString()}
                </Badge>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Gap Display */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-[9px] text-muted-foreground uppercase font-bold">Customer Expected</div>
                <div className="text-lg font-black text-card-foreground">${customerExpected.toLocaleString()}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-[9px] text-muted-foreground uppercase font-bold">Current Appraisal</div>
                <div className="text-lg font-black text-primary">${currentAppraisal.toLocaleString()}</div>
              </div>
              <div className={`rounded-lg p-2 ${gap < 0 ? "bg-destructive/10" : "bg-emerald-500/10"}`}>
                <div className="text-[9px] text-muted-foreground uppercase font-bold">Gap</div>
                <div className={`text-lg font-black ${gap < 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {gap >= 0 ? "+" : "-"}${Math.abs(gap).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Lever 1: Over-Allow */}
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <DollarSign className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold">Lever 1 — Front Gross Adjustment</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">Add to trade allowance (over-allow) to save the deal</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted-foreground">$</span>
                <Input type="number" value={overAllow} onChange={e => setOverAllow(Number(e.target.value) || 0)} step={100} className="h-7 w-28 text-sm" />
                <span className="text-[10px] text-muted-foreground">
                  {overAllow > 0 && `Your front gross drops by $${overAllow.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Lever 2: F&I */}
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <DollarSign className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-bold">Lever 2 — F&I Offset</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">Offset with expected F&I income</p>
              <Select value={String(fiFPVR)} onValueChange={v => setFiFPVR(Number(v))}>
                <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">$500 PVR</SelectItem>
                  <SelectItem value="1000">$1,000 PVR</SelectItem>
                  <SelectItem value="1500">$1,500 PVR</SelectItem>
                  <SelectItem value="2000">$2,000 PVR</SelectItem>
                </SelectContent>
              </Select>
              {fiFPVR > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  With ${fiFPVR.toLocaleString()} F&I PVR, effective gross: <strong className={effectiveGross >= 0 ? "text-emerald-600" : "text-destructive"}>${effectiveGross.toLocaleString()}</strong>
                </p>
              )}
            </div>

            {/* Lever 3: Wholesale Reality */}
            {bbVehicle && (
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-xs font-bold">Lever 3 — Wholesale Reality Check</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">If customer walks, what does this car bring at auction?</p>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {[
                    { label: "WS X-Clean", value: wsXClean },
                    { label: "WS Clean", value: wsClean },
                    { label: "WS Avg", value: wsAvg },
                    { label: "WS Rough", value: wsRough },
                  ].map(t => t.value > 0 && (
                    <div key={t.label} className="text-center rounded-md bg-muted/50 p-1.5">
                      <div className="text-[8px] text-muted-foreground">{t.label}</div>
                      <div className="text-xs font-bold text-card-foreground">${t.value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Transport + fees: -${transportFees.toLocaleString()} → Net auction proceeds: <strong className="text-card-foreground">${netAuction.toLocaleString()}</strong>
                </p>
              </div>
            )}

            {/* Deal Summary */}
            <div className={`rounded-lg border-2 p-3 ${recColors[recommendation]}`}>
              <div className="text-xs font-bold mb-2">Deal Summary</div>
              <div className="grid grid-cols-2 gap-y-1 text-[10px]">
                <span className="text-muted-foreground">ACV:</span><span className="font-bold">${currentAppraisal.toLocaleString()}</span>
                <span className="text-muted-foreground">Over-Allow:</span><span className="font-bold">${overAllow.toLocaleString()}</span>
                <span className="text-muted-foreground">Trade Allowance:</span><span className="font-bold">${tradeAllowance.toLocaleString()}</span>
                <span className="text-muted-foreground">Projected F&I:</span><span className="font-bold">${fiFPVR.toLocaleString()}</span>
                <span className="text-muted-foreground">Net Front Gross:</span><span className={`font-bold ${netFrontGross >= 0 ? "text-emerald-600" : "text-destructive"}`}>${netFrontGross.toLocaleString()}</span>
              </div>
              <div className="mt-2 text-sm font-bold">{recLabels[recommendation]}</div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
