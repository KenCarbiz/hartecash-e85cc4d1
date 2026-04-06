import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Image, Loader2 } from "lucide-react";

interface LocationLogoSectionProps {
  location: {
    id: string;
    name: string;
    corporate_logo_url: string | null;
    corporate_logo_dark_url: string | null;
    secondary_logo_url: string | null;
    secondary_logo_dark_url: string | null;
    oem_logo_urls: string[];
    logo_layout: string;
    show_corporate_logo: boolean;
    show_corporate_on_landing_only: boolean;
  };
  dealershipId: string;
  onUpdate: (field: string, value: any) => void;
}

const MAX_OEM_LOGOS = 4;

const LocationLogoSection = ({ location, dealershipId, onUpdate }: LocationLogoSectionProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const corpInputRef = useRef<HTMLInputElement>(null);
  const corpDarkInputRef = useRef<HTMLInputElement>(null);
  const secInputRef = useRef<HTMLInputElement>(null);
  const secDarkInputRef = useRef<HTMLInputElement>(null);
  const oemInputRef = useRef<HTMLInputElement>(null);

  const uploadLogo = async (file: File, path: string): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${dealershipId}/${location.id}/${path}.${ext}`;
    
    const { error } = await supabase.storage
      .from("dealer-logos")
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("dealer-logos")
      .getPublicUrl(filePath);

    return urlData.publicUrl + `?t=${Date.now()}`;
  };

  const handleCorpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("corporate");
    const url = await uploadLogo(file, "corporate");
    if (url) onUpdate("corporate_logo_url", url);
    setUploading(null);
    if (corpInputRef.current) corpInputRef.current.value = "";
  };

  const handleCorpDarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("corporate_dark");
    const url = await uploadLogo(file, "corporate_dark");
    if (url) onUpdate("corporate_logo_dark_url", url);
    setUploading(null);
    if (corpDarkInputRef.current) corpDarkInputRef.current.value = "";
  };

  const handleSecUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("secondary");
    const url = await uploadLogo(file, "secondary");
    if (url) onUpdate("secondary_logo_url", url);
    setUploading(null);
    if (secInputRef.current) secInputRef.current.value = "";
  };

  const handleSecDarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("secondary_dark");
    const url = await uploadLogo(file, "secondary_dark");
    if (url) onUpdate("secondary_logo_dark_url", url);
    setUploading(null);
    if (secDarkInputRef.current) secDarkInputRef.current.value = "";
  };

  const handleOemUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if ((location.oem_logo_urls || []).length >= MAX_OEM_LOGOS) {
      toast({ title: "Maximum 4 OEM logos", variant: "destructive" });
      return;
    }
    setUploading("oem");
    const idx = (location.oem_logo_urls || []).length;
    const url = await uploadLogo(file, `oem_${idx}`);
    if (url) {
      onUpdate("oem_logo_urls", [...(location.oem_logo_urls || []), url]);
    }
    setUploading(null);
    if (oemInputRef.current) oemInputRef.current.value = "";
  };

  const removeOemLogo = (index: number) => {
    const updated = [...(location.oem_logo_urls || [])];
    updated.splice(index, 1);
    onUpdate("oem_logo_urls", updated);
  };

  return (
    <div className="space-y-4 border border-border/50 rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Image className="w-4 h-4 text-primary" />
        <Label className="text-xs font-semibold">Logo Configuration</Label>
      </div>

      {/* Corporate Logo — Light & Dark */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Corporate / Parent Logo</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Light variant */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Light / Default</span>
            <div className="flex items-center gap-2">
              {location.corporate_logo_url ? (
                <div className="relative group">
                  <img src={location.corporate_logo_url} alt="Corporate logo (light)" className="h-12 w-auto max-w-[140px] object-contain rounded border border-border bg-background p-1" />
                  <button onClick={() => onUpdate("corporate_logo_url", null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
              ) : (
                <div className="h-12 w-28 rounded border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">No logo</div>
              )}
              <Button size="sm" variant="outline" onClick={() => corpInputRef.current?.click()} disabled={uploading === "corporate"} className="gap-1.5">
                {uploading === "corporate" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Upload
              </Button>
              <input ref={corpInputRef} type="file" accept="image/*" className="hidden" onChange={handleCorpUpload} />
            </div>
          </div>
          {/* Dark variant */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Dark (for light backgrounds)</span>
            <div className="flex items-center gap-2">
              {location.corporate_logo_dark_url ? (
                <div className="relative group">
                  <img src={location.corporate_logo_dark_url} alt="Corporate logo (dark)" className="h-12 w-auto max-w-[140px] object-contain rounded border border-border bg-muted p-1" />
                  <button onClick={() => onUpdate("corporate_logo_dark_url", null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
              ) : (
                <div className="h-12 w-28 rounded border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">No logo</div>
              )}
              <Button size="sm" variant="outline" onClick={() => corpDarkInputRef.current?.click()} disabled={uploading === "corporate_dark"} className="gap-1.5">
                {uploading === "corporate_dark" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Upload
              </Button>
              <input ref={corpDarkInputRef} type="file" accept="image/*" className="hidden" onChange={handleCorpDarkUpload} />
            </div>
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="space-y-2 ml-1 border-l-2 border-border pl-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={location.show_corporate_logo}
            onCheckedChange={(v) => onUpdate("show_corporate_logo", v)}
          />
          <Label className="text-xs">Show corporate logo on this store's pages</Label>
        </div>
        {location.show_corporate_logo && (
          <>
            <div className="flex items-center gap-2">
              <Switch
                checked={location.show_corporate_on_landing_only}
                onCheckedChange={(v) => onUpdate("show_corporate_on_landing_only", v)}
              />
              <Label className="text-xs">Only on landing pages (hide on portal/offer)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Layout:</Label>
              <Select
                value={location.logo_layout || "side_by_side"}
                onValueChange={(v) => onUpdate("logo_layout", v)}
              >
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side_by_side">Side by Side</SelectItem>
                  <SelectItem value="stacked">Stacked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Secondary Logo — Light & Dark */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Additional / Auxiliary Logo (optional)</Label>
        <p className="text-[10px] text-muted-foreground -mt-2">
          An extra logo shown alongside your main dealership logo — e.g. an alternate brand logo, certification badge, or promotional mark. Appears on landing pages and the site header.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Light variant */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Light / Default</span>
            <div className="flex items-center gap-2">
              {location.secondary_logo_url ? (
                <div className="relative group">
                  <img src={location.secondary_logo_url} alt="Additional logo (light)" className="h-12 w-auto max-w-[140px] object-contain rounded border border-border bg-background p-1" />
                  <button onClick={() => onUpdate("secondary_logo_url", null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
              ) : (
                <div className="h-12 w-28 rounded border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">No logo</div>
              )}
              <Button size="sm" variant="outline" onClick={() => secInputRef.current?.click()} disabled={uploading === "secondary"} className="gap-1.5">
                {uploading === "secondary" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Upload
              </Button>
              <input ref={secInputRef} type="file" accept="image/*" className="hidden" onChange={handleSecUpload} />
            </div>
          </div>
          {/* Dark variant */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Dark (for light backgrounds)</span>
            <div className="flex items-center gap-2">
              {location.secondary_logo_dark_url ? (
                <div className="relative group">
                  <img src={location.secondary_logo_dark_url} alt="Additional logo (dark)" className="h-12 w-auto max-w-[140px] object-contain rounded border border-border bg-muted p-1" />
                  <button onClick={() => onUpdate("secondary_logo_dark_url", null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
              ) : (
                <div className="h-12 w-28 rounded border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">No logo</div>
              )}
              <Button size="sm" variant="outline" onClick={() => secDarkInputRef.current?.click()} disabled={uploading === "secondary_dark"} className="gap-1.5">
                {uploading === "secondary_dark" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Upload
              </Button>
              <input ref={secDarkInputRef} type="file" accept="image/*" className="hidden" onChange={handleSecDarkUpload} />
            </div>
          </div>
        </div>
      </div>

      {/* OEM / Brand Logos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">OEM / Franchise Logos (max {MAX_OEM_LOGOS})</Label>
          <span className="text-[10px] text-muted-foreground">{(location.oem_logo_urls || []).length}/{MAX_OEM_LOGOS}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(location.oem_logo_urls || []).map((url, idx) => (
            <div key={idx} className="relative group">
              <img
                src={url}
                alt={`OEM logo ${idx + 1}`}
                className="h-10 w-auto max-w-[120px] object-contain rounded border border-border bg-background p-1"
              />
              <button
                onClick={() => removeOemLogo(idx)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {(location.oem_logo_urls || []).length < MAX_OEM_LOGOS && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => oemInputRef.current?.click()}
              disabled={uploading === "oem"}
              className="h-10 gap-1.5"
            >
              {uploading === "oem" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Add Logo
            </Button>
          )}
          <input ref={oemInputRef} type="file" accept="image/*" className="hidden" onChange={handleOemUpload} />
        </div>
        <p className="text-[10px] text-muted-foreground">
          e.g. Chrysler, Dodge, Jeep, Ram — these appear next to your dealership logo in the header
        </p>
      </div>
    </div>
  );
};

export default LocationLogoSection;
