import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Library, Loader2 } from "lucide-react";

const COMMON_BRANDS = [
  "Acura", "Alfa Romeo", "Audi", "BMW", "Buick", "Cadillac",
  "Chevrolet", "Chrysler", "Dodge", "Fiat", "Ford", "Genesis",
  "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep",
  "Kia", "Land Rover", "Lexus", "Lincoln", "Maserati", "Mazda",
  "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Porsche", "Ram",
  "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo",
];

interface OemLogoPickerProps {
  dealershipId: string;
  locationId: string;
  existingLogos: string[];
  maxLogos: number;
  onAdd: (url: string) => void;
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new Blob([bytes.buffer as ArrayBuffer], { type: contentType });
}

const OemLogoPicker = ({ dealershipId, locationId, existingLogos, maxLogos, onAdd }: OemLogoPickerProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState<string | null>(null);

  const remaining = maxLogos - existingLogos.length;

  const filtered = search.trim()
    ? COMMON_BRANDS.filter(b => b.toLowerCase().includes(search.toLowerCase()))
    : COMMON_BRANDS;

  const handleSelect = async (brand: string) => {
    if (remaining <= 0) {
      toast({ title: `Maximum ${maxLogos} OEM logos`, variant: "destructive" });
      return;
    }
    setFetching(brand);
    try {
      // Step 1: Get the logo image from the edge function
      const { data, error } = await supabase.functions.invoke("fetch-oem-logo", {
        body: { action: "fetch", brand, dealershipId, locationId },
      });

      if (error || !data?.success) {
        toast({
          title: "Logo fetch failed",
          description: data?.error || error?.message || "Could not fetch logo",
          variant: "destructive",
        });
        return;
      }

      // Step 2: Upload the base64 image to storage from the client
      const safeName = data.brand.replace(/[^a-z0-9]/g, '_');
      const filePath = `${dealershipId}/${locationId}/oem_${safeName}.${data.ext}`;
      const blob = base64ToBlob(data.base64, data.contentType);

      const { error: uploadError } = await supabase.storage
        .from("dealer-logos")
        .upload(filePath, blob, { contentType: data.contentType, upsert: true });

      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        return;
      }

      const { data: urlData } = supabase.storage
        .from("dealer-logos")
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      onAdd(publicUrl);
      toast({ title: `${brand} logo added` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFetching(null);
    }
  };

  const handleSearchFetch = async () => {
    if (!search.trim()) return;
    await handleSelect(search.trim());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={remaining <= 0}>
          <Library className="w-3 h-3" />
          OEM Library
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-4 h-4" />
            OEM Logo Library
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search brands or type a custom name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {search.trim() && !COMMON_BRANDS.some(b => b.toLowerCase() === search.toLowerCase()) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSearchFetch}
                disabled={!!fetching}
                className="gap-1.5 whitespace-nowrap"
              >
                {fetching === search.trim() ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Fetch Logo
              </Button>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Click a brand to download its official logo. {remaining} slot{remaining !== 1 ? "s" : ""} remaining.
          </p>

          <ScrollArea className="h-[300px]">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pr-3">
              {filtered.map((brand) => {
                const isLoading = fetching === brand;
                return (
                  <button
                    key={brand}
                    onClick={() => handleSelect(brand)}
                    disabled={!!fetching || remaining <= 0}
                    className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent/50 hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    {brand}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OemLogoPicker;
