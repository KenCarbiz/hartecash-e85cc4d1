import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, any>) => void;
      identify: (userId: string, traits?: Record<string, any>) => void;
    };
    gtag?: (...args: any[]) => void;
  }
}

const isDev = import.meta.env.DEV;

/**
 * Track an analytics event. Forwards to PostHog and GA4 if loaded,
 * logs to console in dev mode, and persists to Supabase fire-and-forget.
 */
export function track(event: string, properties?: Record<string, any>): void {
  if (isDev) {
    console.log("[analytics] track:", event, properties);
  }

  try {
    window.posthog?.capture(event, properties);
  } catch { /* noop */ }

  try {
    window.gtag?.("event", event, properties);
  } catch { /* noop */ }

  // Fire-and-forget persistence to Supabase
  try {
    supabase
      .from("analytics_events" as any)
      .insert({
        event_name: event,
        properties: properties ?? {},
        page_url: window.location.href,
        timestamp: new Date().toISOString(),
      } as any)
      .then(() => {});
  } catch { /* noop */ }
}

/**
 * Identify a user for analytics providers.
 */
export function identify(userId: string, traits?: Record<string, any>): void {
  if (isDev) {
    console.log("[analytics] identify:", userId, traits);
  }

  try {
    window.posthog?.identify(userId, traits);
  } catch { /* noop */ }

  try {
    window.gtag?.("set", "user_properties", { user_id: userId, ...traits });
  } catch { /* noop */ }
}

/**
 * Track a page view.
 */
export function pageView(pageName: string): void {
  if (isDev) {
    console.log("[analytics] pageView:", pageName);
  }

  try {
    window.posthog?.capture("$pageview", { page: pageName });
  } catch { /* noop */ }

  try {
    window.gtag?.("event", "page_view", { page_path: pageName });
  } catch { /* noop */ }

  // Fire-and-forget persistence
  try {
    supabase
      .from("analytics_events" as any)
      .insert({
        event_name: "page_view",
        properties: { page: pageName },
        page_url: window.location.href,
        timestamp: new Date().toISOString(),
      } as any)
      .then(() => {});
  } catch { /* noop */ }
}
