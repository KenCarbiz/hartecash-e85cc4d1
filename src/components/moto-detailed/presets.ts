import type { JourneyConfig, OfferDisplayMode, StepDefinition } from "./types";
import StepVehicle from "./steps/StepVehicle";
import StepCondition from "./steps/StepCondition";
import StepUsage from "./steps/StepUsage";
import StepContact from "./steps/StepContact";
import StepOfferReady from "./steps/StepOfferReady";
import {
  StepPhotos,
  StepPayoff,
  StepTradeSell,
  StepDealerQuestions,
  StepDocuments,
  StepSchedule,
  StepComplete,
} from "./steps/StepPlaceholder";


/**
 * Preset journey templates. Each preset is a JourneyConfig factory —
 * dealers can pick a preset as a starting point and then reorder /
 * inject / skip steps via the engine. Adding a new preset = adding a
 * new entry here; no engine changes required.
 *
 * Guardrails (see GUARDRAILS below) apply uniformly to every preset.
 */

export type JourneyPresetId =
  | "moto"
  | "moto_detailed"
  | "instant_offer"
  | "high_qualification"
  | "luxury_experience";

export interface JourneyPreset {
  id: JourneyPresetId;
  label: string;
  tagline: string;
  description: string;
  /** Returns a fresh config — never share step refs between dealers. */
  build: () => JourneyConfig;
  /** Estimated time on flow in seconds, shown in preview. */
  estimatedSeconds: number;
}

// ── Step factories ──────────────────────────────────────────────────
const vehicle = (): StepDefinition => ({
  id: "vehicle", title: "Vehicle", helper: "Find your vehicle",
  pageTitle: "Get an instant vehicle valuation",
  pageSubtitle: "Enter a few details about your vehicle and see your estimated value.",
  Component: StepVehicle,
});
const condition = (): StepDefinition => ({
  id: "condition", title: "Condition", helper: "Rate your vehicle",
  pageTitle: "How would you rate your vehicle's condition?",
  pageSubtitle: "Pick the option that best describes how your car looks and drives today.",
  Component: StepCondition,
});
const usage = (): StepDefinition => ({
  id: "usage", title: "Usage", helper: "Tell us your plans",
  pageTitle: "Are you trading in or selling outright?",
  Component: StepUsage,
});
const contact = (): StepDefinition => ({
  id: "contact", title: "Contact", helper: "Unlock your offer",
  pageTitle: "Let's send your offer details",
  pageSubtitle: "We'll use this to send your full offer breakdown and reach out about pickup.",
  Component: StepContact,
});
const offer = (): StepDefinition => ({
  id: "offer", title: "Offer", helper: "Review next steps",
  pageTitle: "Your offer is ready",
  pageSubtitle: "Here's what your vehicle is worth today.",
  Component: StepOfferReady,
});

