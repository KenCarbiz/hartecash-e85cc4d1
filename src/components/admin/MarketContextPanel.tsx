import { BarChart3, MapPin, ExternalLink } from "lucide-react";
import type { BBVehicle } from "@/components/sell-form/types";

interface Props {
  bbVehicle: BBVehicle;
  offerHigh: number;
}

export default function MarketContextPanel({ bbVehicle, offerHigh }: Props) {
  const retail = bbVehicle.retail;
  const wholesale = bbVehicle.wholesale;
  const tradein = bbVehicle.tradein;
  const msrp = Number(bbVehicle.msrp || 0);

  if (!retail && !wholesale) return null;

  const rows = [
    { label: "Retail – Extra Clean", value: retail?.xclean, type: "retail" as const },
    { label: "Retail – Clean", value: retail?.clean, type: "retail" as const },
    { label: "Retail – Average", value: retail?.avg, type: "retail" as const },
    { label: "Retail – Rough", value: retail?.rough, type: "retail" as const },
    { label: "Trade-In – Clean", value: tradein?.clean, type: "tradein" as const },
    { label: "Trade-In – Average", value: tradein?.avg, type: "tradein" as const },
    { label: "Trade-In – Rough", value: tradein?.rough, type: "tradein" as const },
    { label: "Wholesale – Extra Clean", value: wholesale?.xclean, type: "wholesale" as const },
    { label: "Wholesale – Clean", value: wholesale?.clean, type: "wholesale" as const },
    { label: "Wholesale – Average", value: wholesale?.avg, type: "wholesale" as const },
    { label: "Wholesale – Rough", value: wholesale?.rough, type: "wholesale" as const },
  ].filter(r => r.value && Number(r.value) > 0);

  const maxVal = Math.max(...rows.map(r => Number(r.value)), offerHigh);

  const typeColors = {
    retail: "bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-400",
    tradein: "bg-primary/20 border-primary/30 text-primary",
    wholesale: "bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-400",
  };

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
                {/* Offer line overlay */}
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

      {/* Phase 2 hint */}
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-border bg-muted/10 mt-2">
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground">
          <strong>Coming Soon:</strong> Live market listings — comparable vehicles for sale within 100 miles with real asking prices.
        </span>
      </div>
    </div>
  );
}
