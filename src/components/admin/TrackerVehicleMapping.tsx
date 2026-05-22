import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Car,
  Sparkles,
  Image as ImageIcon,
  Check,
  ChevronDown,
  Monitor,
  Smartphone,
  Upload,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_OEM_FLAGSHIPS,
  type FlagshipEntry,
  mergeFlagships,
} from "@/data/oemFlagships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Mode = "oem" | "popular" | "custom";

interface TrackerOptions {
  color?: string | null;
  randomize_on_load?: boolean;
  remove_background?: boolean;
  use_same_landing_and_tracker?: boolean;
  rotate_by_session?: boolean;
  match_to_trade_type?: boolean;
  use_fallback_on_error?: boolean;
}

interface TenantOverride {
  tracker_vehicle_mode: Mode;
  tracker_vehicle_year: number | null;
  tracker_vehicle_make: string | null;
  tracker_vehicle_model: string | null;
  tracker_vehicle_style: string | null;
  tracker_vehicle_specs: string | null;
  tracker_vehicle_image_url: string | null;
  tracker_vehicle_label: string | null;
  tracker_vehicle_options: TrackerOptions;
}

const DEFAULT_OPTIONS: TrackerOptions = {
  color: null,
  randomize_on_load: false,
  remove_background: false,
  use_same_landing_and_tracker: true,
  rotate_by_session: false,
  match_to_trade_type: false,
  use_fallback_on_error: true,
};

const DEFAULT_TENANT_OVERRIDE: TenantOverride = {
  tracker_vehicle_mode: "oem",
  tracker_vehicle_year: null,
  tracker_vehicle_make: null,
  tracker_vehicle_model: null,
  tracker_vehicle_style: null,
  tracker_vehicle_specs: null,
  tracker_vehicle_image_url: null,
  tracker_vehicle_label: null,
  tracker_vehicle_options: DEFAULT_OPTIONS,
};

type FlagshipMap = Record<string, FlagshipEntry>;

const SOURCE_CARDS: Array<{
  mode: Mode;
  title: string;
  description: string;
  bestFor: string;
  icon: typeof Car;
  accent: string;
}> = [
  {
    mode: "oem",
    title: "OEM Vehicle",
    description: "Use a model from your dealership brand.",
    bestFor: "Franchise dealers who want a brand-matched landing vehicle.",
    icon: Car,
    accent: "from-blue-500/15 to-indigo-500/10 text-blue-600 dark:text-blue-300",
  },
  {
    mode: "popular",
    title: "Popular Fallback",
    description: "Use a clean, generic vehicle based on body style.",
    bestFor: "Independents and groups without a single OEM identity.",
    icon: Sparkles,
    accent: "from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-300",
  },
  {
    mode: "custom",
    title: "Specific Vehicle",
    description: "Upload a vehicle image or pin a specific unit for a campaign.",
    bestFor: "Seasonal promotions, featured inventory, or one-off launches.",
    icon: ImageIcon,
    accent: "from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-300",
  },
];

const ADDITIONAL_OPTIONS: Array<{
  key: keyof TrackerOptions;
  title: string;
  description: string;
}> = [
  {
    key: "use_same_landing_and_tracker",
    title: "Use same vehicle across landing and tracker pages",
    description: "Keep one consistent vehicle image in both the hero and the value-tracker card.",
  },
  {
    key: "rotate_by_session",
    title: "Rotate vehicle image by visitor session",
    description: "Show a different vehicle per visitor to add variety on repeat visits.",
  },
  {
    key: "match_to_trade_type",
    title: "Match landing vehicle to known trade-in type",
    description: "If we know what the visitor is trading, show a vehicle of the same body style.",
  },
  {
    key: "use_fallback_on_error",
    title: "Use fallback image if the selected image fails",
    description: "Show the Popular fallback vehicle if your chosen image can't be loaded.",
  },
];

/**
 * Tracker Vehicles tab — three-card source picker (OEM / Popular / Specific)
 * with a sticky live-preview panel. Persists to `site_config` columns
 * `tracker_vehicle_*` plus `tracker_oem_flagships` (the brand mapping
 * table tucked behind an Advanced disclosure).
 */