// ── Presets ─────────────────────────────────────────────────────────
export const PRESETS: Record<JourneyPresetId, JourneyPreset> = {
  moto: {
    id: "moto",
    label: "Moto",
    tagline: "Ultra-minimal fast lead flow",
    description:
      "The existing MotoAcquire-style 8-step instant valuation. Highest mobile conversion, no journey rail.",
    estimatedSeconds: 60,
    // The classic Moto flow is rendered by the legacy MotoShell, not
    // the engine — but for parity in admin preview we surface the
    // 4-screen contract here.
    build: () => ({
      offerDisplayMode: "after_contact_info",
      steps: [vehicle(), condition(), contact(), offer()],
    }),
  },
  moto_detailed: {
    id: "moto_detailed",
    label: "Moto Detailed",
    tagline: "Premium guided acquisition flow",
    description:
      "Two-phase national-brand journey: ultra-minimal landing, then a guided multi-step transaction experience with desktop rail, live valuation, and trust badges.",
    estimatedSeconds: 240,
    build: () => ({
      offerDisplayMode: "after_contact_info",
      steps: [
        vehicle(),
        condition(),
        usage(),
        { id: "photos", title: "Photos", helper: "Quick walk-around", pageTitle: "Add a few photos", Component: StepPhotos },
        { id: "payoff", title: "Payoff", helper: "Loan or lease", pageTitle: "Loan or lease payoff", Component: StepPayoff },
        { id: "trade_sell", title: "Trade/Sell", helper: "How to complete", pageTitle: "Trade-in or sell outright?", Component: StepTradeSell },
        { id: "dealer_questions", title: "Dealer Questions", helper: "Optional", pageTitle: "A few quick questions", Component: StepDealerQuestions },
        contact(),
        offer(),
        { id: "documents", title: "Documents", helper: "Licence + title", pageTitle: "Upload your documents", Component: StepDocuments },
        { id: "schedule", title: "Schedule", helper: "Pick a time", pageTitle: "Schedule your appointment", Component: StepSchedule },
        { id: "complete", title: "Complete", helper: "You're all set", pageTitle: "All done", Component: StepComplete },
      ],
    }),
  },
  instant_offer: {
    id: "instant_offer",
    label: "Instant Offer",
    tagline: "Offer before contact info",
    description:
      "Customer sees the firm offer before submitting contact details. Softer lead capture, higher engagement.",
    estimatedSeconds: 75,
    build: () => ({
      offerDisplayMode: "before_contact_info",
      steps: [vehicle(), condition(), usage(), offer(), contact()],
    }),
  },
  high_qualification: {
    id: "high_qualification",
    label: "High Qualification",
    tagline: "Ask more before offer",
    description:
      "Adds extra vehicle/customer qualification steps before any offer is shown. Best for high-value or luxury inventory.",
    estimatedSeconds: 150,
    build: () => ({
      offerDisplayMode: "after_contact_info",
      steps: [
        vehicle(),
        condition(),
        { ...usage(), id: "usage", title: "Plans", helper: "Trade or sell" },
        // Placeholders that dealers can swap with custom-question steps.
        { ...condition(), id: "ownership", title: "Ownership", helper: "Own, finance, lease", pageTitle: "Tell us about ownership" },
        { ...condition(), id: "timeline", title: "Timeline", helper: "When are you ready?", pageTitle: "When would you like to complete this?" },
        contact(),
        offer(),
      ],
    }),
  },
  luxury_experience: {
    id: "luxury_experience",
    label: "Luxury Experience",
    tagline: "Slower, cleaner, premium",
    description:
      "Reduced friction with extra reassurance copy. Single primary action per screen, deliberate pacing.",
    estimatedSeconds: 120,
    build: () => ({
      offerDisplayMode: "after_contact_info",
      steps: [
        { ...vehicle(), pageSubtitle: "Let's start with your vehicle. We'll handle the rest." },
        { ...condition(), pageSubtitle: "Take a moment — accuracy here protects your final number." },
        { ...usage(), pageSubtitle: "Either way, you're in good hands." },
        { ...contact(), pageSubtitle: "Private, never shared. We'll be in touch directly." },
        offer(),
      ],
    }),
  },
};

export const PRESET_LIST: JourneyPreset[] = [
  PRESETS.moto,
  PRESETS.moto_detailed,
  PRESETS.instant_offer,
  PRESETS.high_qualification,
  PRESETS.luxury_experience,
];

// ── Guardrails ──────────────────────────────────────────────────────
/**
 * Hard and soft limits for dealer-customized journeys. The engine
 * never enforces these — guardrails surface as warnings in the
 * dealer-facing config UI so dealers can make informed trade-offs.
 */
export const GUARDRAILS = {
  recommendedMaxSteps: 7,
  softWarnAtSteps: 8,
  hardWarnAtSteps: 10,
  /** One primary action per screen — enforced via PrimaryCTA pattern. */
  maxPrimaryCtasPerStep: 1,
} as const;

export interface GuardrailWarning {
  level: "info" | "warn" | "block";
  message: string;
}

export const evaluateGuardrails = (config: JourneyConfig): GuardrailWarning[] => {
  const out: GuardrailWarning[] = [];
  const n = config.steps.length;

  if (n > GUARDRAILS.hardWarnAtSteps) {
    out.push({
      level: "block",
      message: `${n} steps is well above the ${GUARDRAILS.recommendedMaxSteps}-step recommendation. Expect significant drop-off.`,
    });
  } else if (n > GUARDRAILS.softWarnAtSteps) {
    out.push({
      level: "warn",
      message: "Longer journeys may reduce completion rates.",
    });
  } else if (n > GUARDRAILS.recommendedMaxSteps) {
    out.push({
      level: "info",
      message: `You're at ${n} steps. We recommend ${GUARDRAILS.recommendedMaxSteps} or fewer for best completion.`,
    });
  }

  const hasContact = config.steps.some((s) => s.id === "contact");
  const hasOffer = config.steps.some((s) => s.id === "offer");
  if (!hasContact) {
    out.push({ level: "warn", message: "No Contact step — you won't be able to follow up with this lead." });
  }
  if (!hasOffer) {
    out.push({ level: "warn", message: "No Offer step — customers won't see a value at the end." });
  }
  return out;
};

export const buildPresetConfig = (
  id: JourneyPresetId,
  overrides?: Partial<Pick<JourneyConfig, "offerDisplayMode">>,
): JourneyConfig => {
  const base = PRESETS[id].build();
  return { ...base, ...overrides };
};

export const presetIdFromMode = (
  template: "moto" | "moto_detailed" | undefined,
  mode: OfferDisplayMode,
): JourneyPresetId => {
  if (template === "moto") return "moto";
  return mode === "before_contact_info" ? "instant_offer" : "moto_detailed";
};
