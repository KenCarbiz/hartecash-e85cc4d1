import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw, Car, ImageIcon, Loader2, Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteMake, setBulkDeleteMake] = useState<string | null>(null);
  const [bulkDeletingMake, setBulkDeletingMake] = useState(false);
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

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const paths = images.map((img) => img.storage_path);
      if (paths.length > 0) {
        await supabase.storage.from("submission-photos").remove(paths);
      }
      const ids = images.map((img) => img.id);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        await supabase.from("vehicle_image_cache").delete().in("id", batch);
      }
      setImages([]);
      toast({ title: "All cleared", description: `${paths.length} cached image${paths.length !== 1 ? "s" : ""} deleted.` });
    } catch (err: any) {
      toast({ title: "Bulk delete failed", description: err.message, variant: "destructive" });
    }
    setBulkDeleting(false);
    setShowBulkDelete(false);
  };

  const handleBulkDeleteMake = async (make: string) => {
    setBulkDeletingMake(true);
    try {
      const makeImages = images.filter((img) => img.vehicle_make === make);
      const paths = makeImages.map((img) => img.storage_path);
      if (paths.length > 0) {
        await supabase.storage.from("submission-photos").remove(paths);
      }
      const ids = makeImages.map((img) => img.id);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        await supabase.from("vehicle_image_cache").delete().in("id", batch);
      }
      setImages((prev) => prev.filter((img) => img.vehicle_make !== make));
      toast({ title: `${make} images cleared`, description: `${paths.length} cached image${paths.length !== 1 ? "s" : ""} deleted.` });
    } catch (err: any) {
      toast({ title: "Bulk delete failed", description: err.message, variant: "destructive" });
    }
    setBulkDeletingMake(false);
    setBulkDeleteMake(null);
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

  // Group by manufacturer
  const grouped = useMemo(() => {
    const map = new Map<string, CachedImage[]>();
    for (const img of filtered) {
      const make = img.vehicle_make || "Unknown";
      if (!map.has(make)) map.set(make, []);
      map.get(make)!.push(img);
    }
    // Sort manufacturers alphabetically
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const [openMakes, setOpenMakes] = useState<Set<string>>(new Set());

  // Auto-open all groups when data loads or search changes
  useEffect(() => {
    setOpenMakes(new Set(grouped.map(([make]) => make)));
  }, [grouped.length, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMake = (make: string) => {
    setOpenMakes((prev) => {
      const next = new Set(prev);
      if (next.has(make)) next.delete(make);
      else next.add(make);
      return next;
    });
  };

  const colorSwatch = (color: string) => {
    const c = color.toLowerCase();
    const map: Record<string, string> = {
      white: "#f5f5f5", black: "#1a1a1a", silver: "#c0c0c0", gray: "#808080", grey: "#808080",
      red: "#cc2222", blue: "#2255cc", green: "#228833", brown: "#8B4513", gold: "#DAA520",
      orange: "#FF6600", yellow: "#FFD700", purple: "#6B2FA0", beige: "#D2B48C",
    };
    return map[c] || "#999";
  };

  const renderCard = (img: CachedImage) => (
    <div
      key={img.id}
      className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
    >
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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => handleRegenerate(img)} disabled={regeneratingId === img.id}>
            {regeneratingId === img.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Regenerate
          </Button>
          <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => setDeleteTarget(img)} disabled={deletingId === img.id}>
            {deletingId === img.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
            Delete
          </Button>
        </div>
      </div>
      <div className="px-3 py-2.5 border-t border-border/50">
        <p className="text-sm font-semibold text-card-foreground truncate">
          {img.vehicle_year} {img.vehicle_model}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-3 h-3 rounded-full border border-border inline-block" style={{ backgroundColor: colorSwatch(img.exterior_color) }} />
            {img.exterior_color}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(img.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );

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
          {images.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)} disabled={bulkDeleting}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear All ({images.length})
            </Button>
          )}
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
        <div className="space-y-3">
          {grouped.map(([make, makeImages]) => (
            <Collapsible key={make} open={openMakes.has(make)} onOpenChange={() => toggleMake(make)}>
              <div className="flex items-center gap-0">
                <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left py-2.5 px-4 bg-muted/50 rounded-l-lg hover:bg-muted transition-colors">
                  <ChevronDown className={`w-4 h-4 transition-transform ${openMakes.has(make) ? "" : "-rotate-90"}`} />
                  <Car className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">{make}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {makeImages.length} image{makeImages.length !== 1 ? "s" : ""}
                  </span>
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-full rounded-l-none rounded-r-lg bg-muted/50 hover:bg-destructive/10 hover:text-destructive text-muted-foreground text-xs px-3 py-2.5"
                  onClick={(e) => { e.stopPropagation(); setBulkDeleteMake(make); }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete All
                </Button>
              </div>
              <CollapsibleContent className="pt-3 pb-1 px-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {makeImages.map(renderCard)}
                </div>
              </CollapsibleContent>
            </Collapsible>
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

      {/* Bulk delete confirmation dialog */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all cached images?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>all {images.length} cached vehicle image{images.length !== 1 ? "s" : ""}</strong> from storage. New images will be generated on demand when needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Deleting…</>
              ) : (
                <>Clear All</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete by manufacturer dialog */}
      <AlertDialog open={!!bulkDeleteMake} onOpenChange={(open) => !open && setBulkDeleteMake(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all {bulkDeleteMake} images?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>all {images.filter((i) => i.vehicle_make === bulkDeleteMake).length} cached image{images.filter((i) => i.vehicle_make === bulkDeleteMake).length !== 1 ? "s" : ""}</strong> for <strong>{bulkDeleteMake}</strong>. New images will be generated on demand when needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeletingMake}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMake && handleBulkDeleteMake(bulkDeleteMake)}
              disabled={bulkDeletingMake}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeletingMake ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Deleting…</>
              ) : (
                <>Delete All {bulkDeleteMake}</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VehicleImageInventory;
