import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw, Car, ImageIcon, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CachedImage {
  id: string;
  cache_key: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_style: string | null;
  exterior_color: string;
  storage_path: string;
  created_at: string;
  signed_url?: string;
}

const VehicleImageInventory = () => {
  const [images, setImages] = useState<CachedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CachedImage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchImages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicle_image_cache")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading inventory", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get signed URLs for thumbnails
    const withUrls = await Promise.all(
      (data || []).map(async (img: any) => {
        const { data: signedData } = await supabase.storage
          .from("submission-photos")
          .createSignedUrl(img.storage_path, 60 * 60); // 1 hour
        return { ...img, signed_url: signedData?.signedUrl || null } as CachedImage;
      })
    );

    setImages(withUrls);
    setLoading(false);
  };

  useEffect(() => { fetchImages(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (img: CachedImage) => {
    setDeletingId(img.id);
    try {
      // Delete from storage
      await supabase.storage
        .from("submission-photos")
        .remove([img.storage_path]);

      // Delete from cache table
      await supabase
        .from("vehicle_image_cache")
        .delete()
        .eq("id", img.id);

      // Remove from local state (no refresh needed)
      setImages((prev) => prev.filter((i) => i.id !== img.id));
      toast({ title: "Deleted", description: `${img.vehicle_year} ${img.vehicle_make} ${img.vehicle_model} (${img.exterior_color}) removed from cache.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
    setDeletingId(null);
    setDeleteTarget(null);
  };

  const handleRegenerate = async (img: CachedImage) => {
    setRegeneratingId(img.id);
    try {
      // Delete existing from storage + cache
      await supabase.storage.from("submission-photos").remove([img.storage_path]);
      await supabase.from("vehicle_image_cache").delete().eq("id", img.id);

      // Call edge function to regenerate
      const { data, error } = await supabase.functions.invoke("generate-vehicle-image", {
        body: {
          year: img.vehicle_year,
          make: img.vehicle_make,
          model: img.vehicle_model,
          style: img.vehicle_style,
          color: img.exterior_color,
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Generation failed");
      }

      // Fetch updated list to get new signed URL
      // Small delay to let the background upload complete
      await new Promise((r) => setTimeout(r, 2000));

      // Re-fetch just this entry
      const { data: newEntry } = await supabase
        .from("vehicle_image_cache")
        .select("*")
        .eq("cache_key", img.cache_key)
        .maybeSingle();

      if (newEntry) {
        const { data: signedData } = await supabase.storage
          .from("submission-photos")
          .createSignedUrl(newEntry.storage_path, 60 * 60);

        setImages((prev) =>
          prev.map((i) =>
            i.cache_key === img.cache_key
              ? { ...newEntry, signed_url: signedData?.signedUrl || null }
              : i
          )
        );
      } else {
        // If cache entry isn't there yet, just remove the old one and it'll appear on refresh
        setImages((prev) => prev.filter((i) => i.id !== img.id));
      }

      toast({ title: "Regenerated", description: `New image generated for ${img.vehicle_year} ${img.vehicle_make} ${img.vehicle_model} (${img.exterior_color}).` });
    } catch (err: any) {
      toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
    }
    setRegeneratingId(null);
  };

  const filtered = images.filter((img) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      img.vehicle_year.toLowerCase().includes(q) ||
      img.vehicle_make.toLowerCase().includes(q) ||
      img.vehicle_model.toLowerCase().includes(q) ||
      img.exterior_color.toLowerCase().includes(q) ||
      img.cache_key.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Vehicle Image Inventory</h2>
          <span className="text-sm text-muted-foreground">({images.length} cached)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search year, make, model, color…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-56 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchImages} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? "No matches found" : "No cached images yet"}</p>
          <p className="text-sm mt-1">Vehicle images will appear here once they&apos;re generated.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <div
              key={img.id}
              className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[16/10] bg-muted/30 flex items-center justify-center">
                {img.signed_url ? (
                  <img
                    src={img.signed_url}
                    alt={`${img.vehicle_year} ${img.vehicle_make} ${img.vehicle_model}`}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    onClick={() => handleRegenerate(img)}
                    disabled={regeneratingId === img.id}
                  >
                    {regeneratingId === img.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => setDeleteTarget(img)}
                    disabled={deletingId === img.id}
                  >
                    {deletingId === img.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="px-3 py-2.5 border-t border-border/50">
                <p className="text-sm font-semibold text-card-foreground truncate">
                  {img.vehicle_year} {img.vehicle_make} {img.vehicle_model}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full border border-border inline-block"
                      style={{
                        backgroundColor: img.exterior_color.toLowerCase() === "white" ? "#f5f5f5"
                          : img.exterior_color.toLowerCase() === "black" ? "#1a1a1a"
                          : img.exterior_color.toLowerCase() === "silver" ? "#c0c0c0"
                          : img.exterior_color.toLowerCase() === "gray" || img.exterior_color.toLowerCase() === "grey" ? "#808080"
                          : img.exterior_color.toLowerCase() === "red" ? "#cc2222"
                          : img.exterior_color.toLowerCase() === "blue" ? "#2255cc"
                          : img.exterior_color.toLowerCase() === "green" ? "#228833"
                          : img.exterior_color.toLowerCase() === "brown" ? "#8B4513"
                          : img.exterior_color.toLowerCase() === "gold" ? "#DAA520"
                          : img.exterior_color.toLowerCase() === "orange" ? "#FF6600"
                          : img.exterior_color.toLowerCase() === "yellow" ? "#FFD700"
                          : img.exterior_color.toLowerCase() === "purple" ? "#6B2FA0"
                          : img.exterior_color.toLowerCase() === "beige" ? "#D2B48C"
                          : "#999",
                      }}
                    />
                    {img.exterior_color}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {new Date(img.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cached image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the cached image for{" "}
              <strong>
                {deleteTarget?.vehicle_year} {deleteTarget?.vehicle_make} {deleteTarget?.vehicle_model} ({deleteTarget?.exterior_color})
              </strong>
              . The next time this vehicle/color combo is requested, a new image will be generated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VehicleImageInventory;
