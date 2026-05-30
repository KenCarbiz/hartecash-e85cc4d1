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
export function useVehicleImage(
  year?: number | string | null,
  make?: string | null,
  model?: string | null,
  vin?: string | null,
  submissionToken?: string | null,
  uvc?: string | null,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  // Stable key so we don't re-fetch on every render. Strings normalize
  // away nullish + whitespace so equivalent inputs hit the same key.
  const key = [year, make, model, vin, uvc].map((v) => String(v ?? "").trim().toLowerCase()).join("|");

  useEffect(() => {
    if (!year || !make || !model) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-vehicle-image", {
          body: {
            year: String(year),
            make,
            model,
            angle: "3q",
            // Clean white-background studio render of the customer's exact
            // year/make/model. This is the reliable path (cached per
            // y/m/m); the BB-photo-by-VIN route produced empty results for
            // some vehicles and fell through to the silhouette placeholder.
            studio_only: true,
            vin: vin || undefined,
            uvc: uvc || undefined,
            submission_token: submissionToken || undefined,
          },
        });
        if (cancelled) return;
        if (error || !data?.image_url) {
          setUrl(null);
          return;
        }
        setUrl(data.image_url as string);
      } catch {
        if (cancelled) return;
        setUrl(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url;
}
