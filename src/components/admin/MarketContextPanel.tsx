import { BarChart3, MapPin, AlertTriangle, Shield, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { BBVehicle } from "@/components/sell-form/types";

interface Props {
  bbVehicle: BBVehicle;
  offerHigh: number;
}

export default function MarketContextPanel({ bbVehicle, offerHigh }: Props) {
  const retail = bbVehicle.retail;
  const wholesale = bbVehicle.wholesale;
  const tradein = bbVehicle.tradein;
  const privateParty = bbVehicle.private_party;
  const financeAdv = bbVehicle.finance_advance;
  const msrp = Number(bbVehicle.msrp || 0);

  if (!retail && !wholesale) return null;

  const rows = [
    { label: "Retail – Extra Clean", value: retail?.xclean, type: "retail" as const },
    { label: "Retail – Clean", value: retail?.clean, type: "retail" as const },
    { label: "Retail – Average", value: retail?.avg, type: "retail" as const },
    { label: "Retail – Rough", value: retail?.rough, type: "retail" as const },
    { label: "Private Party – X-Clean", value: privateParty?.xclean, type: "private" as const },
    { label: "Private Party – Clean", value: privateParty?.clean, type: "private" as const },
    { label: "Private Party – Average", value: privateParty?.avg, type: "private" as const },
    { label: "Private Party – Rough", value: privateParty?.rough, type: "private" as const },
    { label: "Trade-In – Clean", value: tradein?.clean, type: "tradein" as const },
    { label: "Trade-In – Average", value: tradein?.avg, type: "tradein" as const },
    { label: "Trade-In – Rough", value: tradein?.rough, type: "tradein" as const },
    { label: "Wholesale – Extra Clean", value: wholesale?.xclean, type: "wholesale" as const },
    { label: "Wholesale – Clean", value: wholesale?.clean, type: "wholesale" as const },
    { label: "Wholesale – Average", value: wholesale?.avg, type: "wholesale" as const },
    { label: "Wholesale – Rough", value: wholesale?.rough, type: "wholesale" as const },
  ].filter(r => r.value && Number(r.value) > 0);

  const maxVal = Math.max(...rows.map(r => Number(r.value)), offerHigh);

  const typeColors: Record<string, string> = {
    retail: "bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-400",
    private: "bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-400",
    tradein: "bg-primary/20 border-primary/30 text-primary",
    wholesale: "bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-400",
  };

  const hasFinanceAdv = financeAdv && (financeAdv.avg > 0 || financeAdv.clean > 0);
  const hasResiduals = (bbVehicle.residual_12 || 0) > 0 || (bbVehicle.residual_24 || 0) > 0 || (bbVehicle.residual_36 || 0) > 0;
  const hasRecalls = (bbVehicle.recall_count || 0) > 0 && bbVehicle.recalls?.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Market Values (Black Book)
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>Regional adjusted</span>
        </div>
      </div>

      {msrp > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded border border-border bg-muted/20 text-xs">
          <span className="font-medium text-muted-foreground">Original MSRP</span>
          <span className="font-bold text-card-foreground">${msrp.toLocaleString()}</span>
        </div>
      )}

      <div className="space-y-1">
        {rows.map((row) => {
          const val = Number(row.value);
          const barWidth = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const diff = val - offerHigh;
          const isOfferHigher = diff < 0;

          return (
            <div key={row.label} className="flex items-center gap-2 group">
              <div className="w-32 shrink-0 text-right">
                <span className="text-[10px] text-muted-foreground leading-tight">{row.label}</span>
              </div>
              <div className="flex-1 h-5 relative">
                <div
                  className={`h-full rounded-sm border ${typeColors[row.type]} transition-all duration-300 flex items-center`}
                  style={{ width: `${Math.max(barWidth, 3)}%` }}
                >
                  <span className="text-[9px] font-bold px-1.5 truncate">
                    ${val.toLocaleString()}
                  </span>
                </div>
                {offerHigh > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/60 z-10"
                    style={{ left: `${(offerHigh / maxVal) * 100}%` }}
                  />
                )}
              </div>
              <div className="w-16 shrink-0 text-right">
                <span className={`text-[9px] font-medium ${isOfferHigher ? "text-destructive" : "text-green-600"}`}>
                  {diff > 0 ? "+" : ""}${diff.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}

        {/* Your offer row */}
        {offerHigh > 0 && (
          <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border">
            <div className="w-32 shrink-0 text-right">
              <span className="text-[10px] font-bold text-primary">Your Offer</span>
            </div>
            <div className="flex-1 h-5 relative">
              <div
                className="h-full rounded-sm bg-primary border border-primary/40 flex items-center"
                style={{ width: `${Math.max((offerHigh / maxVal) * 100, 3)}%` }}
              >
                <span className="text-[9px] font-bold px-1.5 text-primary-foreground truncate">
                  ${offerHigh.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="w-16 shrink-0" />
          </div>
        )}
      </div>

      {/* Finance Advance / Equipped Retail */}
      {hasFinanceAdv && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-card-foreground w-full text-left py-1">
            <DollarSign className="w-3 h-3" />
            Equipped / Finance Advance Values
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs px-2 py-1.5">
              {financeAdv!.xclean > 0 && <div className="flex justify-between"><span className="text-muted-foreground">X-Clean</span><span className="font-bold">${financeAdv!.xclean.toLocaleString()}</span></div>}
              {financeAdv!.clean > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Clean</span><span className="font-bold">${financeAdv!.clean.toLocaleString()}</span></div>}
              {financeAdv!.avg > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Average</span><span className="font-bold">${financeAdv!.avg.toLocaleString()}</span></div>}
              {financeAdv!.rough > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Rough</span><span className="font-bold">${financeAdv!.rough.toLocaleString()}</span></div>}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Residual Values */}
      {hasResiduals && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-card-foreground w-full text-left py-1">
            <Shield className="w-3 h-3" />
            Residual / Future Values
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs px-2 py-1.5">
              {(bbVehicle.residual_12 || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">12-Month</span><span className="font-bold">${Number(bbVehicle.residual_12).toLocaleString()}</span></div>}
              {(bbVehicle.residual_24 || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">24-Month</span><span className="font-bold">${Number(bbVehicle.residual_24).toLocaleString()}</span></div>}
              {(bbVehicle.residual_36 || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">36-Month</span><span className="font-bold">${Number(bbVehicle.residual_36).toLocaleString()}</span></div>}
              {(bbVehicle.residual_48 || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">48-Month</span><span className="font-bold">${Number(bbVehicle.residual_48).toLocaleString()}</span></div>}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Recall Alerts */}
      {hasRecalls && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">
              {bbVehicle.recall_count} Open Recall{(bbVehicle.recall_count || 0) > 1 ? "s" : ""}
            </span>
          </div>
          {bbVehicle.recalls!.map((r, i) => (
            <div key={i} className="text-[10px] text-muted-foreground pl-5">
              <span className="font-semibold text-card-foreground">{r.component}</span>
              {r.summary && <span className="ml-1">— {r.summary.substring(0, 100)}{r.summary.length > 100 ? "…" : ""}</span>}
              {r.campaign_number && <Badge variant="outline" className="text-[7px] ml-1 px-1 py-0">{r.campaign_number}</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
