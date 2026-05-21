import JourneyEngine from "./JourneyEngine";
import StepVehicle from "./steps/StepVehicle";
import StepCondition from "./steps/StepCondition";
import StepUsage from "./steps/StepUsage";
import StepContact from "./steps/StepContact";
import StepOfferReady from "./steps/StepOfferReady";
import type { JourneyConfig, OfferDisplayMode, StepDefinition } from "./types";

/**
 * Default Moto Detailed journey config.
 *
 * Dealers can override this at runtime by passing their own
 * StepDefinition[] (built from site_config) — order, presence, and
 * conditional rendering all flow through the engine. The five
 * defaults below match the spec:
 *
 *   1. Vehicle Search   → triggers valuation lookup
 *   2. Condition        → 4-card grade picker
 *   3. Usage            → trade vs sell
 *   4. Contact Info     → unlock gate (after_contact_info default)
 *   5. Offer Ready      → firm-offer reveal
 *
 * Switch `offerDisplayMode` to "before_contact_info" to invert the
 * last two steps for higher-engagement DTC flows.
 */
const VEHICLE: StepDefinition = {
  id: "vehicle",
  title: "Vehicle",
  helper: "Find your vehicle",
  pageTitle: "Get an instant vehicle valuation",
  pageSubtitle: "Enter a few details about your vehicle and see your estimated value.",
  Component: StepVehicle,
};
const CONDITION: StepDefinition = {
  id: "condition",
  title: "Condition",
  helper: "Rate your vehicle",
  pageTitle: "How would you rate your vehicle's condition?",
  pageSubtitle: "Pick the option that best describes how your car looks and drives today.",
  Component: StepCondition,
};
const USAGE: StepDefinition = {
  id: "usage",
  title: "Usage",
  helper: "Tell us your plans",
  pageTitle: "Are you trading in or selling outright?",
  Component: StepUsage,
};
const CONTACT: StepDefinition = {
  id: "contact",
  title: "Contact",
  helper: "Unlock your offer",
  pageTitle: "Let's send your offer details",
  pageSubtitle: "We'll use this to send your full offer breakdown and reach out about pickup.",
  Component: StepContact,
};
const OFFER: StepDefinition = {
  id: "offer",
  title: "Offer",
  helper: "Review next steps",
  pageTitle: "Your offer is ready",
  pageSubtitle: "Here's what your vehicle is worth today.",
  Component: StepOfferReady,
};

export const buildDefaultJourney = (
  offerDisplayMode: OfferDisplayMode = "after_contact_info",
): JourneyConfig => {
  const steps: StepDefinition[] =
    offerDisplayMode === "before_contact_info"
      ? [VEHICLE, CONDITION, USAGE, OFFER, CONTACT]
      : [VEHICLE, CONDITION, USAGE, CONTACT, OFFER];
  return { steps, offerDisplayMode };
};

interface Props {
  offerDisplayMode?: OfferDisplayMode;
  /** Future: dealer-defined extra steps spliced into the default order. */
  config?: JourneyConfig;
}

const MotoDetailedFlow = ({ offerDisplayMode = "after_contact_info", config }: Props) => {
  const finalConfig = config ?? buildDefaultJourney(offerDisplayMode);
  return <JourneyEngine config={finalConfig} />;
};

export default MotoDetailedFlow;
