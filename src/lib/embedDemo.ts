/**
 * Shared utilities for the embed-demo tools (Live Preview + Prospect Demo).
 *
 * The two surfaces — per-tenant Live Preview (inside EmbedToolkit) and the
 * standalone Prospect Demo page — both screenshot a dealer site and overlay
 * Autocurb embed assets on top. They share their capture pipeline here so
 * any improvement (rate-limit handling, provider swap, normalization rules)
 * lands in one place.
 */

import { supabase } from "@/integrations/supabase/client";

export type PageType = "home" | "listing" | "vdp";

export interface CaptureSet {
  home: string | null;
  listing: string | null;
  vdp: string | null;
}

export interface FailureSet {
  home: string | null;
  listing: string | null;
  vdp: string | null;
}

export interface CaptureAttempt {
  url: string;
  ok: boolean;
  reason?: string;
  pageTitle?: string;
  screenshotUrl?: string;
}

export interface CaptureResult {
  url: string | null;
  error: string | null;
  /** Per-variant diagnostic from the capture-screenshot edge function.
   *  Useful when both www and bare-domain attempts fail — surfaces what
   *  microlink actually saw at each. */
  attempts?: CaptureAttempt[];
}

// 30s between captures — protects the microlink free quota (50/day per IP)
// when a salesperson is mashing the button while iterating on URLs.
export const CAPTURE_COOLDOWN_MS = 30_000;

// Validate user input early so we don't burn microlink quota on
// obviously-bad URLs. Returns the normalized URL string or null.
export const normalizeUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || parsed.hostname === "localhost") return null;
    if (!/\./.test(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

// Best-guess listing-page URL from a homepage. Most dealer-CMS platforms
// expose inventory at /used-vehicles. Phase 4 will replace this with a
// CMS-aware sniffer that hits the real listing path per platform.
export const guessListingUrl = (homepage: string): string => {
  const normalized = normalizeUrl(homepage);
  if (!normalized) return "";
  try {
    const u = new URL(normalized);
    return `${u.origin}/used-vehicles`;
  } catch {
    return "";
  }
};

// Build a microlink screenshot URL. We use the embed=screenshot.url shortcut
// so the response IS the image (no JSON parsing on the client).
//
// Tuning notes:
// - waitUntil=load (not networkidle0) — many dealer sites have long-polling
//   chat widgets that NEVER hit network-idle, causing microlink to time out
//   after 30s and return a black/blank screenshot. "load" fires when the
//   page's main resources are done.
// - hide=[selector list] — kill cookie banners and chat widgets that ruin
//   the visual demo. Microlink supports running a small CSS rule before
//   the screenshot to set display:none on these elements.
// - fullPage=false — capture the viewport only. Dealer sites can be 30k+
//   pixels tall and most of that is footer/related-cars filler that hurts
//   the demo more than it helps.
export const buildMicrolinkUrl = (target: string): string => {
  const params = new URLSearchParams({
    url: target,
    screenshot: "true",
    meta: "false",
    embed: "screenshot.url",
    "viewport.width": "1280",
    "viewport.height": "800",
    type: "png",
    waitUntil: "load",
    "screenshot.fullPage": "false",
    // Best-effort cookie/chat banner suppression. Microlink supports a
    // hide= param; multiple selectors comma-separated.
    hide:
      "[id*='cookie'],[class*='cookie-banner'],[class*='consent'],[id*='onetrust']," +
      "[class*='tcf-banner'],iframe[src*='intercom'],iframe[src*='drift']," +
      "[id*='hubspot-messages'],[class*='livechat']",
  });
  return `https://api.microlink.io?${params.toString()}`;
};

// Capture a single page through the server-side capture-screenshot edge
// function. The edge function:
//   - Tries URL variants (with/without www) in case the dealer's site
//     canonicalizes one way and rejects the other.
//   - Detects junk responses (Chrome SSL warnings, Cloudflare challenges,
//     404 / forbidden pages) by reading microlink's metadata and rejecting
//     them, instead of returning an "ok" image of a warning page.
//   - Returns a clear, actionable error if every attempt fails.
//
// Caller still gets the same { url, error } shape so the existing
// failure-panel UI keeps working.
export const captureOne = async (target: string): Promise<CaptureResult> => {
  if (!target.trim()) return { url: null, error: null };
  const normalized = normalizeUrl(target);
  if (!normalized) {
    return {
      url: null,
      error: "Invalid URL — needs a real domain like dealer.com",
    };
  }
  try {
    const { data, error } = await supabase.functions.invoke<{
      screenshotUrl?: string;
      error?: string;
      attempts?: CaptureAttempt[];
    }>("capture-screenshot", { body: { url: normalized } });

    if (error) {
      // Try to pull a useful diagnostic out of the FunctionsError. Common
      // shapes:
      //   FunctionsHttpError  — function ran, returned 4xx/5xx (auth fail,
      //                         crashed handler, etc.); response body has
      //                         the actual reason.
      //   FunctionsRelayError — couldn't reach the function (not deployed,
      //                         network error).
      //   FunctionsFetchError — fetch-level failure.
      let detail = error.message || "Capture failed";
      // supabase-js attaches the Response on the FunctionsHttpError.
      const ctx = (error as unknown as { context?: { status?: number } }).context;
      if (ctx?.status) {
        detail = `${detail} (HTTP ${ctx.status})`;
      }
      // If the error name says relay/fetch, the function probably isn't
      // deployed yet — surface that hint directly.
      if (/relay|fetch/i.test(error.name || "")) {
        detail =
          `${detail} — the capture-screenshot edge function isn't reachable. ` +
          `Likely Lovable hasn't deployed it yet. Wait 1–2 minutes and retry.`;
      }
      console.warn(`captureOne edge-function error for ${normalized}:`, error, ctx);
      return { url: null, error: detail };
    }
    if (data?.screenshotUrl) {
      return { url: data.screenshotUrl, error: null, attempts: data.attempts };
    }
    const lastReason =
      data?.attempts?.find((a) => a.reason)?.reason ||
      data?.error ||
      "All capture attempts failed";
    return { url: null, error: lastReason, attempts: data?.attempts };
  } catch (e) {
    console.warn(`Capture failed for ${normalized}:`, e);
    return {
      url: null,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
};

// Format a CaptureResult's error + attempts into a multi-line string the
// CaptureFailurePanel can display. Surfaces what microlink saw at each
// URL variant so the rep knows whether the dealer's site is the problem
// (cert / Cloudflare / 404) vs. a microlink-side problem (rate limit).
export const formatCaptureError = (result: CaptureResult): string | null => {
  if (!result.error && (result.url || !result.attempts?.length)) return null;
  if (!result.attempts || result.attempts.length <= 1) {
    return result.error || "Capture failed";
  }
  const lines = result.attempts.map((a) => {
    const tag = a.ok ? "✓" : "✗";
    const titleHint = a.pageTitle ? ` (microlink saw page titled: "${a.pageTitle}")` : "";
    return `${tag} ${a.url} → ${a.ok ? "OK" : a.reason || "failed"}${titleHint}`;
  });
  return `Tried ${result.attempts.length} URL variants:\n${lines.join("\n")}`;
};

// sessionStorage helpers — used by both Live Preview and Prospect Demo so
// salespeople can switch tabs / sections without losing in-progress work.
export const readPersisted = <T,>(namespace: string, key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(`${namespace}:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writePersisted = (namespace: string, key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${namespace}:${key}`, JSON.stringify(value));
  } catch {
    // sessionStorage can throw QuotaExceededError on very large values
    // or in privacy modes — swallow silently, in-memory state still works.
  }
};
