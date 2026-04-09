import { useMemo } from "react";
import { Target, MapPin, TrendingUp, TrendingDown } from "lucide-react";
import type { RetailStats } from "./RetailMarketPanel";

interface Listing {
  listing_id: string;
  model_year: string;
  make: string;
  model: string;
  series: string;
  price: number;
  mileage: number;
  distance_to_dealer: number;
  days_on_market: number;
}

interface Props {
  listings: Listing[];
  stats: RetailStats | null;
  vehicleMileage: string | number;
  currentOffer: number;
}

function fmt(v: number) {
  return `$${Math.round(v).toLocaleString()}`;
}

export default function MarketCalibrationStrip({ listings, stats, vehicleMileage, currentOffer }: Props) {
  const subjectMiles = typeof vehicleMileage === "number"
    ? vehicleMileage
    : parseInt(String(vehicleMileage || "0").replace(/[^0-9]/g, "")) || 0;

  const sorted = useMemo(() => {
    if (!listings.length || subjectMiles <= 0) return [];
    return [...listings]
      .filter(l => l.mileage > 0)
      .sort((a, b) => Math.abs(a.mileage - subjectMiles) - Math.abs(b.mileage - subjectMiles));
  }, [listings, subjectMiles]);

  const closest = sorted[0] || null;
  const second = sorted[1] || null;
  const soldAvg = stats?.sold?.mean_price ?? null;

  if (!closest && !soldAvg) return null;

  const delta = closest ? currentOffer - closest.price : null;

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
          Market Calibration
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Closest comp */}
        {closest && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-2 space-y-0.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Closest Comp</div>
            <div className="text-sm font-black text-card-foreground tabular-nums">{fmt(closest.price)}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">
              {closest.mileage.toLocaleString()} mi · {Math.round(closest.distance_to_dealer)} mi away · {closest.days_on_market}d
            </div>
          </div>
        )}

        {/* Second closest */}
        {second && (
          <div className="rounded-md border border-border bg-muted/20 p-2 space-y-0.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">2nd Closest</div>
            <div className="text-sm font-black text-card-foreground tabular-nums">{fmt(second.price)}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">
              {second.mileage.toLocaleString()} mi · {Math.round(second.distance_to_dealer)} mi away · {second.days_on_market}d
            </div>
          </div>
        )}

        {/* 90d Sold Avg */}
        {soldAvg != null && soldAvg > 0 && (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 space-y-0.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">90d Sold Avg</div>
            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(soldAvg)}</div>
            {stats?.sold?.vehicle_count && (
              <div className="text-[9px] text-muted-foreground">{stats.sold.vehicle_count} sold</div>
            )}
          </div>
        )}

        {/* Current Offer */}
        {currentOffer > 0 && (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-2 space-y-0.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Your Offer</div>
            <div className="text-sm font-black text-primary tabular-nums">{fmt(currentOffer)}</div>
          </div>
        )}
      </div>

      {/* Insight */}
      {delta != null && closest && (
        <div className="flex items-center gap-1.5 text-[10px] px-1">
          {delta < 0 ? (
            <TrendingDown className="w-3 h-3 text-emerald-500 shrink-0" />
          ) : (
            <TrendingUp className="w-3 h-3 text-amber-500 shrink-0" />
          )}
          <span className="text-muted-foreground">
            Your offer is{" "}
            <strong className={delta < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
              {fmt(Math.abs(delta))} {delta < 0 ? "below" : "above"}
            </strong>{" "}
            the closest comp ({closest.model_year} {closest.make} {closest.model} at {closest.mileage.toLocaleString()} mi)
          </span>
        </div>
      )}
    </div>
  );
}
