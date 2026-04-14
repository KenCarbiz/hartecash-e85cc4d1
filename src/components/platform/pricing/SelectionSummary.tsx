import { ArrowRight, Receipt } from "lucide-react";
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
  readOnly = false,
  ctaLabel = "Continue",
  onConfirm,
  compact = false,
}: SelectionSummaryProps) {
  const multiplied = perRooftopTotal * rooftopCount;

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

        <div className="rounded-lg bg-card/70 border border-border/50 px-3 py-2.5 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly total
            </span>
            <span className="text-lg font-bold text-card-foreground">
              {formatUSD(multiplied)}
              <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
            </span>
          </div>
          {rooftopCount > 1 && (
            <div className="text-[10px] text-muted-foreground">
              {formatUSD(perRooftopTotal)}/rooftop × {rooftopCount} rooftops
            </div>
          )}
          {rooftopCount === 1 && (
            <div className="text-[10px] text-muted-foreground">Per rooftop, billed monthly</div>
          )}
        </div>

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
