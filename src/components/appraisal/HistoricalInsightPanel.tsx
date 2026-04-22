import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ChevronDown, AlertTriangle, TrendingUp } from "lucide-react";

export interface HistoricalInsight {
  sampleSize: number;
  avgAcceptanceRate: number;
  avgDaysToSale: number;
  avgReconActual: number;
  priceRealizationPct: number;
  recommendedBasisAdjustmentPct: number;
}

interface Props {
  dealershipId: string;
  bbClassName: string | null;
  overallCondition: string;
  mileage: string | null;
  reconEstimate: number;
  learningThreshold?: number;
}

function getConfidenceLabel(n: number): { label: string; color: string } {
  if (n >= 150) return { label: "High confidence", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" };
  if (n >= 75) return { label: "Good confidence", color: "text-primary bg-primary/10 border-primary/30" };
  if (n >= 30) return { label: "Moderate confidence", color: "text-amber-600 bg-amber-500/10 border-amber-500/30" };
  return { label: "Low confidence — early data", color: "text-muted-foreground bg-muted border-border" };
}

function getAcceptanceSignal(rate: number): { label: string; color: string } {
  if (rate >= 0.85) return { label: "⚠ May be overpaying", color: "text-amber-600" };
  if (rate >= 0.60) return { label: "● Healthy", color: "text-emerald-600" };
  return { label: "▼ Below target", color: "text-destructive" };
}

export default function HistoricalInsightPanel({ dealershipId, bbClassName, overallCondition, mileage, reconEstimate, learningThreshold = 250 }: Props) {
  const [insight, setInsight] = useState<HistoricalInsight | null>(null);
  const [totalFinalized, setTotalFinalized] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bbClassName) { setLoading(false); return; }
    const fetchInsight = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("compute-historical-insight", {
          body: {
            dealership_id: dealershipId,
            bb_class_name: bbClassName,
            overall_condition: overallCondition,
            mileage: parseInt((mileage || "0").replace(/\D/g, "")) || 0,
          },
        });
        if (!error && data) {
          setTotalFinalized(data.total_finalized || 0);
          if (data.insight) setInsight(data.insight);
        }
      } catch (e) {
        console.error("Historical insight fetch error:", e);
      }
      setLoading(false);
    };
    fetchInsight();
  }, [dealershipId, bbClassName, overallCondition, mileage]);

  if (loading) return null;

  // Early-learning state — show a visible placeholder instead of hiding
  // the panel entirely. Before this change the panel silently disappeared
  // for any dealership below the learning threshold, which made the
  // feature invisible in demos and during the first few weeks of use.
  if (totalFinalized < learningThreshold || !insight) {
    const progress = Math.min(100, Math.round((totalFinalized / learningThreshold) * 100));
    return (
      <Card className="border-l-4 border-l-muted-foreground/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
              Autocurb Historical Intelligence
            </CardTitle>
            <Badge variant="outline" className="text-[9px] text-muted-foreground bg-muted border-border">
              Early learning
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {totalFinalized} / {learningThreshold} finalized deals — learning your store's appraisal signal
          </p>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary/60 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            Once your store finalizes {learningThreshold} appraisals, this panel will surface
            segment-level acceptance rate, days-to-sale, price realization, and recon
            accuracy from your own historical data — plus a recommended basis adjustment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const confidence = getConfidenceLabel(insight.sampleSize);
  const acceptance = getAcceptanceSignal(insight.avgAcceptanceRate);
  const reconDelta = insight.avgReconActual - reconEstimate;
  const showReconWarning = reconEstimate > 0 && insight.avgReconActual > 0 && (insight.avgReconActual / reconEstimate) > 1.25;
  const showPriceWarning = insight.priceRealizationPct < 0.88;

  // Suggestion text
  let suggestion = "Current offer is within normal acceptance range for this vehicle segment.";
  if (insight.avgAcceptanceRate < 0.60) {
    suggestion = `Acceptance rate is low (${Math.round(insight.avgAcceptanceRate * 100)}%). Consider stepping up the anchor by ${Math.abs(insight.recommendedBasisAdjustmentPct).toFixed(1)}% to improve conversion.`;
  } else if (insight.avgAcceptanceRate > 0.85) {
    suggestion = `Acceptance rate is very high (${Math.round(insight.avgAcceptanceRate * 100)}%). You may be overpaying — consider tightening the offer basis.`;
  }

  return (
    <Collapsible>
      <Card className="border-l-4 border-l-primary/60">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  AutoCurb Historical Intelligence
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[9px] ${confidence.color}`}>
                    {confidence.label}
                  </Badge>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Based on {insight.sampleSize} similar vehicles at your store
              </p>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Acceptance Rate</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-lg font-black text-card-foreground">{Math.round(insight.avgAcceptanceRate * 100)}%</span>
                  <span className={`text-[9px] font-bold ${acceptance.color}`}>{acceptance.label}</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Avg Days to Sale</div>
                <span className="text-lg font-black text-card-foreground">{Math.round(insight.avgDaysToSale)} days</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Price Realization</div>
                <span className="text-lg font-black text-card-foreground">{Math.round(insight.priceRealizationPct * 100)}% <span className="text-[10px] font-normal text-muted-foreground">of BB Retail</span></span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Recon Accuracy</div>
                <span className={`text-lg font-black ${reconDelta > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {reconDelta >= 0 ? "+" : ""}${Math.round(reconDelta).toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1">vs estimate</span>
              </div>
            </div>

            {/* Warnings */}
            {showReconWarning && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  <strong>Recon Warning:</strong> Historical data shows recon for {bbClassName} vehicles runs ${Math.round(reconDelta).toLocaleString()} over estimate. Adjusted reserve: ${Math.round(insight.avgReconActual).toLocaleString()}.
                </p>
              </div>
            )}

            {showPriceWarning && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  <strong>Price Realization:</strong> This vehicle type historically retails at {Math.round(insight.priceRealizationPct * 100)}¢ on the retail dollar in your market. Adjust your retail expectation accordingly.
                </p>
              </div>
            )}

            {/* Suggestion */}
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-[10px] text-card-foreground">
                <strong>Suggestion:</strong> {suggestion}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
