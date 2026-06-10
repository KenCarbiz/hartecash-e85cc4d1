import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a customer-portal hero image for a given year/make/model.
 *
 * Invokes the `generate-vehicle-image` edge function with
 * `angle: "3q"` and the optional Black Book `uvc`. We do NOT force
 * `studio_only`, so the function resolves the real photo of the
 * customer's actual vehicle in priority order — Black Book photo (by
 * uvc, an exact-VIN match) → Wikipedia (correct year/make/model) → AI
 * studio render — instead of an AI-only image that may not match. The
 * function checks `vehicle_image_cache` first; only the very first
 * caller for a new year-make-model triggers a generation, which is
 * then cached for every subsequent portal load.
 *
 * Returns `null` while loading or on failure -- callers should show a
 * neutral, brand-agnostic placeholder (never a specific model) until
 * the URL resolves.
 */
export interface VehicleImageState {
  /** Resolved image URL, or null while loading / on failure. */
  url: string | null;
  /** True while the edge function is resolving (or generating) the image. */
  loading: boolean;
  /** Origin of the resolved image: "blackbook" | "wikipedia" | "ai" |
   *  null. Real photos (blackbook/wikipedia) carry their own background
   *  and read best framed; AI/studio renders are clean cutouts that
   *  float. Null on cache hits from before the source was persisted. */
  source: string | null;
}

// ── Request coalescing + throttling ──────────────────────────────────
// Vehicle images are rendered in grids/lists where many cards mount at
// once. Without coordination each card fires its own edge-function
// invocation, bursting past the platform's per-function rate limit and
// returning 429 ("Too many requests"). To prevent that:
//   • successCache  — resolved URLs are reused forever (per session);
//   • inflight      — concurrent callers for the same key share ONE call;
//   • failUntil     — a key that just failed (429/error) is suppressed
//                     for FAIL_TTL so re-renders don't re-hammer it;
//   • a small concurrency gate caps simultaneous invocations.
// All of this only reduces calls — results are identical to before.
type Settled = { url: string | null; source: string | null };
const successCache = new Map<string, Settled>();
const inflight = new Map<string, Promise<Settled>>();
const failUntil = new Map<string, number>();
const FAIL_TTL = 60_000;
const MAX_CONCURRENT = 4;
let active = 0;
const waiting: (() => void)[] = [];
function runGated<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const exec = () => {
      active++;
      fn().then(resolve, reject).finally(() => {
        active--;
        const next = waiting.shift();
        if (next) next();
      });
    };
    if (active < MAX_CONCURRENT) exec();
    else waiting.push(exec);
  });
}

async function resolveVehicleImage(key: string, body: Record<string, unknown>): Promise<Settled> {
  const cached = successCache.get(key);
  if (cached) return cached;
  const existing = inflight.get(key);
  if (existing) return existing;
  const failedAt = failUntil.get(key);
  if (failedAt && Date.now() < failedAt) return { url: null, source: null };

  const p = runGated(async (): Promise<Settled> => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-vehicle-image", { body });
      if (error || !data?.image_url) {
        failUntil.set(key, Date.now() + FAIL_TTL);
        return { url: null, source: null };
      }
      const result: Settled = { url: data.image_url as string, source: (data.source as string) ?? null };
      successCache.set(key, result);
      failUntil.delete(key);
      return result;
    } catch {
      failUntil.set(key, Date.now() + FAIL_TTL);
      return { url: null, source: null };
    } finally {
      inflight.delete(key);
    }
  });
  inflight.set(key, p);
  return p;
}

/**
 * Loading-aware variant of {@link useVehicleImage}. Distinguishes the
 * "still resolving" state from "resolved but empty / failed" so callers
 * can show a tasteful skeleton while loading and fade the real photo in
 * once it arrives — never a placeholder graphic mid-flight.
 *
 * `studioOnly` (default true) forces clean white-background AI renders.
 * Pass `false` to prefer the customer's actual vehicle photo — Black
 * Book (exact VIN) → Wikipedia → AI render — which the edge function
 * also persists to storage for instant reuse on every later load.
 */
export function useVehicleImageState(
  year?: number | string | null,
  make?: string | null,
  model?: string | null,
  vin?: string | null,
  submissionToken?: string | null,
  uvc?: string | null,
  studioOnly: boolean = true,
  angle: "3q" | "side" = "3q",
  color?: string | null,
): VehicleImageState {
  const hasInputs = !!(year && make && model);

  // Stable key so we don't re-fetch on every render. Strings normalize
  // away nullish + whitespace so equivalent inputs hit the same key.
  const key = [year, make, model, vin, uvc, studioOnly, angle, color].map((v) => String(v ?? "").trim().toLowerCase()).join("|");

  // Hydrate synchronously from the session cache so a re-render or a
  // sibling card that already resolved this vehicle paints instantly
  // (and never re-invokes the function).
  const [state, setState] = useState<VehicleImageState>(() => {
    if (hasInputs) {
      const cached = successCache.get(key);
      if (cached) return { url: cached.url, loading: false, source: cached.source };
    }
    return { url: null, loading: hasInputs, source: null };
  });

  useEffect(() => {
    if (!year || !make || !model) {
      setState({ url: null, loading: false, source: null });
      return;
    }
    const cached = successCache.get(key);
    if (cached) {
      setState({ url: cached.url, loading: false, source: cached.source });
      return;
    }
    let cancelled = false;
    setState({ url: null, loading: true, source: null });
    resolveVehicleImage(key, {
      year: String(year),
      make,
      model,
      angle,
      // Prefer the real photo of the customer's exact vehicle when
      // studioOnly is false (Black Book by VIN → Wikipedia → AI);
      // otherwise force a clean white-background studio render.
      studio_only: studioOnly,
      vin: vin || undefined,
      uvc: uvc || undefined,
      color: color || undefined,
      submission_token: submissionToken || undefined,
    }).then((res) => {
      if (!cancelled) setState({ url: res.url, loading: false, source: res.source });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/**
 * Resolves a customer-portal hero image URL. Thin wrapper over
 * {@link useVehicleImageState} for callers that only need the URL.
 */
export function useVehicleImage(
  year?: number | string | null,
  make?: string | null,
  model?: string | null,
  vin?: string | null,
  submissionToken?: string | null,
  uvc?: string | null,
  studioOnly: boolean = true,
  angle: "3q" | "side" = "3q",
  color?: string | null,
): string | null {
  return useVehicleImageState(year, make, model, vin, submissionToken, uvc, studioOnly, angle, color).url;
}
