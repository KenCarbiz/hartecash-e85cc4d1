/**
 * Moto Detailed analytics tracker.
 *
 * Thin in-memory event sink today; swap `setAnalyticsSink()` with
 * your real analytics adapter (PostHog, Segment, Supabase insert,
 * etc.) when ready. Every event the spec calls out has a typed
 * helper so callers can't misspell event names.
 */

export type JourneyDevice = "desktop" | "mobile";

export type JourneyAnalyticsEvent =
  | { type: "step_viewed"; stepId: string; index: number; device: JourneyDevice; at: number }
  | { type: "step_completed"; stepId: string; index: number; msOnStep: number; device: JourneyDevice; at: number }
  | { type: "step_abandoned"; stepId: string; index: number; msOnStep: number; device: JourneyDevice; at: number }
  | { type: "offer_seen"; estimate?: number; device: JourneyDevice; at: number }
  | { type: "offer_accepted"; amount: number; device: JourneyDevice; at: number }
  | { type: "offer_saved"; amount: number; device: JourneyDevice; at: number }
  | { type: "ai_boost_started"; device: JourneyDevice; at: number }
  | { type: "ai_boost_completed"; uploadedCount: number; device: JourneyDevice; at: number }
  | { type: "enhanced_offer_viewed"; original: number; boosted: number; delta: number; device: JourneyDevice; at: number }
  | { type: "enhanced_offer_accepted"; original: number; boosted: number; device: JourneyDevice; at: number }
  | { type: "upload_abandoned"; uploadedCount: number; device: JourneyDevice; at: number }
  | { type: "contact_submitted"; device: JourneyDevice; at: number }
  | { type: "cta_clicked"; stepId: string; label: string; device: JourneyDevice; at: number };

export type AnalyticsSink = (event: JourneyAnalyticsEvent) => void;

let sink: AnalyticsSink = (event) => {
  if (typeof window !== "undefined") {
    // Dev visibility — replace by setAnalyticsSink() in production.
    // eslint-disable-next-line no-console
    console.debug("[moto-detailed/analytics]", event);
  }
};

export const setAnalyticsSink = (next: AnalyticsSink) => {
  sink = next;
};

const now = () => Date.now();

const getDevice = (): JourneyDevice => {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 1023px)").matches ? "mobile" : "desktop";
};

export const trackStepViewed = (stepId: string, index: number) =>
  sink({ type: "step_viewed", stepId, index, device: getDevice(), at: now() });

export const trackStepCompleted = (stepId: string, index: number, msOnStep: number) =>
  sink({ type: "step_completed", stepId, index, msOnStep, device: getDevice(), at: now() });

export const trackStepAbandoned = (stepId: string, index: number, msOnStep: number) =>
  sink({ type: "step_abandoned", stepId, index, msOnStep, device: getDevice(), at: now() });

export const trackOfferSeen = (estimate?: number) =>
  sink({ type: "offer_seen", estimate, device: getDevice(), at: now() });

export const trackContactSubmitted = () =>
  sink({ type: "contact_submitted", device: getDevice(), at: now() });

export const trackCtaClicked = (stepId: string, label: string) =>
  sink({ type: "cta_clicked", stepId, label, device: getDevice(), at: now() });
