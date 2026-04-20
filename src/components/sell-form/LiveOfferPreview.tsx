import { TrendingUp, Megaphone, Lock } from "lucide-react";
import { useMemo } from "react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { calculateOffer, type OfferSettings, type OfferRule } from "@/lib/offerCalculator";
import type { FormData, BBVehicle } from "./types";

interface Props {
  formData: FormData;
  bbVehicle?: BBVehicle | null;
  selectedAddDeducts?: string[];
  offerSettings?: OfferSettings | null;
  offerRules?: OfferRule[];
  promoBonus?: number;
  promoName?: string;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

const LiveOfferPreview = ({ formData, bbVehicle, selectedAddDeducts = [], offerSettings, offerRules = [], promoBonus = 0, promoName }: Props) => {
  const estimate = useMemo(() => {
    if (!bbVehicle?.tradein?.avg) return null;
    return calculateOffer(bbVehicle, formData, selectedAddDeducts, offerSettings, offerRules, promoBonus);
  }, [formData, bbVehicle, selectedAddDeducts, offerSettings, offerRules, promoBonus]);

  if (!estimate) return null;

  const revealMode = offerSettings?.pricing_reveal_mode ?? "price_first";

  // contact_first: show a locked teaser, no number until they submit.
  if (revealMode === "contact_first") {
    return (
      <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
          <Lock className="w-3.5 h-3.5" />
          Your Cash Offer
        </div>
        <div className="text-base font-bold text-foreground/80">
          Finish the form to see your offer
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Takes less than a minute · no obligation
        </p>
      </div>
    );
  }

  // range_then_price: show the BB-anchored range; final number revealed after submit.
  if (revealMode === "range_then_price" && estimate.displayRange) {
    return (
      <div className="bg-success/10 border border-success/25 rounded-xl p-4 mb-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-success mb-1">
          <TrendingUp className="w-3.5 h-3.5" />
          Estimated Range
        </div>
        <div className="text-xl md:text-2xl font-extrabold text-card-foreground tracking-tight tabular-nums">
          {fmt(estimate.displayRange.low)} <span className="text-muted-foreground">–</span> {fmt(estimate.displayRange.high)}
          <span className="text-success text-sm align-top ml-0.5">*</span>
        </div>
        {promoBonus > 0 && (
          <div className="flex items-center justify-center gap-1 text-xs font-semibold text-accent mt-1">
            <Megaphone className="w-3 h-3" />
            Includes ${promoBonus.toLocaleString()} bonus{promoName ? ` — ${promoName}` : ""}!
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">
          *Preliminary — final offer after we confirm details
        </p>
      </div>
    );
  }

  // price_first (default): show the exact estimated offer.
  return (
    <div className="bg-success/10 border border-success/25 rounded-xl p-4 mb-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-success mb-1">
        <TrendingUp className="w-3.5 h-3.5" />
        Estimated Offer
      </div>
      <div className="text-2xl font-extrabold text-card-foreground tracking-tight">
        <AnimatedCounter target={estimate.high} prefix="$" duration={600} />
      </div>
      {promoBonus > 0 && (
        <div className="flex items-center justify-center gap-1 text-xs font-semibold text-accent mt-1">
          <Megaphone className="w-3 h-3" />
          Includes ${promoBonus.toLocaleString()} bonus{promoName ? ` — ${promoName}` : ""}!
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-1">Updates as you answer · final offer may vary</p>
    </div>
  );
};

export default LiveOfferPreview;
