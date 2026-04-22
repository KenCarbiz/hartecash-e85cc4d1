import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, Sparkles, Loader2, CheckCircle2,
  MapPin, Plus, Trash2, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { LocationEntry, RooftopLandingTemplate, WizardState } from "./types";
import { createLocationEntry, suggestRooftopSlug } from "./types";

const ROOFTOP_TEMPLATE_OPTIONS: { value: RooftopLandingTemplate; label: string }[] = [
  { value: "", label: "Group default" },
  { value: "classic", label: "Classic" },
  { value: "video", label: "Video Hero" },
  { value: "inventory", label: "Inventory-Forward" },
  { value: "trust", label: "Trust-Wall" },
  { value: "editorial", label: "Editorial" },
];

const LOCATION_TYPES = [
  { value: "primary", label: "Primary Store" },
  { value: "sister_store", label: "Sister Store" },
  { value: "used_car_center", label: "Used Car Center" },
  { value: "buying_center", label: "Buying Center" },
];

const COMMON_BRANDS = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler",
  "Dodge", "Ford", "Genesis", "GMC", "Honda", "Hyundai", "Infiniti",
  "Jaguar", "Jeep", "Kia", "Land Rover", "Lexus", "Lincoln", "Mazda",
  "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Porsche", "Ram",
  "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo",
];

interface Props {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
}

