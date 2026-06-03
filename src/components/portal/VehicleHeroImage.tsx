/* VehicleHeroImage — premium loading treatment for the customer's
   resolved vehicle photo.

   Following the blur-up / skeleton pattern used by Next.js, Mux and
   Cloudinary: while the edge function resolves (or generates) the
   image we show a soft shimmer skeleton — never a literal placeholder
   graphic — then fade + de-blur the real photo in once it paints. On a
   genuine failure we fall back to a minimal, on-brand line icon rather
   than a clunky cartoon silhouette.

   The parent owns the layout box (sizing, glow, ground shadow) and is
   expected to be `position: relative`. This component renders the
   <img> plus absolutely-positioned skeleton / fallback overlays. */

import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { useVehicleImageState } from "@/hooks/useVehicleImage";

export const VehicleHeroImage = ({
  year, make, model, vin,
  alt,
  imgClassName = "",
  iconClassName = "w-14 h-14",
  priority = false,
}: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  vin?: string | null;
  alt: string;
  /** Classes applied to the <img> (scale, translate, drop-shadow, z). */
  imgClassName?: string;
  /** Size of the fallback / skeleton glyph. */
  iconClassName?: string;
  /** Above-the-fold hero — load eagerly with high fetch priority. */
  priority?: boolean;
}) => {
  const { url, loading } = useVehicleImageState(year, make, model, vin);
  const [loaded, setLoaded] = useState(false);

  // Re-arm the fade whenever the source changes.
  useEffect(() => { setLoaded(false); }, [url]);

  const decoding = !!url && !loaded;          // URL resolved, pixels not painted yet
  const showSkeleton = loading || decoding;   // shimmer while resolving or decoding
  const showFallback = !loading && !url;      // resolved but empty / failed

  return (
    <>
      {url && (
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
      )}

      {showSkeleton && (
        <div className="absolute inset-0 z-[6] grid place-items-center pointer-events-none">
          <div className="relative w-[82%] h-[72%] max-w-[420px] rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF]/70 overflow-hidden">
            {/* Sweeping highlight */}
            <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
            {/* Faint vehicle hint, centered */}
            <div className="absolute inset-0 grid place-items-center">
              <Car className={`${iconClassName} text-white/70`} strokeWidth={1.5} />
            </div>
          </div>
        </div>
      )}

      {showFallback && (
        <div className="absolute inset-0 z-[6] grid place-items-center pointer-events-none">
          <Car className={`${iconClassName} text-[#C7D2FE]`} strokeWidth={1.25} />
        </div>
      )}
    </>
  );
};

export default VehicleHeroImage;
