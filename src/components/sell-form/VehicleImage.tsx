import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Camera, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface Props {
  year?: string;
  make?: string;
  model?: string;
  style?: string;
  selectedColor: string;
  compact?: boolean;
  uvc?: string;
  hideColorLabel?: boolean;
  imageAngle?: string;
  /** When true, fill the parent container at w-full h-full instead
   *  of forcing the component's own 4/3 aspect ratio. Use this
   *  when the parent (offer card, deal-accepted hero, etc.) is
   *  already shaping the slot — otherwise the inner 4/3 fights
   *  with the outer 16/9 and the car renders letterboxed. */
  fill?: boolean;
  /** When true, render on a transparent background (no white fill).
   *  Use only when the surrounding card already provides the
   *  background and the vehicle PNG is known to come back with a
   *  cleanly-keyed alpha channel. */
  transparent?: boolean;
}

// Preload an image and resolve when ready
const preloadImage = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(url);
    img.onerror = reject;
    img.src = url;
  });

// Client-side white-keying: source image must come back on a solid
// near-white studio background (the generate-vehicle-image edge fn
// already enforces this). We draw it to a canvas and turn every
// near-white pixel into alpha=0 so the vehicle floats on whatever the
// parent background is. Returns null on CORS / decode failure.
async function keyOutWhite(url: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    // Threshold: pixels brighter than ~245 in every channel and with
    // low saturation get keyed out. The fade band (235-245) gets a
    // partial alpha so vehicle edges don't fringe hard.
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      const sat = max - min;
      if (sat > 18) continue; // colored pixel, keep
      if (min >= 245) {
        px[i + 3] = 0;
      } else if (min >= 232) {
        // soft edge taper
        px[i + 3] = Math.round(((245 - min) / 13) * 255);
      }
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}