const LocationSetupStep = ({ state, onChange }: Props) => {
  const [expandedIdx, setExpandedIdx] = useState<number>(0);
  const [scrapingIdx, setScrapingIdx] = useState<number | null>(null);

  const locs = state.locations;

  const updateLocation = (idx: number, partial: Partial<LocationEntry>) => {
    const next = [...locs];
    next[idx] = { ...next[idx], ...partial };
    onChange({ locations: next });
  };

  const addLocation = () => {
    onChange({ locations: [...locs, createLocationEntry(locs.length)] });
    setExpandedIdx(locs.length);
  };

  const removeLocation = (idx: number) => {
    const next = locs.filter((_, i) => i !== idx);
    onChange({ locations: next });
    if (expandedIdx >= next.length) setExpandedIdx(Math.max(0, next.length - 1));
  };

  const handleScrapeLocation = async (idx: number) => {
    const loc = locs[idx];
    const url = loc.websiteUrl || state.websiteUrl;
    if (!url) {
      toast.error("Enter a website URL for this location");
      return;
    }
    setScrapingIdx(idx);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-dealer-site", {
        body: { url },
      });
      if (error) throw error;
      if (data?.success && data?.data) {
        const sd = data.data;
        updateLocation(idx, {
          scrapedData: sd,
          name: loc.name || sd.dealership_name || "",
          phone: loc.phone || sd.phone || "",
          email: loc.email || sd.email || "",
          address: loc.address || sd.address || "",
          oem_brands: loc.oem_brands.length ? loc.oem_brands : sd.oem_brands || [],
        });
        toast.success(`Extracted data for ${sd.dealership_name || "location"}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Scrape failed");
    } finally {
      setScrapingIdx(null);
    }
  };

  const toggleBrand = (idx: number, brand: string) => {
    const loc = locs[idx];
    const brands = loc.oem_brands.includes(brand)
      ? loc.oem_brands.filter((b) => b !== brand)
      : [...loc.oem_brands, brand];
    updateLocation(idx, { oem_brands: brands });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">Location Setup</h3>
          <p className="text-xs text-muted-foreground">
            Configure each location with branding, contact info, and OEM brands.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={addLocation} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Location
        </Button>
      </div>

      {locs.map((loc, idx) => {
        const isOpen = expandedIdx === idx;
        const isScraping = scrapingIdx === idx;
        const hasData = !!loc.scrapedData;

        return (
          <div key={loc.id} className="border rounded-xl overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => setExpandedIdx(isOpen ? -1 : idx)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
                isOpen ? "bg-muted/50 border-b" : "bg-card hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">
                  {loc.name || `Location ${idx + 1}`}
                </span>
                {hasData && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                <Badge variant="secondary" className="text-[10px]">
                  {LOCATION_TYPES.find((t) => t.value === loc.locationType)?.label || loc.locationType}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {locs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeLocation(idx); }}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="p-4 space-y-4">
                {/* AI Scrape for this location */}
                <div className="flex gap-2">
                  <Input
                    value={loc.websiteUrl}
                    onChange={(e) => updateLocation(idx, { websiteUrl: e.target.value })}
                    placeholder={state.websiteUrl || "https://location-website.com"}
                    className="flex-1 text-sm"
                  />
                  <Button size="sm" onClick={() => handleScrapeLocation(idx)} disabled={isScraping} className="gap-1.5">
                    {isScraping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Scan
                  </Button>
                </div>

                {/* Basic info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Store Name</Label>
                    <Input value={loc.name} onChange={(e) => updateLocation(idx, { name: e.target.value })} className="mt-1 text-sm" placeholder="Smith Toyota" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Type</Label>
                    <Select value={loc.locationType} onValueChange={(v) => updateLocation(idx, { locationType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LOCATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Phone</Label>
                    <Input value={loc.phone} onChange={(e) => updateLocation(idx, { phone: e.target.value })} className="mt-1 text-sm" placeholder="(860) 555-1234" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Email</Label>
                    <Input value={loc.email} onChange={(e) => updateLocation(idx, { email: e.target.value })} className="mt-1 text-sm" placeholder="info@store.com" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium">Address</Label>
                    <Input value={loc.address} onChange={(e) => updateLocation(idx, { address: e.target.value })} className="mt-1 text-sm" placeholder="123 Main St, Hartford, CT 06103" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">City</Label>
                    <Input value={loc.city} onChange={(e) => updateLocation(idx, { city: e.target.value })} className="mt-1 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">State</Label>
                    <Input value={loc.state} onChange={(e) => updateLocation(idx, { state: e.target.value })} className="mt-1 text-sm" maxLength={2} />
                  </div>
                </div>

                {/* OEM Brands */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">OEM Brands at this rooftop</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_BRANDS.map((brand) => (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => toggleBrand(idx, brand)}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-md border transition-colors",
                          loc.oem_brands.includes(brand)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:bg-muted text-muted-foreground"
                        )}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logos */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Location Logos</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniLogoSlot label="Light Logo" value={loc.locationLogoUrl} onChange={(v) => updateLocation(idx, { locationLogoUrl: v })} />
                    <MiniLogoSlot label="Dark Logo" value={loc.locationLogoDarkUrl} onChange={(v) => updateLocation(idx, { locationLogoDarkUrl: v })} />
                  </div>
                </div>

                {/* Rooftop Website — optional per-location URL + landing template */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                    <Switch
                      checked={loc.ownRooftopSite}
                      onCheckedChange={(v) => {
                        const next: Partial<LocationEntry> = { ownRooftopSite: v };
                        // When enabling for the first time, pre-fill slug suggestion
                        if (v && !loc.rooftopSlug) {
                          next.rooftopSlug = suggestRooftopSlug(state.slug, loc.name);
                        }
                        updateLocation(idx, next);
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">Give this rooftop its own website</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Creates a second URL for this location so it can have its own landing page,
                        template, and branding. Leads still flow to the group's single inbox.
                      </div>
                    </div>
                  </div>

                  {loc.ownRooftopSite && (
                    <div className="space-y-3 pl-3 border-l-2 border-primary/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium">
                            Rooftop Slug <span className="text-muted-foreground">(subdomain)</span>
                          </Label>
                          <Input
                            value={loc.rooftopSlug}
                            onChange={(e) => updateLocation(idx, { rooftopSlug: e.target.value })}
                            onBlur={() => {
                              // Auto-suggest on blur if still empty
                              if (!loc.rooftopSlug && loc.name) {
                                updateLocation(idx, {
                                  rooftopSlug: suggestRooftopSlug(state.slug, loc.name),
                                });
                              }
                            }}
                            placeholder={suggestRooftopSlug(state.slug, loc.name) || "smith-toyota"}
                            className="mt-1 text-sm font-mono"
                          />
                          {loc.rooftopSlug && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Will serve at <span className="font-mono">{loc.rooftopSlug}.autocurb.io</span>
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs font-medium">
                            Custom Domain <span className="text-muted-foreground">(optional)</span>
                          </Label>
                          <Input
                            value={loc.rooftopCustomDomain}
                            onChange={(e) => updateLocation(idx, { rooftopCustomDomain: e.target.value })}
                            placeholder="smithtoyota.com"
                            className="mt-1 text-sm font-mono"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Add later in Rooftop Websites if the dealer doesn't own one yet.
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium">Landing Template for this rooftop</Label>
                        <Select
                          value={loc.rooftopLandingTemplate}
                          onValueChange={(v) =>
                            updateLocation(idx, { rooftopLandingTemplate: v as RooftopLandingTemplate })
                          }
                        >
                          <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROOFTOP_TEMPLATE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value || "__group__"} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          "Group default" uses whatever the group picks in Landing &amp; Flow.
                          Dealers can always switch later per rooftop.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

function MiniLogoSlot({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-2 space-y-1.5">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      {value ? (
        <img src={value} alt={label} className="h-8 object-contain mx-auto" />
      ) : (
        <div className="h-8 flex items-center justify-center text-muted-foreground/40">
          <ImageIcon className="w-4 h-4" />
        </div>
      )}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="URL"
        className="text-[10px] h-6"
      />
    </div>
  );
}

export default LocationSetupStep;
