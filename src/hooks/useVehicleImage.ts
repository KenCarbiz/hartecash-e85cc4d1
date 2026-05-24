import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a customer-portal hero image for a given year/make/model.
 *
 * Invokes the `generate-vehicle-image` edge function with
 * `studio_only: true, angle: "3q"` so we always get a transparent /
 * white-background, 3/4-front studio render (per product direction:
 * "no background 3/4 angle with a shadow under the car"). The
 * function checks `vehicle_image_cache` first; only the very first
 * caller for a new year-make-model triggers an AI generation, which
 * is then cached for every subsequent portal load.
 *
 * The resolved URL is also cached in localStorage per year-make-model
 * so repeat portal loads paint the correct car on the first frame
 * instead of waiting on the edge function (which is what made the
 * static placeholder flash before the real image arrived). Returns
 * `null` only when nothing is cached AND the fetch hasn't resolved —
 * callers should render a neutral skeleton, NOT a stand-in vehicle.
 */
const cacheKeyFor = (key: string) => `portal-vehicle-img:${key}`;
const readCache = (key: string): string | null => {
  try {
    return localStorage.getItem(cacheKeyFor(key)) || null;
  } catch {
    return null;
  }
};

export function useVehicleImage(
  year?: number | string | null,
  make?: string | null,
  model?: string | null,
  submissionToken?: string | null,
): string | null {
  // Stable key so we don't re-fetch on every render. Strings normalize
  // away nullish + whitespace so equivalent inputs hit the same key.
  const key = [year, make, model].map((v) => String(v ?? "").trim().toLowerCase()).join("|");
  const [url, setUrl] = useState<string | null>(() => readCache(key));

  useEffect(() => {
    if (!year || !make || !model) {
      setUrl(null);
      return;
    }
    // Paint the cached image immediately (if any) so the correct car
    // shows on the first frame; the fetch below only refreshes it.
    setUrl(readCache(key));
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-vehicle-image", {
          body: {
            year: String(year),
            make,
            model,
            angle: "3q",
            studio_only: true,
            submission_token: submissionToken || undefined,
          },
        });
        if (cancelled) return;
        // On failure keep whatever we already have (cached) rather than
        // dropping back to a placeholder.
        if (error || !data?.image_url) return;
        setUrl(data.image_url as string);
        try {
          localStorage.setItem(cacheKeyFor(key), data.image_url as string);
        } catch {
          /* localStorage full / unavailable — non-fatal */
        }
      } catch {
        /* keep cached value on network error */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url;
}
