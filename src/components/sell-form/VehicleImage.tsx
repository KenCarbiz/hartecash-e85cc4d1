import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  year?: string;
  make?: string;
  model?: string;
  style?: string;
  selectedColor: string;
  compact?: boolean;
  uvc?: string;
  hideColorLabel?: boolean;
}

// Preload an image and resolve when ready
const preloadImage = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = reject;
    img.src = url;
  });

const VehicleImage = ({ year, make, model, style, selectedColor, compact = false, uvc }: Props) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const currentColorRef = useRef<string>("");
  const prefetchedRef = useRef<Set<string>>(new Set());

  const buildCacheKey = useCallback((color: string) => {
    const colorKey = (color || "white").toLowerCase().replace(/\s+/g, "_");
    return `vehicle-img-${year}-${make}-${model}-${colorKey}`.toLowerCase().replace(/\s+/g, "_");
  }, [year, make, model]);

  const fetchImage = useCallback(async (color: string, isPrefetch = false) => {
    if (!year || !make || !model) return;

    const cacheKey = buildCacheKey(color);

    // Check localStorage cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      if (!isPrefetch) {
        // Preload into browser cache for instant display
        try { await preloadImage(cached); } catch {}
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
        body: { year, make, model, style, color: color || "white", uvc },
      });

      if (currentColorRef.current !== color && !isPrefetch) return;

      if (fnErr || data?.error) {
        if (!isPrefetch) {
          console.error("Vehicle image error:", fnErr || data?.error);
          setError(true);
          setLoading(false);
        }
        return;
      }

      if (data?.image_url) {
        localStorage.setItem(cacheKey, data.image_url);
        if (!isPrefetch && currentColorRef.current === color) {
          // Preload into browser memory
          try { await preloadImage(data.image_url); } catch {}
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
    <div className={`relative w-full overflow-hidden ${compact ? "mb-2" : "mb-4"}`}
         style={{ aspectRatio: compact ? "16/7" : "4/3" }}>
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
        {imageUrl && (
          <motion.div
            key={imageUrl}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center p-2"
          >
            <img
              src={imageUrl}
              alt={`${year} ${make} ${model}${selectedColor ? ` in ${selectedColor}` : ""}`}
              className="max-w-full max-h-full object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color label chip */}
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
    </div>
  );
};

export default VehicleImage;
