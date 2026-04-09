import { useMemo, useState, useCallback } from "react";
import type { RetailStats } from "@/components/admin/RetailMarketPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart3, Wrench, Gauge, ChevronDown, RefreshCw } from "lucide-react";
import ProfitSpreadGauge from "@/components/admin/ProfitSpreadGauge";
import MarketContextPanel from "@/components/admin/MarketContextPanel";
import RetailMarketPanel from "@/components/admin/RetailMarketPanel";
import BrakePadDepthWidget from "@/components/inspection/BrakePadDepthWidget";
import type { BBVehicle } from "@/components/sell-form/types";
import type { OfferEstimate } from "@/lib/offerCalculator";

interface Props {
  sub: {
    vin: string | null;
    zip: string | null;
    mileage?: string | null;
    offered_price: number | null;
    estimated_offer_high: number | null;
    internal_notes: string | null;
    ai_damage_summary: string | null;
    ai_condition_score: string | null;
    tire_lf: number | null; tire_rf: number | null; tire_lr: number | null; tire_rr: number | null;
    brake_lf: number | null; brake_rf: number | null; brake_lr: number | null; brake_rr: number | null;
  };
  bbVehicle: BBVehicle | null;
  offerResult: OfferEstimate | null;
  finalValue: number;
  currentOffer: number;
  wholesaleAvg: number;
  tradeinAvg: number;
  retailAvg: number;
  reconCost: number;
  effectivePack: number;
  projectedProfit: number;
  profitMargin: number;
  activeSettings: any;
  dealerZip?: string;
  closestCompPrice?: number | null;
  wholesaleRough?: number;
  soldAvg?: number | null;
  onRefreshInspection?: () => Promise<void>;
  onRetailStatsLoaded?: (stats: RetailStats | null) => void;
  onClosestCompPrice?: (price: number | null) => void;
}

