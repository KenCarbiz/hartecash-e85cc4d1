/**
 * Moto Detailed analytics tracker.
 *
 * Thin in-memory event sink today; swap `setAnalyticsSink()` with
 * your real analytics adapter (PostHog, Segment, Supabase insert,
 * etc.) when ready. Every event the spec calls out has a typed
 * helper so callers can't misspell event names.
 */

export type JourneyDevice = "desktop" | "mobile";

export type ImageQuality = "green" | "yellow" | "red";

export type JourneyAnalyticsEvent =
  | { type: "step_viewed"; stepId: string; index: number; device: JourneyDevice; at: number }
  | { type: "step_completed"; stepId: string; index: number; msOnStep: number; device: JourneyDevice; at: number }
  | { type: "step_abandoned"; stepId: string; index: number; msOnStep: number; device: JourneyDevice; at: number }
  | { type: "offer_seen"; estimate?: number; device: JourneyDevice; at: number }
  | { type: "offer_accepted"; amount: number; device: JourneyDevice; at: number }
  | { type: "offer_saved"; amount: number; device: JourneyDevice; at: number }
  | { type: "ai_boost_started"; device: JourneyDevice; at: number }
  | { type: "ai_boost_completed"; uploadedCount: number; device: JourneyDevice; at: number }
  | { type: "ai_analysis_started"; device: JourneyDevice; at: number }
  | { type: "ai_analysis_completed"; durationMs: number; device: JourneyDevice; at: number }
  | { type: "image_quality"; quality: ImageQuality; category: string; reason?: string; device: JourneyDevice; at: number }
  | { type: "enhanced_offer_viewed"; original: number; boosted: number; delta: number; device: JourneyDevice; at: number }
  | { type: "enhanced_offer_accepted"; original: number; boosted: number; device: JourneyDevice; at: number }
  | { type: "enhancement_generated"; original: number; boosted: number; device: JourneyDevice; at: number }
  | { type: "enhancement_not_generated"; reason: string; device: JourneyDevice; at: number }
  | { type: "appraiser_queue_triggered"; reason: string; confidence: number; device: JourneyDevice; at: number }
  | { type: "upload_retry"; category: string; device: JourneyDevice; at: number }
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

export const trackOfferAccepted = (amount: number) =>
  sink({ type: "offer_accepted", amount, device: getDevice(), at: now() });

export const trackOfferSaved = (amount: number) =>
  sink({ type: "offer_saved", amount, device: getDevice(), at: now() });

export const trackAiBoostStarted = () =>
  sink({ type: "ai_boost_started", device: getDevice(), at: now() });

export const trackAiBoostCompleted = (uploadedCount: number) =>
  sink({ type: "ai_boost_completed", uploadedCount, device: getDevice(), at: now() });

export const trackEnhancedOfferViewed = (original: number, boosted: number) =>
  sink({ type: "enhanced_offer_viewed", original, boosted, delta: boosted - original, device: getDevice(), at: now() });

export const trackEnhancedOfferAccepted = (original: number, boosted: number) =>
  sink({ type: "enhanced_offer_accepted", original, boosted, device: getDevice(), at: now() });

export const trackUploadAbandoned = (uploadedCount: number) =>
  sink({ type: "upload_abandoned", uploadedCount, device: getDevice(), at: now() });

export const trackUploadRetry = (category: string) =>
  sink({ type: "upload_retry", category, device: getDevice(), at: now() });

export const trackImageQuality = (quality: ImageQuality, category: string, reason?: string) =>
  sink({ type: "image_quality", quality, category, reason, device: getDevice(), at: now() });

export const trackAiAnalysisStarted = () =>
  sink({ type: "ai_analysis_started", device: getDevice(), at: now() });

export const trackAiAnalysisCompleted = (durationMs: number) =>
  sink({ type: "ai_analysis_completed", durationMs, device: getDevice(), at: now() });

export const trackEnhancementGenerated = (original: number, boosted: number) =>
  sink({ type: "enhancement_generated", original, boosted, device: getDevice(), at: now() });

export const trackEnhancementNotGenerated = (reason: string) =>
  sink({ type: "enhancement_not_generated", reason, device: getDevice(), at: now() });

export const trackAppraiserQueueTriggered = (reason: string, confidence: number) =>
  sink({ type: "appraiser_queue_triggered", reason, confidence, device: getDevice(), at: now() });

export const trackContactSubmitted = () =>
  sink({ type: "contact_submitted", device: getDevice(), at: now() });

export const trackCtaClicked = (stepId: string, label: string) =>
  sink({ type: "cta_clicked", stepId, label, device: getDevice(), at: now() });
