import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera } from "lucide-react";
import { motion } from "framer-motion";

interface VehiclePhotosProps {
  token: string;
  photosUploaded: boolean;
}

const VehiclePhotos = ({ token, photosUploaded }: VehiclePhotosProps) => {
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!photosUploaded) return;
    const fetchPhotos = async () => {
      const { data } = await supabase.storage
        .from("submission-photos")
        .list(token, { limit: 8, sortBy: { column: "created_at", order: "asc" } });
      if (data && data.length > 0) {
        const urls = data
          .filter((f) => f.name !== ".emptyFolderPlaceholder")
          .slice(0, 6)
          .map((f) => {
            const { data: urlData } = supabase.storage
              .from("submission-photos")
              .getPublicUrl(`${token}/${f.name}`);
            return urlData.publicUrl;
          });
        setPhotos(urls);
      }
    };
    fetchPhotos();
  }, [token, photosUploaded]);

  if (photos.length === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-card rounded-xl p-5 shadow-lg"
      >
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Your Photos</h3>
          <span className="text-xs text-muted-foreground ml-auto">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setSelectedPhoto(url)}
              className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity"
            >
              <img src={url} alt={`Vehicle photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </motion.div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={selectedPhoto}
            alt="Vehicle photo"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
};

export default VehiclePhotos;
