import type { ComponentType } from "react";

/**
 * Moto Detailed — modular journey engine types.
 *
 * The journey is NOT hardcoded. Each step is a plug-in that declares
 * its id, title, rail copy, and a React component. Dealers (or
 * runtime config) can reorder, insert, remove, or conditionally
 * render steps without touching the engine.
 */

export type OfferDisplayMode = "before_contact_info" | "after_contact_info";

export interface JourneyVehicle {
  year: string;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  plate?: string;
  plateState?: string;
  imageUrl?: string;
}

export interface JourneyValuation {
  low: number;
  high: number;
  firm?: number;
  confidence: "low" | "medium" | "high";
  marketStrength: "soft" | "balanced" | "hot";
  trend: number[]; // last ~8 datapoints, normalized 0..1 for sparkline
}

export interface JourneyContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  zip: string;
}

export type JourneyCondition = "excellent" | "very_good" | "good" | "fair";
export type JourneyUsage = "trade" | "sell";

/** Which post-offer branch the customer chose. */
export type JourneyBranch = "accept" | "boost" | null;

export interface JourneyTodo {
  id: string;
  label: string;
  done: boolean;
  required?: boolean;
}

export interface JourneyAppointment {
  mode: "appointment" | "pickup";
  date?: string;
  timeSlot?: string;
}

export type PhotoQuality = "green" | "yellow" | "red";

export interface PhotoQualityResult {
  status: PhotoQuality;
  message: string;
}

export interface JourneyBoost {
  /** Photo category keys the customer has uploaded. */
  uploadedCategories: string[];
  /** Per-category AI quality verdicts. */
  qualityByCategory: Record<string, PhotoQualityResult>;
  /** AI-derived confidence 0..1. */
  aiConfidence: number | null;
  /** Boosted firm offer. Null when AI couldn't confidently enhance. */
  boostedFirm: number | null;
  /** Diff between boosted firm and original firm. */
  delta: number | null;
  /** True once the full cinematic AI analysis has finished. */
  analyzed: boolean;
}

export const emptyBoost: JourneyBoost = {
  uploadedCategories: [],
  qualityByCategory: {},
  aiConfidence: null,
  boostedFirm: null,
  delta: null,
  analyzed: false,
};

export interface JourneyState {
  vehicle: JourneyVehicle | null;
  valuation: JourneyValuation | null;
  condition: JourneyCondition | null;
  usage: JourneyUsage | null;
  contact: JourneyContact;
  /** Free-form bag for dealer-defined custom-question answers. */
  custom: Record<string, unknown>;
  /** True once the final firm offer has been unlocked. */
  offerUnlocked: boolean;
  /** Which post-offer path the customer chose. */
  branch: JourneyBranch;
  /** Acceptance / scheduling state. */
  appointment: JourneyAppointment | null;
  todos: JourneyTodo[];
  /** AI Boost flow state. */
  boost: JourneyBoost;
  /** True once the customer has finalized (accept original or accept enhanced). */
  finalized: boolean;
  /** True if the customer chose Save My Offer (and may return later). */
  saved: boolean;
}

const defaultTodos: JourneyTodo[] = [
  { id: "registration", label: "Upload registration", done: false, required: true },
  { id: "payoff", label: "Upload payoff information", done: false },
  { id: "title", label: "Bring title to appointment", done: false, required: true },
  { id: "belongings", label: "Remove personal belongings", done: false },
  { id: "id", label: "Complete ID verification", done: false, required: true },
  { id: "payment", label: "Select payment method", done: false, required: true },
];

export const emptyJourneyState: JourneyState = {
  vehicle: null,
  valuation: null,
  condition: "good",
  usage: null,
  contact: { firstName: "", lastName: "", email: "", phone: "", zip: "" },
  custom: {},
  offerUnlocked: false,
  branch: null,
  appointment: null,
  todos: defaultTodos,
  boost: emptyBoost,
  finalized: false,
  saved: false,
};

export interface StepContext {
  state: JourneyState;
  update: (patch: Partial<JourneyState>) => void;
  next: () => void;
  back: () => void;
  goTo: (stepId: string) => void;
  offerDisplayMode: OfferDisplayMode;
}

export interface StepDefinition {
  /** Stable id used by config to reference this step. */
  id: string;
  /** Short title shown in desktop rail + mobile stepper. */
  title: string;
  /** Sub-helper shown under the title in the desktop rail. */
  helper?: string;
  /** Page title rendered inside the step. */
  pageTitle: string;
  /** Optional subtitle under the page title. */
  pageSubtitle?: string;
  /** The actual step UI. */
  Component: ComponentType<StepContext>;
  /** Optional predicate — return false to skip this step at runtime. */
  shouldRender?: (state: JourneyState) => boolean;
  /** Validate before allowing `next()`. Return true / message string. */
  validate?: (state: JourneyState) => true | string;
}

export interface JourneyConfig {
  steps: StepDefinition[];
  offerDisplayMode: OfferDisplayMode;
}
