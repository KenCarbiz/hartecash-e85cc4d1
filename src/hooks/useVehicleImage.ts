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
 * Returns `null` while loading or on failure -- callers are
 * expected to fall back to a static placeholder until the URL
 * resolves.
 */
export function useVehicleImage(
  year?: number | string | null,
  make?: string | null,
  model?: string | null,
  submissionToken?: string | null,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  // Stable key so we don't re-fetch on every render. Strings normalize
  // away nullish + whitespace so equivalent inputs hit the same key.
  const key = [year, make, model].map((v) => String(v ?? "").trim().toLowerCase()).join("|");

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
            studio_only: true,
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
