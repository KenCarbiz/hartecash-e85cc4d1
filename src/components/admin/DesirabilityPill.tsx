/**
 * DesirabilityPill — bronze/silver/gold/platinum tier badge.
 *
 * Surfaces vehicle-desirability at acquisition time on every
 * customer-file surface. Same component on the Classic slide-out,
 * the V2 slide-out, the appraisal screen, and (eventually) the
 * All Leads SCORE column — so the tier is consistent across the
 * pipeline.
 *
 * Computes from existing submission fields (BB spread, age, mileage,
 * offer ratio). No new data dependencies. Returns null when there
 * isn't enough data to compute, so nothing renders until BB values
 * are pulled.
 *
 * Tooltip surfaces the rationale (worst signal first) so the appraiser
 * can read WHY a vehicle is rated the way it is without opening the
 * appraisal tool. "Bronze: thin spread ($800) · 12yr old · offer at
 * 82% of retail" is far more actionable than just the color.
 */

import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { computeDesirabilityTier, type DesirabilityTier } from "@/lib/desirabilityTier";

interface DesirabilityPillProps {
  submission: {
    vehicle_year: string | null;
    mileage: string | null;
    offered_price: number | null;
    estimated_offer_high: number | null;
    bb_wholesale_avg?: number | null;
    bb_retail_avg?: number | null;
    bb_tradein_avg?: number | null;
  };
  /** "onDark" tweaks the styling for header strips that sit on a
   *  primary-colored background (Classic header banner, V2 header
   *  banner). Default "default" suits light-background contexts
   *  (All Leads cell, Appraisal tool). */
  variant?: "default" | "onDark";
  /** When true, hide the tier label and just show the medal +
   *  color dot. Useful in dense rows. */
  compact?: boolean;
  className?: string;
}

const TIER_META: Record<DesirabilityTier, {
  label: string;
  medal: string;
  onLight: string;
  onDark: string;
  ringHex: string;
}> = {
  platinum: {
    label: "Platinum",
    medal: "🏆",
    onLight: "bg-slate-100 text-slate-900 border-slate-300",
    onDark:  "bg-slate-100/95 text-slate-900 border-slate-200",
    ringHex: "#94a3b8",
  },
  gold: {
    label: "Gold",
    medal: "🥇",
    onLight: "bg-amber-100 text-amber-900 border-amber-300",
    onDark:  "bg-amber-300/90 text-amber-950 border-amber-200",
    ringHex: "#f59e0b",
  },
  silver: {
    label: "Silver",
    medal: "🥈",
    onLight: "bg-zinc-100 text-zinc-700 border-zinc-300",
    onDark:  "bg-zinc-200/90 text-zinc-900 border-zinc-200",
    ringHex: "#a1a1aa",
  },
  bronze: {
    label: "Bronze",
    medal: "🥉",
    onLight: "bg-orange-100 text-orange-900 border-orange-300",
    onDark:  "bg-orange-400/90 text-orange-950 border-orange-300",
    ringHex: "#fb923c",
  },
};

export default function DesirabilityPill({
  submission,
  variant = "default",
  compact = false,
  className,
}: DesirabilityPillProps) {
  const result = computeDesirabilityTier(submission);
  if (!result) return null;

  const meta = TIER_META[result.tier];
  const colorClass = variant === "onDark" ? meta.onDark : meta.onLight;

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-wider font-bold whitespace-nowrap ${colorClass} ${className ?? ""}`}
            aria-label={`Desirability: ${meta.label} (score ${result.score})`}
          >
            <span aria-hidden="true">{meta.medal}</span>
            {!compact && meta.label}
            <span
              className="ml-0.5 font-mono opacity-70"
              aria-hidden="true"
            >
              {result.score}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-xs leading-snug"
        >
          <div className="text-[12.5px] font-bold mb-1">
            {meta.medal} {meta.label} · score {result.score}/100
          </div>
          <div className="text-[11.5px] space-y-0.5 text-muted-foreground">
            {result.rationale.map((line, i) => (
              <div key={i}>· {line}</div>
            ))}
            <div className="mt-1.5 pt-1.5 border-t border-border text-[10.5px] opacity-80">
              Computed from BB retail/wholesale spread, age, mileage,
              and offer-to-retail ratio.
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
