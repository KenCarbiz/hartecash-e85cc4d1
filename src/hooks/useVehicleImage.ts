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
): VehicleImageState {
  const hasInputs = !!(year && make && model);
  const [state, setState] = useState<VehicleImageState>(() => ({
    url: null,
    loading: hasInputs,
    source: null,
  }));

  // Stable key so we don't re-fetch on every render. Strings normalize
  // away nullish + whitespace so equivalent inputs hit the same key.
  const key = [year, make, model, vin, uvc, studioOnly].map((v) => String(v ?? "").trim().toLowerCase()).join("|");

  useEffect(() => {
    if (!year || !make || !model) {
      setState({ url: null, loading: false, source: null });
      return;
    }
    let cancelled = false;
    setState({ url: null, loading: true, source: null });
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-vehicle-image", {
          body: {
            year: String(year),
            make,
            model,
            angle: "3q",
            // Prefer the real photo of the customer's exact vehicle when
            // studioOnly is false (Black Book by VIN → Wikipedia → AI);
            // otherwise force a clean white-background studio render.
            studio_only: studioOnly,
            vin: vin || undefined,
            uvc: uvc || undefined,
            submission_token: submissionToken || undefined,
          },
        });
        if (cancelled) return;
        if (error || !data?.image_url) {
          setState({ url: null, loading: false, source: null });
          return;
        }
        setState({ url: data.image_url as string, loading: false, source: (data.source as string) ?? null });
      } catch {
        if (cancelled) return;
        setState({ url: null, loading: false, source: null });
      }
    })();
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
): string | null {
  return useVehicleImageState(year, make, model, vin, submissionToken, uvc, studioOnly).url;
}
