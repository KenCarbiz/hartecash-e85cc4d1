import { useCallback, useState } from "react";
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
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { emptyMotoFlowState, type MotoFlowState } from "@/components/moto/types";

// Steps where the persistent "Track your vehicle value for free!"
// re-engagement card hangs below the active step. Skipped on the
// search screen (no vehicle yet) and on the converted end states
// (the customer is already in the dealer's pipeline).
const TRACK_VALUE_STEPS: MotoFlowState["step"][] = [
  "condition",
  "trade-or-sell",
  "ownership",
  "color",
  "contact",
  "offer",
  "photos",
];

/**
 * The MotoAcquire-style /sell flow. 8 screens, white-bg, single
 * tenant variable (button color via site_config.landing_cta_color).
 * Standalone dealer microsite by default; iframe (?embed=true) strips
 * top + disclosure bars so the dealer's host page wraps it.
 */
const SellFlow = () => {
  const { config } = useSiteConfig();
  const [state, setState] = useState<MotoFlowState>(emptyMotoFlowState);

  const update = useCallback((patch: Partial<MotoFlowState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

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
