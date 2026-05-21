import { useCallback, useEffect, useState } from "react";
import SEO from "@/components/SEO";
import MotoShell from "@/components/moto/MotoShell";
import MotoStepVehicleSearch from "@/components/moto/steps/MotoStepVehicleSearch";
import MotoStepCondition from "@/components/moto/steps/MotoStepCondition";
import MotoStepTradeOrSell from "@/components/moto/steps/MotoStepTradeOrSell";
import MotoStepOwnership from "@/components/moto/steps/MotoStepOwnership";
import MotoStepColor from "@/components/moto/steps/MotoStepColor";
import MotoStepContact from "@/components/moto/steps/MotoStepContact";
import MotoStepOffer from "@/components/moto/steps/MotoStepOffer";
import MotoStepPhotos from "@/components/moto/steps/MotoStepPhotos";
import MotoStepSchedule from "@/components/moto/steps/MotoStepSchedule";
import MotoStepQueued from "@/components/moto/steps/MotoStepQueued";
import MotoTrackValueBlock from "@/components/moto/MotoTrackValueBlock";
import MotoDetailedFlow from "@/components/moto-detailed/MotoDetailedFlow";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyMotoFlowState,
  type MotoFlowState,
  type MotoStepId,
} from "@/components/moto/types";

const TRACK_VALUE_STEPS: MotoStepId[] = [
  "condition", "trade-or-sell", "ownership", "color",
  "contact", "offer", "photos",
];

type RevealMode = "contact_first" | "price_first";

/**
 * In `price_first` mode the Contact step (customer info + miles +
 * SMS OTP) is deferred until AFTER the offer reveal. Any patch a
 * step component dispatches that would have set step="contact"
 * (or step="offer" coming out of contact, or step="schedule" from
 * the offer-accept path) is rewritten through this lookup.
 *
 * Keyed by (from-step → declared-next-step) so we only rewrite
 * the transitions that actually change between modes; everything
 * else (search→condition, condition→trade-or-sell, etc.) flows
 * through untouched.
 */
const PRICE_FIRST_REWRITES: Partial<Record<MotoStepId, Partial<Record<MotoStepId, MotoStepId>>>> = {
  color:   { contact: "offer" },    // Color goes straight to Offer (not Contact)
  offer:   { schedule: "contact" }, // Offer Accept defers Schedule until after Contact
  contact: { offer: "schedule" },   // Contact (now post-offer) proceeds to Schedule
};

/**
 * The MotoAcquire-style /sell flow. 8 screens, white background,
 * single per-tenant variable (CTA color via
 * site_config.landing_cta_color), plus an admin-selectable Contact
 * placement (offer_settings.pricing_reveal_mode).
 *
 * Standalone dealer microsite by default; iframed onto the dealer's
 * host site with ?embed=true strips the top + disclosure bars.
 */
const SellFlow = () => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const [state, setState] = useState<MotoFlowState>(emptyMotoFlowState);
  const [revealMode, setRevealMode] = useState<RevealMode>("contact_first");

  // Dealer-selectable journey template. Defaults to the existing
  // ultra-minimal "moto" flow; "moto_detailed" routes to the new
  // premium guided journey engine without touching the original.
  const journeyTemplate =
    ((config as any).customer_journey_template as
      | "moto"
      | "moto_detailed"
      | undefined) ?? "moto";
  const detailedOfferMode =
    ((config as any).moto_detailed_offer_display_mode as
      | "before_contact_info"
      | "after_contact_info"
      | undefined) ?? "after_contact_info";

  if (journeyTemplate === "moto_detailed") {
    return (
      <>
        <SEO
          title={`Get an Instant Vehicle Valuation | ${config.dealership_name}`}
          description={`Get a guided, premium offer from ${config.dealership_name}. See your estimated value in seconds.`}
          path="/sell"
        />
        <MotoDetailedFlow offerDisplayMode={detailedOfferMode} />
      </>
    );
  }


  // Load the dealer's contact placement preference once on mount.
  // Soft-fail to contact_first if offer_settings isn't yet populated
  // for this rooftop — that matches the rest of the flow's default.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("offer_settings")
          .select("pricing_reveal_mode")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle();
        if (cancelled || !data) return;
        const mode = (data as { pricing_reveal_mode?: string }).pricing_reveal_mode;
        if (mode === "price_first") setRevealMode("price_first");
        // "contact_first" and "range_then_price" both behave as contact_first
        // here — the moto flow doesn't have a separate range reveal mode.
      } catch (e) {
        console.warn("[SellFlow] offer_settings load failed (soft default):", e);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenant.dealership_id]);

  const update = useCallback(
    (patch: Partial<MotoFlowState>) => {
      setState((prev) => {
        const next: MotoFlowState = { ...prev, ...patch };
        if (revealMode === "price_first" && patch.step) {
          const rewrite = PRICE_FIRST_REWRITES[prev.step]?.[patch.step];
          if (rewrite) next.step = rewrite;
        }
        return next;
      });
    },
    [revealMode],
  );

  return (
    <MotoShell>
      <SEO
        title={`Get a Firm Offer in 60 Seconds | ${config.dealership_name}`}
        description={`Sell or trade your car to ${config.dealership_name}. Firm offer in 60 seconds — VIN, plate, or year-make-model.`}
        path="/sell"
      />
      {state.step === "search" && (
        <MotoStepVehicleSearch state={state} onResolved={update} />
      )}
      {state.step === "condition" && (
        <MotoStepCondition state={state} onNext={update} />
      )}
      {state.step === "trade-or-sell" && (
        <MotoStepTradeOrSell state={state} onNext={update} />
      )}
      {state.step === "ownership" && (
        <MotoStepOwnership state={state} onNext={update} />
      )}
      {state.step === "color" && (
        <MotoStepColor state={state} onNext={update} />
      )}
      {state.step === "contact" && (
        <MotoStepContact state={state} onNext={update} />
      )}
      {state.step === "offer" && (
        <MotoStepOffer state={state} onNext={update} />
      )}
      {state.step === "photos" && (
        <MotoStepPhotos state={state} onNext={update} />
      )}
      {state.step === "schedule" && <MotoStepSchedule state={state} />}
      {state.step === "queued" && <MotoStepQueued state={state} />}

      {TRACK_VALUE_STEPS.includes(state.step) && (
        <MotoTrackValueBlock state={state} />
      )}
    </MotoShell>
  );
};

export default SellFlow;
