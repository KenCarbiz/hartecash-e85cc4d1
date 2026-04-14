import { ArrowRight, Check, Sparkles } from "lucide-react";
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
 */
export interface PlanCardProps {
  name: string;
  description?: string | null;
  monthlyPrice: number;
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
  onSelect?: () => void;
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

        {/* CTA */}
        {!readOnly && (
          <Button
            variant={selected ? "default" : "outline"}
            size="sm"
            className="w-full mt-auto"
            disabled={disabled}
            onClick={onSelect}
          >
            {selected ? (
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
      </CardContent>
    </Card>
  );
}
