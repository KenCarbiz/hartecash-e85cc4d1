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
  perRooftopTotal: number;
  rooftopCount: number;
  /**
   * Full 12-month upfront amount per rooftop when the current selection
   * is on the annual-prepaid cycle. Renders an extra emerald "Due now"
   * bubble underneath the monthly total. Omit for monthly-only
   * selections — the bubble stays hidden and the monthly figure in the
   * bubble above is unaffected.
   */
  annualPrepaidPerRooftop?: number | null;
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
  readOnly = false,
  ctaLabel = "Continue",
  onConfirm,
  compact = false,
}: SelectionSummaryProps) {
  const multiplied = perRooftopTotal * rooftopCount;
  const dueNow =
    annualPrepaidPerRooftop != null && annualPrepaidPerRooftop > 0
      ? annualPrepaidPerRooftop * rooftopCount
      : 0;
  // Per user direction (2026-04-15): show ONLY the billing state
  // that's actually happening — no Monthly Total when on annual,
  // no Due-Now when on monthly. Avoids implying a phantom charge.
  const onAnnual = dueNow > 0;
  const showMonthly = !onAnnual && multiplied > 0;
  // Annual equivalent monthly rate — what the dealer pays per month
  // at renewal after the upfront period.
  const annualMonthlyEquiv = onAnnual ? Math.round(dueNow / 12) : 0;

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

        {/* Monthly Total — ONLY when cycle is monthly. Hidden when the
            user is on an annual-prepaid plan to avoid implying a
            double charge. */}
        {showMonthly && (
          <div className="rounded-lg bg-card/70 border border-border/50 px-3 py-2.5 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly total
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
                Per rooftop, billed monthly
              </div>
            )}
          </div>
        )}

        {/* Annual-prepaid "Due now" bubble — renders only when the user
            is on an annual cycle. Mutually exclusive with the Monthly
            Total bubble above. */}
        {onAnnual && (
          <div className="rounded-lg border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.04] px-3 py-2.5 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <TrendingDown className="w-3 h-3" />
                Due now · 12 mo upfront
              </span>
              <span
                className="text-lg font-bold text-card-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatUSD(dueNow)}
              </span>
            </div>
            <div
              className="text-[10px] text-emerald-700 dark:text-emerald-400"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              Then {formatUSD(annualMonthlyEquiv * rooftopCount)}/mo at renewal
              {rooftopCount > 1 && ` · ${rooftopCount} rooftops`}
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
