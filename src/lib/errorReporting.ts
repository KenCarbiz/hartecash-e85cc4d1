import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: { extra?: Record<string, any> }) => void;
      setUser: (user: { id: string; email?: string } | null) => void;
    };
  }
}

const isDev = import.meta.env.DEV;

/**
 * Capture an exception and forward to Sentry (if loaded),
 * log to console, and persist to Supabase error_log table.
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (isDev) {
    console.error("[errorReporting] captureException:", error, context);
  }

  try {
    if (window.Sentry) {
      window.Sentry.captureException(error, { extra: context });
      return;
    }
  } catch { /* noop */ }

  // Persist to Supabase error_log (fire-and-forget)
  try {
    supabase
      .from("error_log" as any)
      .insert({
        message: error.message,
        stack: error.stack ?? null,
        context: context ?? {},
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      } as any)
      .then(() => {});
  } catch { /* noop */ }
}

/**
 * Set the current user context for error reporting.
 */
export function setUser(userId: string, email?: string): void {
  try {
    window.Sentry?.setUser({ id: userId, email });
  } catch { /* noop */ }
}

/**
 * Initialize global error handlers. Call this once before React renders.
 */
export function initErrorReporting(): void {
  window.onerror = (message, source, lineno, colno, error) => {
    captureException(error ?? new Error(String(message)), {
      source,
      lineno,
      colno,
    });
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
    captureException(error, { type: "unhandledrejection" });
  };
}