const VehicleImage = ({ year, make, model, style, selectedColor, compact = false, uvc, hideColorLabel = false, imageAngle: imageAngleProp, fill = false, transparent = false }: Props) => {
  const { config } = useSiteConfig();
  const imageAngle = imageAngleProp || config.vehicle_image_angle || "three_quarter";
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [transparentUrl, setTransparentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const currentColorRef = useRef<string>("");
  const prefetchedRef = useRef<Set<string>>(new Set());

  // When transparent mode is requested, run a white-key pass after
  // the source image loads and cache the resulting transparent PNG
  // in localStorage so we don't re-process on every mount.
  useEffect(() => {
    if (!transparent || !imageUrl) {
      setTransparentUrl(null);
      return;
    }
    const tKey = `vehicle-img-transparent-${imageUrl.slice(0, 80)}`;
    const cached = localStorage.getItem(tKey);
    if (cached) { setTransparentUrl(cached); return; }
    let cancelled = false;
    keyOutWhite(imageUrl).then((url) => {
      if (cancelled || !url) return;
      try { localStorage.setItem(tKey, url); } catch { /* quota */ }
      setTransparentUrl(url);
    });
    return () => { cancelled = true; };
  }, [transparent, imageUrl]);


  const buildCacheKey = useCallback((color: string) => {
    const colorKey = (color || "white").toLowerCase().replace(/\s+/g, "_");
    const angleKey = imageAngle === "side" ? "side" : "3q";
    // v2 — bumped to invalidate cached PNGs that came back with the
    // checkerboard "transparent" pattern baked into the pixel data
    // before we changed the AI prompt to anchor on pure white.
    return `vehicle-img-v2-${year}-${make}-${model}-${colorKey}-${angleKey}`.toLowerCase().replace(/\s+/g, "_");
  }, [year, make, model, imageAngle]);

  const fetchImage = useCallback(async (color: string, isPrefetch = false) => {
    if (!year || !make || !model) return;

    const cacheKey = buildCacheKey(color);

    // Check localStorage cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      if (!isPrefetch) {
        // Preload into browser cache for instant display
        try { await preloadImage(cached); } catch { /* noop */ }
        if (currentColorRef.current === color) {
          setImageUrl(cached);
          setLoading(false);
        }
      }
      return;
    }

    if (!isPrefetch) {
      setLoading(true);
      setError(false);
    }

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-vehicle-image", {
        body: { year, make, model, style, color: color || "white", uvc, angle: imageAngle },
      });

      if (currentColorRef.current !== color && !isPrefetch) return;

      // The edge function now returns 200 with image_url:null when
      // every source (cache, BB, Wikipedia, AI) failed — that's a
      // graceful "no image available" rather than a hard error. We
      // surface the camera-icon empty state in either case but no
      // longer log a noisy error for the expected null path.
      const isHardError = fnErr || (data?.error && data?.error !== "image_unavailable");
      const hasUrl = !!data?.image_url;

      if (isHardError) {
        if (!isPrefetch) {
          console.error("Vehicle image error:", fnErr || data?.error);
          setError(true);
          setLoading(false);
        }
        return;
      }

      if (!hasUrl) {
        if (!isPrefetch) {
          // Soft-fail — no image, no toast. Camera icon shows.
          setError(true);
          setLoading(false);
        }
        return;
      }

      if (data?.image_url) {
        localStorage.setItem(cacheKey, data.image_url);
        if (!isPrefetch && currentColorRef.current === color) {
          // Preload into browser memory
          try { await preloadImage(data.image_url); } catch { /* noop */ }
          setImageUrl(data.image_url);
        }
      }
    } catch (err) {
      if (!isPrefetch && currentColorRef.current === color) {
        console.error("Vehicle image fetch failed:", err);
        setError(true);
      }
    }
    if (!isPrefetch && currentColorRef.current === color) setLoading(false);
  }, [year, make, model, style, buildCacheKey]);

  // Prefetch common colors in the background after initial load
  const prefetchCommonColors = useCallback(() => {
    if (!year || !make || !model) return;
    const commonColors = ["White", "Black", "Silver", "Gray", "Red", "Blue"];
    
    // Stagger prefetch requests to avoid overwhelming
    commonColors.forEach((color, i) => {
      const key = color.toLowerCase();
      if (prefetchedRef.current.has(key)) return;
      if (localStorage.getItem(buildCacheKey(color))) {
        prefetchedRef.current.add(key);
        return;
      }
      prefetchedRef.current.add(key);
      setTimeout(() => fetchImage(color, true), 2000 + i * 3000);
    });
  }, [year, make, model, buildCacheKey, fetchImage]);

  // Fetch on mount
  useEffect(() => {
    if (!year || !make || !model) return;
    const color = selectedColor || "white";
    currentColorRef.current = color;
    fetchImage(color).then(() => {
      // After initial image loads, start prefetching common colors
      prefetchCommonColors();
    });
  }, [year, make, model, style]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when color changes (reduced debounce for snappier feel)
  useEffect(() => {
    if (!year || !make || !model) return;
    const color = selectedColor || "white";
    if (color === currentColorRef.current) return;

    currentColorRef.current = color;

    // If cached, show immediately (no debounce needed)
    const cacheKey = buildCacheKey(color);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setImageUrl(cached);
      return;
    }

    // Only debounce uncached images
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchImage(color);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selectedColor, fetchImage, year, make, model, buildCacheKey]);

  if (!year || !make || !model) return null;

  return (
    // bg-white is REQUIRED — vehicle PNGs sometimes come back with
    // true alpha transparency. We always want them sitting on solid
    // white so the dealer's brand palette never bleeds through and
    // the image NEVER reads as the checkered transparency pattern.
    //
    // fill mode: parent sets the slot shape (typical when this lives
    // inside a Clarity card with its own aspect ratio). No internal
    // aspect-ratio so the parent wins and the car never letterboxes.
    <div
      className={`relative w-full overflow-hidden ${transparent ? "bg-transparent" : "bg-white"} ${
        fill ? "h-full" : compact ? "mb-2" : "mb-4"
      }`}
      style={fill ? undefined : { aspectRatio: compact ? "16/7" : "4/3" }}
    >
      {/* Loading indicator — small and non-intrusive when we already have an image */}
      {loading && (
        <div className={`absolute z-10 ${imageUrl
          ? "top-2 right-2 bg-card/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm border border-border"
          : "inset-0 flex flex-col items-center justify-center gap-2"
        }`}>
          <Loader2 className={`text-accent animate-spin ${imageUrl ? "w-4 h-4" : "w-8 h-8"}`} />
          {!imageUrl && (
            <p className="text-xs text-muted-foreground">Generating vehicle image…</p>
          )}
        </div>
      )}

      {error && !imageUrl && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Camera className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Image unavailable</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {imageUrl && (!transparent || transparentUrl) && (
          <motion.div
            key={transparent ? transparentUrl! : imageUrl}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center p-2"
          >
            <img
              src={transparent ? transparentUrl! : imageUrl}
              alt={`${year} ${make} ${model}${selectedColor ? ` in ${selectedColor}` : ""}`}
              className="max-w-full max-h-full object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color label chip */}
      {!hideColorLabel && (
        <AnimatePresence mode="wait">
          {selectedColor && imageUrl && !loading && (
            <motion.div
              key={selectedColor}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-2 right-3 flex items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-border rounded-full px-2.5 py-1 shadow-sm"
            >
              <span className="text-xs font-medium text-card-foreground">{selectedColor}</span>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default VehicleImage;
