/* VehicleHeroImage — premium loading treatment for the customer's
   resolved vehicle photo.

   Following the blur-up / skeleton pattern used by Next.js, Mux and
   Cloudinary: while the edge function resolves (or generates) the
   image we show a soft shimmer skeleton — never a literal placeholder
   graphic — then fade + de-blur the real photo in once it paints. On a
   genuine failure we fall back to a minimal, on-brand line icon rather
   than a clunky cartoon silhouette.

   Source-aware presentation: the customer's actual Black Book / Wikipedia
   photo carries its own background and reads best framed edge-to-edge
   (object-cover, like a real photo card); AI / studio renders are clean
   white-background cutouts that float with a drop shadow. We request the
   real photo first (studioOnly=false) and fall back to AI automatically.

   The parent owns the layout box (sizing, glow, ground shadow) and is
   expected to be `position: relative`. */

import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { useVehicleImageState } from "@/hooks/useVehicleImage";

const isRealPhoto = (source: string | null) =>
  source === "blackbook" || source === "wikipedia";

export const VehicleHeroImage = ({
  year, make, model, vin,
  alt,
  imgClassName = "",
  iconClassName = "w-14 h-14",
  realFit = "cover",
  priority = false,
}: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  vin?: string | null;
  alt: string;
  /** Classes applied to the floating (studio/AI) <img>: scale, drop-shadow, z. */
  imgClassName?: string;
  /** Size of the fallback / skeleton glyph. */
  iconClassName?: string;
  /** How a real (framed) photo fills the box. "contain" for lightboxes. */
  realFit?: "cover" | "contain";
  /** Above-the-fold hero — load eagerly with high fetch priority. */
  priority?: boolean;
}) => {
  // Prefer the customer's actual vehicle photo; AI render is the fallback.
  const { url, loading, source } = useVehicleImageState(year, make, model, vin, undefined, undefined, false);
  const [loaded, setLoaded] = useState(false);

  // Re-arm the fade whenever the source changes.
  useEffect(() => { setLoaded(false); }, [url]);

  const decoding = !!url && !loaded;          // URL resolved, pixels not painted yet
  const showSkeleton = loading || decoding;   // shimmer while resolving or decoding
  const showFallback = !loading && !url;      // resolved but empty / failed
  const framed = isRealPhoto(source);

  return (
    <>
      {url && (
        framed ? (
          // Real photo — fill the box like a proper photo card.
          <img
            src={url}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            // @ts-expect-error fetchpriority is a valid HTML attr not yet in the React types here
            fetchpriority={priority ? "high" : "auto"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 z-10 w-full h-full ${
              realFit === "contain" ? "object-contain" : "object-cover"
            } transition-[opacity,filter] duration-500 ease-out ${
              loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
            }`}
          />
        ) : (
          // Studio / AI cutout — float on the parent's glow + shadow.
          <img
            src={url}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            // @ts-expect-error fetchpriority is a valid HTML attr not yet in the React types here
            fetchpriority={priority ? "high" : "auto"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`${imgClassName} transition-[opacity,filter,transform] duration-500 ease-out ${
              loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
            }`}
          />
        )
      )}

      {showSkeleton && (
        <div
          className="absolute inset-0 z-[6] grid place-items-center pointer-events-none"
          aria-busy="true"
          aria-hidden="true"
        >
          <div className="relative w-[82%] h-[72%] max-w-[420px] rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF]/70 overflow-hidden">
            {/* Gentle sweeping highlight — subtle, never flashy */}
            <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            {/* Faint vehicle hint, centered */}
            <div className="absolute inset-0 grid place-items-center">
              <Car className={`${iconClassName} text-white/70`} strokeWidth={1.5} />
            </div>
          </div>
        </div>
      )}

      {showFallback && (
        <div
          className="absolute inset-0 z-[6] grid place-items-center pointer-events-none"
          aria-hidden="true"
        >
          <Car className={`${iconClassName} text-[#C7D2FE]`} strokeWidth={1.25} />
        </div>
      )}
    </>
  );
};

export default VehicleHeroImage;
