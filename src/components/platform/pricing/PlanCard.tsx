import { ArrowRight, Check, Sparkles, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUSD } from "@/lib/entitlements";

/**
 * A single selectable pricing card. Used for:
 *   - per-product tiers (AutoCurb Starter, AutoFrame 120, etc.)
 *   - the All-Apps Unlimited hero bundle (variant="hero")
 *
 * Visual anatomy (from research synthesis):
 *   1. Optional corner badge (Introductory / Included free / Best value)
 *   2. Name + one-line positioning
 *   3. Price (big) + unit (small, muted)
 *   4. Rooftop math line (when rooftopCount > 1)
 *   5. Features list (<= maxFeatures, checkmark bullets)
 *   6. Muted footer divider with inventory cap + overage
 *   7. Full-width CTA
 *   8. (optional) Annual-prepaid savings box — rendered when
 *      `annualPricePerMonth` is provided. Gives AutoCurb + AutoFilm
 *      the "pay 12 months upfront, save $X" affordance that the rows
 *      variant has via the side-by-side monthly/annual buttons.
 */
export interface PlanCardProps {
  name: string;
  description?: string | null;
  monthlyPrice: number;
  /**
   * Per-month-equivalent rate when billed annually prepaid. When
   * supplied, the card renders a selectable annual savings box under
   * the primary CTA. Omit for tiers that don't expose an annual plan.
   */
  annualPricePerMonth?: number;
  /** True when the currently-selected cycle on this tier is "annual". */
  annualSelected?: boolean;
  rooftopCount: number;
  features: string[];
  maxFeatures?: number;
  badge?: {
    label: string;
    tone: "amber" | "emerald" | "primary";
  } | null;
  footerLines?: Array<{ label: string; tone?: "muted" | "amber" }>;
  selected: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /**
   * Called on CTA click. Receives the cycle the user chose — "monthly"
   * for the primary CTA, "annual" for the annual-prepaid savings box.
   * Omit or ignore when the tier has no annual plan.
   */
  onSelect?: (cycle?: "monthly" | "annual") => void;
  selectLabel?: string;
  variant?: "tier" | "hero";
  /** Optional leading adornment, e.g. product icon */
  icon?: React.ReactNode;
}

const BADGE_CLASSES: Record<"amber" | "emerald" | "primary", string> = {
  amber: "bg-amber-500 text-white",
  emerald: "bg-emerald-500 text-white",
  primary: "bg-primary text-primary-foreground",
};

export function PlanCard({
  name,
  description,
  monthlyPrice,
  annualPricePerMonth,
  annualSelected = false,
  rooftopCount,
  features,
  maxFeatures = 5,
  badge,
  footerLines,
  selected,
  disabled = false,
  readOnly = false,
  onSelect,
  selectLabel = "Select",
  variant = "tier",
  icon,
}: PlanCardProps) {
  const multiplied = monthlyPrice * rooftopCount;
  const isHero = variant === "hero";

  // The monthly CTA is "selected" only when the tier itself is selected
  // AND the user picked the monthly cycle. Annual CTA uses annualSelected.
  const monthlySelected = selected && !annualSelected;
  const annualSavings =
    annualPricePerMonth != null ? monthlyPrice - annualPricePerMonth : 0;
  const annualDiscountPct =
    annualPricePerMonth != null && monthlyPrice > 0
      ? Math.round(((monthlyPrice - annualPricePerMonth) / monthlyPrice) * 100)
      : 0;

  return (
    <Card
      className={`relative overflow-hidden transition-all flex flex-col ${
        isHero
          ? selected
            ? "border-primary/60 shadow-xl ring-2 ring-primary/40"
            : "border-primary/30 shadow-lg hover:shadow-xl"
          : selected
            ? "border-primary/60 shadow-md ring-1 ring-primary/30"
            : "border-border/60 hover:border-border"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {isHero && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent pointer-events-none" />
      )}

      {badge && (
        <div
          className={`absolute top-0 right-0 text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl-lg ${BADGE_CLASSES[badge.tone]}`}
        >
          {badge.label}
        </div>
      )}

      <CardContent
        className={`relative flex flex-col ${isHero ? "p-5 sm:p-6" : "p-4"} gap-3 flex-1`}
      >
        {/* Header */}
        <div className="flex items-start gap-2.5">
          {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isHero && <Sparkles className="w-4 h-4 text-primary shrink-0" />}
              <p
                className={`${isHero ? "text-base" : "text-sm"} font-bold text-card-foreground leading-tight`}
              >
                {name}
              </p>
            </div>
            {description && (
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Price block */}
        <div>
          <p
            className={`${isHero ? "text-3xl" : "text-2xl"} font-bold text-card-foreground leading-none`}
          >
            {formatUSD(monthlyPrice)}
            <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
              /rooftop/mo
            </span>
          </p>
          {rooftopCount > 1 && (
            <p className="text-[10px] text-primary font-semibold mt-1">
              {formatUSD(multiplied)}/mo × {rooftopCount} rooftops
            </p>
          )}
        </div>

        {/* Features */}
        {features.length > 0 && (
          <ul className="space-y-1.5 pt-2 border-t border-border/40 text-[11px] flex-1">
            {features.slice(0, maxFeatures).map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-card-foreground leading-snug">{f}</span>
              </li>
            ))}
            {features.length > maxFeatures && (
              <li className="text-[10px] text-muted-foreground italic pl-[18px]">
                + {features.length - maxFeatures} more
              </li>
            )}
          </ul>
        )}

        {/* Footer metadata — inventory caps, overage */}
        {footerLines && footerLines.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-0.5">
            {footerLines.map((line) => (
              <p
                key={line.label}
                className={`text-[10px] ${
                  line.tone === "amber"
                    ? "text-amber-600 font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {line.label}
              </p>
            ))}
          </div>
        )}

        {/* Monthly CTA */}
        {!readOnly && (
          <Button
            variant={monthlySelected ? "default" : "outline"}
            size="sm"
            className="w-full mt-auto"
            disabled={disabled}
            onClick={() => onSelect?.("monthly")}
          >
            {monthlySelected ? (
              <>
                Selected <Check className="w-3.5 h-3.5 ml-1.5" />
              </>
            ) : (
              <>
                {selectLabel}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </>
            )}
          </Button>
        )}

        {/* Annual-prepaid savings box — only when tier exposes annual */}
        {!readOnly && annualPricePerMonth != null && annualSavings > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.("annual")}
            aria-pressed={annualSelected}
            className={`group w-full rounded-xl border p-3 text-left transition-all ${
              annualSelected
                ? "border-emerald-500/70 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-sm"
                : "border-emerald-500/30 bg-emerald-500/[0.04] hover:border-emerald-500/60 hover:bg-emerald-500/[0.08]"
            } ${disabled ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Pay 12 months upfront
                  </p>
                </div>
                <p
                  className="text-base font-bold text-card-foreground leading-none mt-1.5"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatUSD(annualPricePerMonth)}
                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                    /rooftop/mo
                  </span>
                </p>
                <p
                  className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  Save {formatUSD(annualSavings)}/mo · {annualDiscountPct}% off
                </p>
              </div>
              <div className="shrink-0">
                {annualSelected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                    <Check className="w-3 h-3" />
                    On
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-colors">
                    Switch
                    <ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          </button>
        )}
      </CardContent>
    </Card>
  );
}
