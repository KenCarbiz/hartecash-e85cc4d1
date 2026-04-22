/**
 * ClosestCompCard.tsx
 * Finds the listing with the closest mileage to the subject vehicle
 * and renders a highlighted summary card for quick comparison.
 */

import { useMemo } from "react";
import { Target, ExternalLink } from "lucide-react";

interface Listing {
  listing_id: string;
  model_year: string;
  make: string;
  model: string;
  series: string;
  style: string;
  price: number;
  mileage: number;
  days_on_market: number;
  dealer_name: string;
  dealer_city: string;
  dealer_state: string;
  distance_to_dealer: number;
  exterior_color: string;
  certified: boolean;
  listing_url: string;
}

interface ClosestCompCardProps {
  listings: Listing[];
  vehicleMileage: string | number | null | undefined;
  currentAcv: number;
}

function fmt(val: number | null | undefined) {
  if (val == null || val === 0) return "—";
  return `$${Math.round(val).toLocaleString()}`;
}

export default function ClosestCompCard({ listings, vehicleMileage, currentAcv }: ClosestCompCardProps) {
  const subjectMiles = typeof vehicleMileage === "number"
    ? vehicleMileage
    : parseInt(String(vehicleMileage || "0").replace(/[^0-9]/g, "")) || 0;

  const closest = useMemo(() => {
    if (!listings.length || subjectMiles <= 0) return null;
    let best: Listing | null = null;
    let bestDiff = Infinity;
    for (const l of listings) {
      if (l.mileage <= 0) continue;
      const diff = Math.abs(l.mileage - subjectMiles);
      if (diff < bestDiff) { bestDiff = diff; best = l; }
    }
    return best;
  }, [listings, subjectMiles]);

  if (!closest) return null;

  const mileageDiff = closest.mileage - subjectMiles;
  const mileageDiffLabel = mileageDiff === 0
    ? "exact match"
    : `${Math.abs(mileageDiff).toLocaleString()} mi ${mileageDiff > 0 ? "higher" : "lower"}`;

  const spread = closest.price - currentAcv;

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Closest Mileage Comp</span>
      </div>

      {/* Vehicle info */}
      <div>
        <div className="text-xs font-semibold text-card-foreground">
          {closest.model_year} {closest.make} {closest.model} {closest.series}
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
          <span>{closest.mileage.toLocaleString()} mi</span>
          <span>•</span>
          <span className="font-medium text-primary">{mileageDiffLabel}</span>
          {closest.exterior_color && <><span>•</span><span>{closest.exterior_color}</span></>}
          {closest.certified && <><span>•</span><span className="text-emerald-600 font-medium">CPO</span></>}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {closest.dealer_name} — {closest.dealer_city}, {closest.dealer_state} ({Math.round(closest.distance_to_dealer)}mi)
          {closest.days_on_market > 0 && <span> · {closest.days_on_market}d on market</span>}
        </div>
      </div>

      {/* Price comparison */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Asking</div>
          <div className="text-sm font-black text-card-foreground tabular-nums">{fmt(closest.price)}</div>
        </div>
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Your ACV</div>
          <div className="text-sm font-black text-primary tabular-nums">{fmt(currentAcv)}</div>
        </div>
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Spread</div>
          <div className={`text-sm font-black tabular-nums ${spread >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {spread >= 0 ? "+" : ""}{fmt(spread)}
          </div>
        </div>
      </div>

      {/* Link */}
      {closest.listing_url && (
        <a
          href={closest.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-primary hover:underline"
        >
          View Listing <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
}

/** Helper: given listings + subject mileage, returns the listing_id of the closest comp */
export function getClosestCompId(listings: { listing_id: string; mileage: number }[], subjectMileage: number): string | null {
  if (!listings.length || subjectMileage <= 0) return null;
  let bestId: string | null = null;
  let bestDiff = Infinity;
  for (const l of listings) {
    if (l.mileage <= 0) continue;
    const diff = Math.abs(l.mileage - subjectMileage);
    if (diff < bestDiff) { bestDiff = diff; bestId = l.listing_id; }
  }
  return bestId;
}
