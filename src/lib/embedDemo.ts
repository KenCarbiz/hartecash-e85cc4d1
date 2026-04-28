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

export interface CaptureResult {
  url: string | null;
  error: string | null;
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
      attempts?: { url: string; ok: boolean; reason?: string; pageTitle?: string }[];
    }>("capture-screenshot", { body: { url: normalized } });

    if (error) {
      return { url: null, error: error.message || "Capture failed" };
    }
    if (data?.screenshotUrl) {
      return { url: data.screenshotUrl, error: null };
    }
    // Surface the most informative attempt reason if the edge function
    // returned a structured failure list.
    const lastReason =
      data?.attempts?.find((a) => a.reason)?.reason ||
      data?.error ||
      "All capture attempts failed";
    return { url: null, error: lastReason };
  } catch (e) {
    console.warn(`Capture failed for ${normalized}:`, e);
    return {
      url: null,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
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