const TrackerVehicleMapping = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [overrides, setOverrides] = useState<FlagshipMap>({});
  const [savedOverrides, setSavedOverrides] = useState<FlagshipMap>({});
  const [tenantOv, setTenantOv] = useState<TenantOverride>(DEFAULT_TENANT_OVERRIDE);
  const [savedTenantOv, setSavedTenantOv] = useState<TenantOverride>(DEFAULT_TENANT_OVERRIDE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("site_config")
        .select(
          "tracker_oem_flagships, tracker_vehicle_mode, tracker_vehicle_year, tracker_vehicle_make, tracker_vehicle_model, tracker_vehicle_style, tracker_vehicle_specs, tracker_vehicle_image_url, tracker_vehicle_label, tracker_vehicle_options",
        )
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      const raw = (data?.tracker_oem_flagships as unknown as FlagshipMap) || {};
      setOverrides(raw);
      setSavedOverrides(raw);
      const tov: TenantOverride = {
        tracker_vehicle_mode: ((data?.tracker_vehicle_mode as Mode) || "oem"),
        tracker_vehicle_year: data?.tracker_vehicle_year ?? null,
        tracker_vehicle_make: data?.tracker_vehicle_make ?? null,
        tracker_vehicle_model: data?.tracker_vehicle_model ?? null,
        tracker_vehicle_style: data?.tracker_vehicle_style ?? null,
        tracker_vehicle_specs: (data as any)?.tracker_vehicle_specs ?? null,
        tracker_vehicle_image_url: (data as any)?.tracker_vehicle_image_url ?? null,
        tracker_vehicle_label: (data as any)?.tracker_vehicle_label ?? null,
        tracker_vehicle_options: {
          ...DEFAULT_OPTIONS,
          ...(((data as any)?.tracker_vehicle_options as TrackerOptions) || {}),
        },
      };
      setTenantOv(tov);
      setSavedTenantOv(tov);
      setLoading(false);
    })();
  }, [dealershipId]);

  const effective = useMemo(() => mergeFlagships(overrides), [overrides]);

  // Brands for the OEM dropdown (deduped by display name)
  const brandOptions = useMemo(() => {
    const seen = new Set<string>();
    return Object.entries(effective)
      .filter(([, v]) => {
        if (!v.make) return false;
        const k = v.make.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a[1].make.localeCompare(b[1].make));
  }, [effective]);

  // Models for the chosen brand
  const modelOptionsForBrand = useMemo(() => {
    const targetMake = tenantOv.tracker_vehicle_make?.toLowerCase();
    if (!targetMake) return [];
    return Object.values(effective)
      .filter((v) => v.make.toLowerCase() === targetMake)
      .map((v) => v.model);
  }, [effective, tenantOv.tracker_vehicle_make]);

  const previewVehicle = useMemo(() => {
    if (tenantOv.tracker_vehicle_mode === "custom") {
      return {
        year: tenantOv.tracker_vehicle_year ? String(tenantOv.tracker_vehicle_year) : "",
        make: tenantOv.tracker_vehicle_make || "—",
        model: tenantOv.tracker_vehicle_model || "—",
        style: tenantOv.tracker_vehicle_style || "",
        specs: tenantOv.tracker_vehicle_specs || "",
        source: tenantOv.tracker_vehicle_label || "Specific vehicle",
        imageUrl: tenantOv.tracker_vehicle_image_url || null,
      };
    }
    if (tenantOv.tracker_vehicle_mode === "popular") {
      const base = effective.toyota || DEFAULT_OEM_FLAGSHIPS.ford;
      return {
        ...base,
        style: tenantOv.tracker_vehicle_style || base.style,
        source: "Popular fallback",
        imageUrl: null as string | null,
      };
    }
    // OEM
    const overrideMake = tenantOv.tracker_vehicle_make?.toLowerCase();
    const display = (tenant?.display_name || "").toLowerCase();
    const matchKey =
      (overrideMake &&
        Object.keys(effective).find(
          (k) => effective[k].make.toLowerCase() === overrideMake,
        )) ||
      Object.keys(effective)
        .sort((a, b) => b.length - a.length)
        .find((k) => display.includes(k)) ||
      "ford";
    const base = effective[matchKey];
    // If model override exists, find a matching entry
    if (tenantOv.tracker_vehicle_model) {
      const match = Object.values(effective).find(
        (v) =>
          v.make.toLowerCase() === base.make.toLowerCase() &&
          v.model.toLowerCase() === tenantOv.tracker_vehicle_model!.toLowerCase(),
      );
      if (match) return { ...match, source: `OEM · ${match.make}`, imageUrl: null };
    }
    return { ...base, source: `OEM · ${base.make}`, imageUrl: null };
  }, [tenantOv, effective, tenant?.display_name]);

  const updateEntry = (key: string, patch: Partial<FlagshipEntry>) => {
    setOverrides((prev) => {
      const base = prev[key] ?? effective[key] ?? DEFAULT_OEM_FLAGSHIPS.ford;
      return { ...prev, [key]: { ...base, ...patch } as FlagshipEntry };
    });
  };

  const resetEntry = (key: string) => {
    setOverrides((prev) => {
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const removeKey = (key: string) => {
    if (DEFAULT_OEM_FLAGSHIPS[key]) {
      resetEntry(key);
      return;
    }
    setOverrides((prev) => {
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const [newKey, setNewKey] = useState("");
  const addKey = () => {
    const key = newKey.trim().toLowerCase();
    if (!key) return;
    if (effective[key]) {
      toast({
        title: "Key already exists",
        description: `"${key}" is already in the mapping — edit the row instead.`,
        variant: "destructive",
      });
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [key]: { year: "2022", make: "", model: "", style: "", specs: "" },
    }));
    setNewKey("");
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Image required",
        description: "Pick a PNG, JPG, or WebP file.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `tracker-vehicles/${dealershipId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("dealer-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(false);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    const { data: urlData } = supabase.storage.from("dealer-logos").getPublicUrl(path);
    setTenantOv((p) => ({ ...p, tracker_vehicle_image_url: urlData.publicUrl }));
    setUploading(false);
  };

  const dirty =
    JSON.stringify(overrides) !== JSON.stringify(savedOverrides) ||
    JSON.stringify(tenantOv) !== JSON.stringify(savedTenantOv);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({
        tracker_oem_flagships: overrides as any,
        tracker_vehicle_mode: tenantOv.tracker_vehicle_mode,
        tracker_vehicle_year: tenantOv.tracker_vehicle_year,
        tracker_vehicle_make: tenantOv.tracker_vehicle_make,
        tracker_vehicle_model: tenantOv.tracker_vehicle_model,
        tracker_vehicle_style: tenantOv.tracker_vehicle_style,
        tracker_vehicle_specs: tenantOv.tracker_vehicle_specs,
        tracker_vehicle_image_url: tenantOv.tracker_vehicle_image_url,
        tracker_vehicle_label: tenantOv.tracker_vehicle_label,
        tracker_vehicle_options: tenantOv.tracker_vehicle_options as any,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("dealership_id", dealershipId);
    setSaving(false);
    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setSavedOverrides(overrides);
    setSavedTenantOv(tenantOv);
    queryClient.invalidateQueries({ queryKey: ["site_config"] });
    toast({
      title: "Tracker vehicle saved",
      description: "Your landing page will reflect the change on next load.",
    });
  };

  const discard = () => {
    setOverrides(savedOverrides);
    setTenantOv(savedTenantOv);
  };

  const allKeys = useMemo(
    () =>
      Array.from(
        new Set([...Object.keys(DEFAULT_OEM_FLAGSHIPS), ...Object.keys(overrides)]),
      ).sort(),
    [overrides],
  );

  const setOption = <K extends keyof TrackerOptions>(key: K, value: TrackerOptions[K]) =>
    setTenantOv((p) => ({
      ...p,
      tracker_vehicle_options: { ...p.tracker_vehicle_options, [key]: value },
    }));

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8">Loading mapping…</div>;
  }

  return (
    <div className="space-y-6">
      {/* ─────────── Sticky save bar ─────────── */}
      <div
        className={cn(
          "sticky top-0 z-20 -mx-1 px-1 py-3 backdrop-blur",
          "bg-background/85 border-b border-border/60",
          "flex items-start justify-between gap-4 flex-wrap",
        )}
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-card-foreground">Tracker Vehicles</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Choose the vehicle image customers see on your landing page and value
            tracker experience.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-medium px-2 py-1 rounded-md transition-colors",
              dirty
                ? "text-amber-700 dark:text-amber-300 bg-amber-500/10"
                : "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
            )}
          >
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={discard}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Discard
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={handleSave}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* ─────────── Main grid: settings + sticky preview ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left: source picker + per-mode controls ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle source cards */}
          <div>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-card-foreground">Vehicle Source</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick how we choose the vehicle shown on the landing page.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SOURCE_CARDS.map(({ mode, title, description, bestFor, icon: Icon, accent }) => {
                const active = tenantOv.tracker_vehicle_mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setTenantOv((p) => ({ ...p, tracker_vehicle_mode: mode }))
                    }
                    className={cn(
                      "relative text-left rounded-2xl border p-4 transition-all",
                      "bg-card hover:shadow-md",
                      active
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-border/70 hover:border-border",
                    )}
                  >
                    {active && (
                      <span className="absolute top-3 right-3 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3",
                        accent,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold text-card-foreground">{title}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {description}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80 mt-2 leading-relaxed">
                      <span className="font-medium text-foreground/70">Best for: </span>
                      {bestFor}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per-mode controls */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            {tenantOv.tracker_vehicle_mode === "oem" && (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-card-foreground">OEM Vehicle Setup</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    We auto-detect a brand from your dealership name (
                    <span className="font-medium text-foreground/80">
                      {tenant?.display_name || "this dealership"}
                    </span>
                    ). Override the brand, pick a specific model, or fall back to a
                    body style.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">OEM / Brand</Label>
                    <Select
                      value={tenantOv.tracker_vehicle_make ?? "__auto"}
                      onValueChange={(v) =>
                        setTenantOv((p) => ({
                          ...p,
                          tracker_vehicle_make: v === "__auto" ? null : v,
                          tracker_vehicle_model: null,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-detect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto">Auto-detect</SelectItem>
                        {brandOptions.map(([key, entry]) => (
                          <SelectItem key={key} value={entry.make}>
                            {entry.make}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Model</Label>
                    <Select
                      value={tenantOv.tracker_vehicle_model ?? "__default"}
                      onValueChange={(v) =>
                        setTenantOv((p) => ({
                          ...p,
                          tracker_vehicle_model: v === "__default" ? null : v,
                        }))
                      }
                      disabled={!tenantOv.tracker_vehicle_make || modelOptionsForBrand.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Brand default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default">Brand default</SelectItem>
                        {modelOptionsForBrand.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Style fallback</Label>
                    <Select
                      value={tenantOv.tracker_vehicle_style ?? "SUV"}
                      onValueChange={(v) =>
                        setTenantOv((p) => ({ ...p, tracker_vehicle_style: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUV">SUV</SelectItem>
                        <SelectItem value="Sedan">Sedan</SelectItem>
                        <SelectItem value="Truck">Truck</SelectItem>
                        <SelectItem value="EV">EV</SelectItem>
                        <SelectItem value="Random">Random</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {tenantOv.tracker_vehicle_mode === "popular" && (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-card-foreground">
                    Popular Fallback Vehicle
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A safe, broadly-recognized vehicle shown when no OEM match applies.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Vehicle type</Label>
                    <Select
                      value={tenantOv.tracker_vehicle_style ?? "SUV"}
                      onValueChange={(v) =>
                        setTenantOv((p) => ({ ...p, tracker_vehicle_style: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUV">SUV</SelectItem>
                        <SelectItem value="Sedan">Sedan</SelectItem>
                        <SelectItem value="Truck">Truck</SelectItem>
                        <SelectItem value="Coupe">Coupe</SelectItem>
                        <SelectItem value="EV">EV</SelectItem>
                        <SelectItem value="Random">Random</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Color preference (optional)</Label>
                    <Select
                      value={tenantOv.tracker_vehicle_options.color ?? "__any"}
                      onValueChange={(v) => setOption("color", v === "__any" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any color" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any">Any color</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                        <SelectItem value="white">White</SelectItem>
                        <SelectItem value="black">Black</SelectItem>
                        <SelectItem value="gray">Gray</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                  <Switch
                    id="randomize-on-load"
                    checked={!!tenantOv.tracker_vehicle_options.randomize_on_load}
                    onCheckedChange={(v) => setOption("randomize_on_load", v)}
                  />
                  <div className="flex-1 -mt-0.5">
                    <Label
                      htmlFor="randomize-on-load"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Randomize on page load
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pick a different vehicle from the chosen body style every time the
                      page loads.
                    </p>
                  </div>
                </div>
              </>
            )}

            {tenantOv.tracker_vehicle_mode === "custom" && (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-card-foreground">Specific Vehicle</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload a custom image or pin a specific year / make / model. Ideal for
                    campaigns and featured units.
                  </p>
                </div>

                {/* Image upload */}
                <div className="space-y-2">
                  <Label className="text-xs">Vehicle image</Label>
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-32 rounded-lg border bg-muted/40 overflow-hidden flex items-center justify-center">
                      {tenantOv.tracker_vehicle_image_url ? (
                        <img
                          src={tenantOv.tracker_vehicle_image_url}
                          alt="Tracker vehicle preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          {uploading ? "Uploading…" : "Upload image"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          title="Inventory search — coming soon"
                        >
                          <Search className="h-3.5 w-3.5 mr-1.5" />
                          Search inventory
                        </Button>
                        {tenantOv.tracker_vehicle_image_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setTenantOv((p) => ({ ...p, tracker_vehicle_image_url: null }))
                            }
                          >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        PNG, JPG, or WebP. Recommended 1600×900 with a transparent or clean
                        background.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs">Year</Label>
                    <Input
                      type="number"
                      value={tenantOv.tracker_vehicle_year ?? ""}
                      onChange={(e) =>
                        setTenantOv((p) => ({
                          ...p,
                          tracker_vehicle_year: e.target.value
                            ? Number(e.target.value)
                            : null,
                        }))
                      }
                      placeholder="2022"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Make</Label>
                    <Input
                      value={tenantOv.tracker_vehicle_make ?? ""}
                      onChange={(e) =>
                        setTenantOv((p) => ({
                          ...p,
                          tracker_vehicle_make: e.target.value || null,
                        }))
                      }
                      placeholder="Ford"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Model</Label>
                    <Input
                      value={tenantOv.tracker_vehicle_model ?? ""}
                      onChange={(e) =>
                        setTenantOv((p) => ({
                          ...p,
                          tracker_vehicle_model: e.target.value || null,
                        }))
                      }
                      placeholder="Explorer"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Trim</Label>
                    <Input
                      value={tenantOv.tracker_vehicle_style ?? ""}
                      onChange={(e) =>
                        setTenantOv((p) => ({
                          ...p,
                          tracker_vehicle_style: e.target.value || null,
                        }))
                      }
                      placeholder="XLT"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Specs line</Label>
                    <Input
                      value={tenantOv.tracker_vehicle_specs ?? ""}
                      onChange={(e) =>
                        setTenantOv((p) => ({
                          ...p,
                          tracker_vehicle_specs: e.target.value || null,
                        }))
                      }
                      placeholder="4D SUV · 2.3L · 38k mi"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Display label (optional)</Label>
                    <Input
                      value={tenantOv.tracker_vehicle_label ?? ""}
                      onChange={(e) =>
                        setTenantOv((p) => ({
                          ...p,
                          tracker_vehicle_label: e.target.value || null,
                        }))
                      }
                      placeholder="Featured trade · Spring Event"
                    />
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                    <Switch
                      id="remove-bg"
                      checked={!!tenantOv.tracker_vehicle_options.remove_background}
                      onCheckedChange={(v) => setOption("remove_background", v)}
                    />
                    <div className="flex-1 -mt-0.5">
                      <Label htmlFor="remove-bg" className="text-sm font-medium cursor-pointer">
                        Remove image background
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Strip the background so the vehicle floats on your hero. Processed at
                        upload.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ─────────── Additional options ─────────── */}
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-card-foreground">Additional Options</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Behavior shared across all source modes.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {ADDITIONAL_OPTIONS.map((opt) => (
                <div
                  key={opt.key}
                  className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <Switch
                    id={`opt-${opt.key}`}
                    checked={!!tenantOv.tracker_vehicle_options[opt.key]}
                    onCheckedChange={(v) => setOption(opt.key, v)}
                  />
                  <div className="flex-1 -mt-0.5">
                    <Label
                      htmlFor={`opt-${opt.key}`}
                      className="text-sm font-medium cursor-pointer leading-tight block"
                    >
                      {opt.title}
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─────────── Advanced: OEM brand mapping table ─────────── */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition"
            >
              <div className="text-left">
                <div className="text-sm font-semibold text-card-foreground">
                  Advanced · OEM Brand Mapping
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Per-brand defaults used when "OEM Vehicle" is selected. Most dealers
                  never need to touch this.
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showAdvanced && "rotate-180",
                )}
              />
            </button>

            {showAdvanced && (
              <div className="border-t p-5 space-y-4">
                <div className="flex items-end gap-2 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <Label className="text-xs">Add brand key</Label>
                    <Input
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="e.g. rivian, polestar, lucid"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addKey();
                      }}
                    />
                  </div>
                  <Button size="sm" onClick={addKey} disabled={!newKey.trim()}>
                    <Plus className="h-4 w-4 mr-1.5" /> Add
                  </Button>
                </div>

                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Brand key</TableHead>
                        <TableHead className="w-[80px]">Year</TableHead>
                        <TableHead>Make</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Trim / Style</TableHead>
                        <TableHead>Specs line</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allKeys.map((key) => {
                        const entry = effective[key];
                        const isOverridden = Object.prototype.hasOwnProperty.call(
                          overrides,
                          key,
                        );
                        const isCustom = !DEFAULT_OEM_FLAGSHIPS[key];
                        return (
                          <TableRow key={key}>
                            <TableCell className="font-mono text-xs align-top pt-3">
                              <div className="flex flex-col gap-1">
                                <span>{key}</span>
                                <div className="flex gap-1 flex-wrap">
                                  {isCustom && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      Custom
                                    </Badge>
                                  )}
                                  {isOverridden && !isCustom && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Overridden
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={entry.year}
                                onChange={(e) => updateEntry(key, { year: e.target.value })}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={entry.make}
                                onChange={(e) => updateEntry(key, { make: e.target.value })}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={entry.model}
                                onChange={(e) => updateEntry(key, { model: e.target.value })}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={entry.style}
                                onChange={(e) => updateEntry(key, { style: e.target.value })}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={entry.specs}
                                onChange={(e) => updateEntry(key, { specs: e.target.value })}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell className="align-top text-right">
                              <div className="flex justify-end gap-1">
                                {isOverridden && !isCustom && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => resetEntry(key)}
                                    title="Reset to default"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {isCustom && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeKey(key)}
                                    title="Remove custom key"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: sticky preview panel ─── */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-32 space-y-3">
            <div className="rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-slate-50 overflow-hidden shadow-lg">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    Landing Vehicle Preview
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">{previewVehicle.source}</div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-slate-700/60 text-slate-100 border-slate-600"
                >
                  Live
                </Badge>
              </div>

              {/* Desktop frame */}
              <div className="px-5">
                <div className="aspect-[16/9] rounded-lg bg-slate-700/40 border border-slate-600/40 flex items-center justify-center relative overflow-hidden">
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 30% 40%, rgba(99,102,241,0.4), transparent 60%), radial-gradient(circle at 70% 70%, rgba(16,185,129,0.3), transparent 60%)",
                    }}
                  />
                  {previewVehicle.imageUrl ? (
                    <img
                      src={previewVehicle.imageUrl}
                      alt="Tracker vehicle"
                      className="relative z-10 max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Car
                      className="h-16 w-16 text-slate-300 relative z-10"
                      strokeWidth={1.2}
                    />
                  )}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className="space-y-0.5">
                  <div className="text-base font-semibold">
                    {previewVehicle.year} {previewVehicle.make} {previewVehicle.model}
                  </div>
                  {previewVehicle.style && (
                    <div className="text-xs text-slate-300">Trim: {previewVehicle.style}</div>
                  )}
                  {previewVehicle.specs && (
                    <div className="text-xs text-slate-400 pt-1">{previewVehicle.specs}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-700/60">
                  <Monitor className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400">Desktop · Landing hero</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400">
                    Mobile · Value tracker card
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
              Preview is illustrative. The real landing page renders the production
              vehicle imagery once you save.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TrackerVehicleMapping;