export default function AppraisalSidebar({
  sub, bbVehicle, offerResult, finalValue, currentOffer,
  wholesaleAvg, tradeinAvg, retailAvg,
  reconCost, effectivePack, projectedProfit, profitMargin, activeSettings, dealerZip,
  closestCompPrice, onRefreshInspection, onRetailStatsLoaded, onClosestCompPrice,
}: Props) {
  const [refreshingInspection, setRefreshingInspection] = useState(false);
  const hasTires = !!(sub.tire_lf && sub.tire_rf && sub.tire_lr && sub.tire_rr);
  const hasBrakes = !!(sub.brake_lf != null || sub.brake_rf != null || sub.brake_lr != null || sub.brake_rr != null);
  const brakeDepths = (sub.brake_lf != null || sub.brake_rf != null || sub.brake_lr != null || sub.brake_rr != null)
    ? { lf: sub.brake_lf, rf: sub.brake_rf, lr: sub.brake_lr, rr: sub.brake_rr } : null;
  const hasActualBrakes = !!(brakeDepths && (brakeDepths.lf != null || brakeDepths.rf != null || brakeDepths.lr != null || brakeDepths.rr != null));

  const inspectionData = sub.internal_notes?.includes("[INSPECTION") ? sub.internal_notes : null;
  const hasInspection = !!(hasTires || hasActualBrakes || inspectionData);

  const parsedSections = useMemo(() => {
    if (!inspectionData) return [];
    const sections: { name: string; items: { label: string; status: string }[] }[] = [];
    const lines = inspectionData.split("\n").filter(Boolean);
    let currentSection: typeof sections[0] | null = null;
    for (const line of lines) {
      if (line.startsWith("【") || line.startsWith("[")) {
        if (currentSection) sections.push(currentSection);
        currentSection = { name: line.replace(/[【】\[\]]/g, "").trim(), items: [] };
      } else if (currentSection && (line.includes(":") || line.includes("→"))) {
        const sep = line.includes("→") ? "→" : ":";
        const [label, ...rest] = line.split(sep);
        const status = rest.join(sep).trim();
        if (label.trim()) currentSection.items.push({ label: label.trim().replace(/^[-•]\s*/, ""), status });
      }
    }
    if (currentSection) sections.push(currentSection);
    return sections;
  }, [inspectionData]);

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("fail") || s.includes("poor") || s.includes("replace") || s.includes("damage") || s.includes("issue")) return "bg-destructive/15 text-destructive border-destructive/30";
    if (s.includes("fair") || s.includes("warn") || s.includes("wear") || s.includes("minor")) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    if (s.includes("pass") || s.includes("good") || s.includes("ok") || s.includes("excellent") || s.includes("normal") || s.includes("yes")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const failCount = parsedSections.reduce((acc, sec) => acc + sec.items.filter(i => getStatusColor(i.status).includes("destructive")).length, 0);
  const passCount = parsedSections.reduce((acc, sec) => acc + sec.items.filter(i => getStatusColor(i.status).includes("emerald")).length, 0);
  const totalChecks = parsedSections.reduce((acc, sec) => acc + sec.items.length, 0);

  return (
    <div className="space-y-4">
      {/* Final Offer Card */}
      {offerResult && (
        <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Final Appraised Value</div>
          <div className="text-3xl font-bold text-primary">${finalValue.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">Customer was offered: ${currentOffer.toLocaleString()}</div>
          {offerResult.matchedRuleIds.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <Badge variant="secondary" className="text-[10px]">{offerResult.matchedRuleIds.length} rule(s) applied</Badge>
              {offerResult.isHotLead && <Badge variant="destructive" className="text-[10px]">🔥 Hot</Badge>}
            </div>
          )}
        </div>
      )}

      {/* Profit Spread Gauge */}
      {bbVehicle && retailAvg > 0 && wholesaleAvg > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <ProfitSpreadGauge
            offerHigh={finalValue}
            wholesaleAvg={wholesaleAvg}
            tradeinAvg={tradeinAvg}
            retailAvg={retailAvg}
            msrp={Number(bbVehicle.msrp || 0)}
            retailClean={Number(bbVehicle.retail?.clean || 0)}
            closestCompPrice={closestCompPrice}
          />
        </div>
      )}

      {/* TAC Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            Total Acquisition Cost
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Appraisal Value</span>
            <span className="font-bold">${finalValue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">+ Recon Cost</span>
            <span className="font-bold text-destructive">${reconCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">+ Dealer Pack</span>
            <span className="font-bold text-destructive">${effectivePack.toLocaleString()}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-card-foreground">TAC</span>
            <span className="font-bold text-card-foreground">${(finalValue + reconCost + effectivePack).toLocaleString()}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-card-foreground">Projected Profit</span>
            <span className={`font-bold ${projectedProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {projectedProfit >= 0 ? "+" : ""}${projectedProfit.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Margin %</span>
            <span className={`font-bold ${profitMargin >= 0 ? "text-green-600" : "text-destructive"}`}>{profitMargin.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Market Context */}
      {bbVehicle && offerResult && (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <MarketContextPanel bbVehicle={bbVehicle} offerHigh={finalValue} />
        </div>
      )}

      {/* Live Retail Market Data */}
      {sub.vin && (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <RetailMarketPanel
            vin={sub.vin}
            uvc={bbVehicle?.uvc}
            zipcode={sub.zip || undefined}
            dealerZip={dealerZip}
            radiusMiles={activeSettings?.retail_search_radius || 100}
            offerHigh={offerResult?.high || currentOffer}
            vehicleMileage={sub.mileage}
            currentAcv={finalValue}
            onStatsLoaded={onRetailStatsLoaded}
            onClosestCompPrice={onClosestCompPrice}
          />
        </div>
      )}

      {/* Inspection At-a-Glance */}
      {hasInspection && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-primary" />
                Inspection At-a-Glance
              </CardTitle>
              {onRefreshInspection && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  disabled={refreshingInspection}
                  onClick={async () => {
                    setRefreshingInspection(true);
                    await onRefreshInspection();
                    setRefreshingInspection(false);
                  }}
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingInspection ? "animate-spin" : ""}`} />
                  {refreshingInspection ? "Syncing…" : "Refresh"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalChecks > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                {failCount > 0 && <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-destructive" /><span className="text-[10px] font-bold text-destructive">{failCount} Fail</span></div>}
                {passCount > 0 && <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-emerald-600">{passCount} Pass</span></div>}
                <span className="text-[9px] text-muted-foreground ml-auto">{totalChecks} checks</span>
              </div>
            )}
            {parsedSections.map((sec, i) => (
              <Collapsible key={i}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
                    <span className="text-[11px] font-semibold text-card-foreground">{sec.name}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 gap-0.5 pl-4 pr-1 pb-1">
                    {sec.items.map((item, j) => (
                      <div key={j} className="flex items-center justify-between py-0.5">
                        <span className="text-[10px] text-muted-foreground truncate mr-2">{item.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getStatusColor(item.status)}`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}

            {/* Detailed tire/brake widget */}
            {(hasTires || hasActualBrakes) && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full text-left text-[10px] text-muted-foreground hover:text-card-foreground px-1">
                    <span className="font-semibold">Detailed Tire & Brake Readings</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-1">
                    <BrakePadDepthWidget
                      showTires={hasTires}
                      showBrakes={hasActualBrakes}
                      tireDepths={{ leftFront: sub.tire_lf, rightFront: sub.tire_rf, leftRear: sub.tire_lr, rightRear: sub.tire_rr }}
                      brakeDepths={brakeDepths ? { leftFront: brakeDepths.lf, rightFront: brakeDepths.rf, leftRear: brakeDepths.lr, rightRear: brakeDepths.rr } : undefined}
                      readOnly compact
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {/* No inspection yet — show refresh button */}
      {!hasInspection && onRefreshInspection && (
        <Card className="border-dashed">
          <CardContent className="py-4 text-center space-y-2">
            <Wrench className="w-5 h-5 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground">No inspection data yet</p>
            <Button
              variant="outline" size="sm"
              className="text-xs gap-1.5"
              disabled={refreshingInspection}
              onClick={async () => {
                setRefreshingInspection(true);
                await onRefreshInspection();
                setRefreshingInspection(false);
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingInspection ? "animate-spin" : ""}`} />
              {refreshingInspection ? "Checking…" : "Pull Inspection Data"}
            </Button>
          </CardContent>
        </Card>
      )}

      {sub.ai_damage_summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-primary" />
              AI Damage Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={sub.ai_condition_score === "poor" || sub.ai_condition_score === "fair" ? "destructive" : "secondary"}>
              {sub.ai_condition_score || "N/A"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">{sub.ai_damage_summary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
