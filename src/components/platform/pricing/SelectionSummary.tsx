import { ArrowRight, Receipt, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUSD } from "@/lib/entitlements";

/**
 * Live running-total summary. Used in two modes:
 *   - sticky right-rail on `/plan` (desktop)
 *   - bottom strip in onboarding / mobile (sticks to bottom of viewport
 *     when compact=true)
 */
interface SelectionSummaryProps {
  title: string;
  subtitle?: string;
  /**
   * Running MONTHLY COMMITMENT per rooftop. Sums the monthly rate of
   * every selected tier (monthly_price for monthly tiers, annual/12
   * for annual tiers). Always shown when anything is selected.
   */
  perRooftopTotal: number;
  rooftopCount: number;
  /**
   * Per-rooftop sum of full 12-month prepaid amounts from every tier
   * that's currently on the annual cycle. Drives the "Annual prepaid
   * total" bubble. Null/0 when nothing is annual (bubble hides).
   */
  annualPrepaidPerRooftop?: number | null;
  /**
   * Per-rooftop DUE TODAY — what actually hits the dealer's card on
   * day one. For monthly tiers this is the first month's bill; for
   * annual tiers it's the full 12-month upfront. Renders only when
   * there's an annual prepaid element — otherwise the Monthly Total
   * IS the due-today amount and the extra bubble would be redundant.
   */
  dueTodayPerRooftop?: number | null;
  readOnly?: boolean;
  ctaLabel?: string;
  onConfirm?: () => void;
  compact?: boolean;
}

export function SelectionSummary({
  title,
  subtitle,
  perRooftopTotal,
  rooftopCount,
  annualPrepaidPerRooftop = null,
  dueTodayPerRooftop = null,
  readOnly = false,
  ctaLabel = "Continue",
  onConfirm,
  compact = false,
}: SelectionSummaryProps) {
  const multiplied = perRooftopTotal * rooftopCount;
  const annualPrepaidTotal =
    annualPrepaidPerRooftop != null && annualPrepaidPerRooftop > 0
      ? annualPrepaidPerRooftop * rooftopCount
      : 0;
  const dueToday =
    dueTodayPerRooftop != null && dueTodayPerRooftop > 0
      ? dueTodayPerRooftop * rooftopCount
      : 0;
  const hasAnnual = annualPrepaidTotal > 0;
  const showMonthly = multiplied > 0;

  return (
    <Card
      className={`border-primary/30 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent shadow-md ${
        compact ? "" : "sticky top-4"
      }`}
    >
      <div className={`${compact ? "p-4" : "p-5"} space-y-3`}>
        <div className="flex items-center gap-2">
          <Receipt className="w-3.5 h-3.5 text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Your selection
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-card-foreground leading-tight">{title}</p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>

        {/* Monthly commitment — always shown. Accumulates every
            selected tier's per-month rate (monthly_price for monthly
            tiers, annual/12 for annual tiers). */}
        {showMonthly && (
          <div className="rounded-lg bg-card/70 border border-border/50 px-3 py-2.5 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly commitment
              </span>
              <span
                className="text-lg font-bold text-card-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatUSD(multiplied)}
                <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
              </span>
            </div>
            {rooftopCount > 1 ? (
              <div
                className="text-[10px] text-muted-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatUSD(perRooftopTotal)}/rooftop × {rooftopCount} rooftops
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">
                {hasAnnual
                  ? "Equivalent monthly rate across all apps"
                  : "Per rooftop, billed monthly"}
              </div>
            )}
          </div>
        )}

        {/* Annual prepaid total — sum of 12-month upfronts for every
            tier currently on the annual cycle. Only shown when at
            least one item is annual. */}
        {hasAnnual && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.05] px-3 py-2.5 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <TrendingDown className="w-3 h-3" />
                Annual prepaid total
              </span>
              <span
                className="text-base font-bold text-card-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatUSD(annualPrepaidTotal)}
              </span>
            </div>
            <div
              className="text-[10px] text-emerald-700 dark:text-emerald-400"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              12 months upfront · covers every annual-prepaid app
            </div>
          </div>
        )}

        {/* Due today — what hits the dealer's card on day one.
            First month of monthly tiers + 12-month upfront for annual
            tiers. Always shown when there's a selection, so the dealer
            sees the actual charge. */}
        {dueToday > 0 && (
          <div className="rounded-lg border border-primary/60 bg-gradient-to-br from-primary/15 to-primary/5 px-3 py-3 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Due today
              </span>
              <span
                className="text-xl font-bold text-card-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatUSD(dueToday)}
              </span>
            </div>
            <div
              className="text-[10px] text-muted-foreground leading-snug"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {hasAnnual
                ? "First month of monthly apps + 12-month upfront"
                : "First month billed on checkout"}
            </div>
          </div>
        )}

        {!readOnly && onConfirm && (
          <Button size="sm" className="w-full" onClick={onConfirm}>
            {ctaLabel}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground leading-snug">
          Stripe checkout wires up shortly. Your selection is saved immediately.
        </p>
      </div>
    </Card>
  );
}
