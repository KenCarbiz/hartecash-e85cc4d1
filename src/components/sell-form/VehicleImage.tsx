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
}

const VehicleImage = ({ year, make, model, style, selectedColor, compact = false }: Props) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const currentColorRef = useRef<string>("");

  const fetchImage = useCallback(async (color: string) => {
    if (!year || !make || !model) return;

    const colorKey = (color || "white").toLowerCase().replace(/\s+/g, "_");
    const cacheKey = `vehicle-img-${year}-${make}-${model}-${colorKey}`.toLowerCase().replace(/\s+/g, "_");

    // Check localStorage cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setImageUrl(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-vehicle-image", {
        body: { year, make, model, style, color: color || "white" },
      });

      // Only update if this is still the current color request
      if (currentColorRef.current !== color) return;

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
      if (currentColorRef.current === color) {
        console.error("Vehicle image fetch failed:", err);
        setError(true);
      }
    }
    if (currentColorRef.current === color) setLoading(false);
  }, [year, make, model, style]);

  // Fetch on mount (no color yet = white base)
  useEffect(() => {
    if (!year || !make || !model) return;
    const color = selectedColor || "white";
    currentColorRef.current = color;
    fetchImage(color);
  }, [year, make, model, style]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when color changes (debounced to avoid rapid API calls)
  useEffect(() => {
    if (!year || !make || !model) return;
    const color = selectedColor || "white";
    if (color === currentColorRef.current) return;

    currentColorRef.current = color;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchImage(color);
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selectedColor, fetchImage, year, make, model]);

  if (!year || !make || !model) return null;

  return (
    <div className={`relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-muted/30 to-transparent ${compact ? "mb-2" : "mb-4"}`}
         style={{ aspectRatio: compact ? "16/7" : "16/9" }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-xs text-muted-foreground">
            {imageUrl ? "Updating color…" : "Generating vehicle image…"}
          </p>
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
            animate={{ opacity: loading ? 0.4 : 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center p-2"
          >
            <img
              src={imageUrl}
              alt={`${year} ${make} ${model}${selectedColor ? ` in ${selectedColor}` : ""}`}
              className="max-w-full max-h-full object-contain drop-shadow-lg"
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
