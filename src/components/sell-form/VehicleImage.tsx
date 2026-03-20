import { useState, useEffect, useCallback } from "react";
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
}

// Map color names to CSS filter values for tinting a white/silver base image
const COLOR_FILTERS: Record<string, string> = {
  White: "brightness(1.05) saturate(0.1)",
  Silver: "brightness(0.95) saturate(0.15)",
  Gray: "brightness(0.65) saturate(0.1)",
  Black: "brightness(0.2) saturate(0.05) contrast(1.2)",
  Blue: "brightness(0.55) saturate(2.5) hue-rotate(200deg)",
  Red: "brightness(0.55) saturate(2.8) hue-rotate(330deg)",
  Green: "brightness(0.5) saturate(2) hue-rotate(100deg)",
  Brown: "brightness(0.45) saturate(1.5) hue-rotate(20deg) contrast(0.9)",
  Gold: "brightness(0.7) saturate(2) hue-rotate(35deg)",
  Orange: "brightness(0.6) saturate(2.5) hue-rotate(15deg)",
  Beige: "brightness(0.9) saturate(0.6) hue-rotate(30deg) sepia(0.3)",
};

const VehicleImage = ({ year, make, model, style, selectedColor, compact = false }: Props) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchImage = useCallback(async () => {
    if (!year || !make || !model) return;

    // Check localStorage cache first
    const cacheKey = `vehicle-img-${year}-${make}-${model}`.toLowerCase().replace(/\s+/g, "_");
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setImageUrl(cached);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-vehicle-image", {
        body: { year, make, model, style },
      });

      if (fnErr || data?.error) {
        console.error("Vehicle image error:", fnErr || data?.error);
        setError(true);
        setLoading(false);
        return;
      }

      if (data?.image_url) {
        setImageUrl(data.image_url);
        localStorage.setItem(cacheKey, data.image_url);
      }
    } catch (err) {
      console.error("Vehicle image fetch failed:", err);
      setError(true);
    }
    setLoading(false);
  }, [year, make, model, style]);

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  const filter = selectedColor && COLOR_FILTERS[selectedColor]
    ? COLOR_FILTERS[selectedColor]
    : "none";

  if (!year || !make || !model) return null;

  return (
    <div className={`relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-muted/30 to-transparent ${compact ? "mb-2" : "mb-4"}`}
         style={{ aspectRatio: compact ? "16/7" : "16/9" }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-xs text-muted-foreground">Generating vehicle image…</p>
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
            key="vehicle-image"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center p-2"
          >
            <motion.img
              src={imageUrl}
              alt={`${year} ${make} ${model}`}
              className="max-w-full max-h-full object-contain drop-shadow-lg"
              animate={{ filter }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ filter }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color label chip */}
      <AnimatePresence mode="wait">
        {selectedColor && imageUrl && (
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
