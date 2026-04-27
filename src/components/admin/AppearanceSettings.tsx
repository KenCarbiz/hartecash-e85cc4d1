import { useEffect, useState } from "react";
import { Crown, Lock, Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * AppearanceSettings — admin-only Theme/Layout/Fine-tune editor.
 *
 * Lifts the AppearancePage from Admin Refresh.html mockup (lines 1373–1648).
 * Persists to site_config columns added in the Step 6 migration:
 *   ui_scale, text_scale, top_bar_style, top_bar_bg, top_bar_bg_2,
 *   top_bar_text, top_bar_height, top_bar_shimmer, top_bar_shimmer_style,
 *   top_bar_shimmer_speed, file_layout, customer_file_accent,
 *   customer_file_accent_2.
 *
 * Saves are debounced via local pending state + explicit "Save changes"
 * action so dealers don't get hammered with autosaves on every drag.
 */

interface AppearanceSettingsProps {
  userRole?: string;
  canManageAccess?: boolean;
}

const PRESET_THEMES: { name: string; bg: string; accent: string; sub: string; recommended?: boolean }[] = [
  { name: "Hartecash",   bg: "#00407f", accent: "#005bb5", sub: "Default. Calm, confident, dealership-grade." },
  { name: "Classic Blue", bg: "#1e40af", accent: "#3b82f6", sub: "Same navy as Dealertrack, VinSolutions, every credit-union portal. Safe, forgettable.", recommended: true },
  { name: "Ink + Amber", bg: "#0f172a", accent: "#e8a33d", sub: "Editorial, Bloomberg-adjacent. Warmest premium. Stands out at the dealer-lot dusk." },
  { name: "Forest",      bg: "#065f46", accent: "#10b981", sub: "AutoNation-adjacent trust. Country-club energy." },
  { name: "Oxblood",     bg: "#7f1d1d", accent: "#dc2626", sub: "Heritage, Hertz-ish. Polarizing on purpose." },
  { name: "Terracotta",  bg: "#c2410c", accent: "#f97316", sub: "Aesop / Rivian interior. Softer, more hospitable." },
];

const TOP_BAR_STYLES = [
  { k: "solid", label: "Solid" },
  { k: "gradient", label: "Gradient" },
  { k: "gradient-diagonal", label: "Diagonal" },
  { k: "gradient-3stop", label: "3-stop (Hartecash)" },
];

const FILE_LAYOUTS = [
  { k: "classic", label: "Classic", sub: "Tabs + right rail (legacy)" },
  { k: "conversation", label: "Conversation-first", sub: "Messages primary, deal collapsed" },
];

/** Lighten a hex color toward white by `amount` (0–1). */
const lightenHex = (hex: string, amount: number): string => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
};

interface LocationRow {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
}

const AppearanceSettings = ({ userRole, canManageAccess }: AppearanceSettingsProps) => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"theme" | "layout" | "finetune">("theme");
  const [saving, setSaving] = useState(false);

  // Multi-location: null = tenant default (write to site_config); a string id =
  // per-location override (write to dealership_locations row).
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [applyToAllOpen, setApplyToAllOpen] = useState(false);

  const fromConfigDefaults = () => ({
    top_bar_style: (config as any).top_bar_style || "solid",
    top_bar_bg: (config as any).top_bar_bg || "#00407f",
    top_bar_bg_2: (config as any).top_bar_bg_2 || "#005bb5",
    top_bar_text: (config as any).top_bar_text || "#ffffff",
    top_bar_height: Number((config as any).top_bar_height ?? 64),
    top_bar_shimmer: (config as any).top_bar_shimmer ?? true,
    top_bar_shimmer_style: (config as any).top_bar_shimmer_style || "sheen",
    top_bar_shimmer_speed: Number((config as any).top_bar_shimmer_speed ?? 3.2),
    ui_scale: Number((config as any).ui_scale ?? 100),
    text_scale: Number((config as any).text_scale ?? 100),
    file_layout: (config as any).file_layout || "classic",
    customer_file_header_layout: ((config as any).customer_file_header_layout || "b") as "a" | "b" | "c",
    customer_file_accent: (config as any).customer_file_accent || "#003b80",
    customer_file_accent_2: (config as any).customer_file_accent_2 || "#005bb5",
  });

  // Local draft mirrors site_config so live preview updates without round-trip
  const [draft, setDraft] = useState(fromConfigDefaults());

  // Load locations for the tenant once, so the selector can list them.
  useEffect(() => {
    if (!tenant?.dealership_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("dealership_locations")
        .select("id, name, city, state")
        .eq("dealership_id", tenant.dealership_id)
        .order("name", { ascending: true });
      if (!cancelled && data) setLocations(data as LocationRow[]);
    })();
    return () => { cancelled = true; };
  }, [tenant?.dealership_id]);

  // When the selection changes, reload the draft from the appropriate row.
  useEffect(() => {
    if (selectedLocationId == null) {
      // Tenant default — populate from corporate config
      setDraft(fromConfigDefaults());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("dealership_locations")
        .select("top_bar_style, top_bar_bg, top_bar_bg_2, top_bar_text, top_bar_height, top_bar_shimmer, top_bar_shimmer_style, top_bar_shimmer_speed, ui_scale, text_scale, file_layout, customer_file_header_layout, customer_file_accent, customer_file_accent_2")
        .eq("id", selectedLocationId)
        .maybeSingle();
      if (cancelled) return;
      const corp = fromConfigDefaults();
      if (!data) { setDraft(corp); return; }
      // Per-location: a NULL field means "inherit from corporate", so fall back.
      setDraft({
        top_bar_style: data.top_bar_style ?? corp.top_bar_style,
        top_bar_bg: data.top_bar_bg ?? corp.top_bar_bg,
        top_bar_bg_2: data.top_bar_bg_2 ?? corp.top_bar_bg_2,
        top_bar_text: data.top_bar_text ?? corp.top_bar_text,
        top_bar_height: data.top_bar_height ?? corp.top_bar_height,
        top_bar_shimmer: data.top_bar_shimmer ?? corp.top_bar_shimmer,
        top_bar_shimmer_style: data.top_bar_shimmer_style ?? corp.top_bar_shimmer_style,
        top_bar_shimmer_speed: data.top_bar_shimmer_speed ?? corp.top_bar_shimmer_speed,
        ui_scale: data.ui_scale ?? corp.ui_scale,
        text_scale: data.text_scale ?? corp.text_scale,
        file_layout: data.file_layout ?? corp.file_layout,
        customer_file_header_layout: (data.customer_file_header_layout ?? corp.customer_file_header_layout) as "a" | "b" | "c",
        customer_file_accent: data.customer_file_accent ?? corp.customer_file_accent,
        customer_file_accent_2: data.customer_file_accent_2 ?? corp.customer_file_accent_2,
      });
    })();
    return () => { cancelled = true; };
  // We intentionally exclude `config` so changing tenant default doesn't
  // re-stomp the per-location draft mid-edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]);

  const isAdmin = canManageAccess || userRole === "admin" || userRole === "gsm_gm";

  if (!isAdmin) {
    return (
      <div className="max-w-[600px] mx-auto px-6 py-16 text-center">
        <Lock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">Admin access required</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Appearance settings are managed by your GM or platform admin.
        </p>
      </div>
    );
  }

  const set = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleStyleChange = (style: string) => {
    set("top_bar_style", style);
    // Auto-seed bg2 with a lighter tint when switching to a gradient mode
    if (
      style.startsWith("gradient") &&
      (!draft.top_bar_bg_2 ||
        draft.top_bar_bg_2.toLowerCase() === draft.top_bar_bg.toLowerCase())
    ) {
      set("top_bar_bg_2", lightenHex(draft.top_bar_bg, 0.35));
    }
  };

  const applyPreset = (preset: { bg: string; accent: string }) => {
    setDraft((prev) => ({
      ...prev,
      top_bar_bg: preset.bg,
      top_bar_bg_2: preset.bg,
      customer_file_accent: preset.accent,
      customer_file_accent_2: preset.accent,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let error;
      if (selectedLocationId == null) {
        // Tenant default → site_config
        const result = await (supabase as any)
          .from("site_config")
          .update(draft)
          .eq("dealership_id", (config as any).dealership_id || tenant.dealership_id || "default");
        error = result.error;
      } else {
        // Per-location override → dealership_locations
        const result = await (supabase as any)
          .from("dealership_locations")
          .update(draft)
          .eq("id", selectedLocationId);
        error = result.error;
      }

      if (error) throw error;

      const where = selectedLocationId == null
        ? "tenant default"
        : (locations.find((l) => l.id === selectedLocationId)?.name || "this location");
      toast({ title: "Appearance saved", description: `Changes applied to ${where}.` });
      await queryClient.invalidateQueries({ queryKey: ["site_config"] });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err.message || "Could not save appearance settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Push the current draft to every location for this tenant. Useful for
  // multi-rooftop dealers who want one push to update all stores at once.
  const handleApplyToAll = async () => {
    if (locations.length === 0) {
      toast({ title: "No other locations", description: "There are no additional locations to apply to." });
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("dealership_locations")
        .update(draft)
        .eq("dealership_id", tenant.dealership_id);
      if (error) throw error;
      toast({
        title: `Applied to ${locations.length} ${locations.length === 1 ? "location" : "locations"}`,
        description: "Every store under this tenant now uses these settings (unless they're inherited).",
      });
      await queryClient.invalidateQueries({ queryKey: ["site_config"] });
    } catch (err: any) {
      toast({
        title: "Bulk apply failed",
        description: err.message || "Could not push to all locations.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setApplyToAllOpen(false);
    }
  };

  const tabs = [
    { k: "theme" as const, label: "Theme", sub: "Brand colors, logo, typography" },
    { k: "layout" as const, label: "Layout", sub: "Top bar + page layouts" },
    { k: "finetune" as const, label: "Fine-tune", sub: "Advanced per-component tweaks" },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70 font-semibold">
            Setup · Dealer
          </div>
          <h1 className="text-2xl font-bold leading-tight mt-0.5">Appearance</h1>
          <div className="text-sm text-muted-foreground mt-1">
            Configure how{" "}
            <span className="font-semibold text-foreground">
              {config.dealership_name || "your dealership"}
            </span>{" "}
            looks to staff and customers.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-2 py-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1">
            <Crown className="w-3 h-3" /> Admin only
          </span>
        </div>
      </div>

      {/* Multi-location selector + Apply to all */}
      {locations.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Editing
            </span>
          </div>
          <Select
            value={selectedLocationId ?? "__tenant__"}
            onValueChange={(v) => setSelectedLocationId(v === "__tenant__" ? null : v)}
          >
            <SelectTrigger className="w-[300px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__tenant__">
                <span className="font-semibold">Tenant default</span>
                <span className="text-xs text-muted-foreground ml-1">— covers all locations that don&apos;t have their own override</span>
              </SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name || "Unnamed location"}
                  {loc.city ? ` — ${loc.city}${loc.state ? `, ${loc.state}` : ""}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground italic">
            {selectedLocationId == null
              ? "Changes apply to all locations that don't override."
              : "Changes apply only to this location."}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <AlertDialog open={applyToAllOpen} onOpenChange={setApplyToAllOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={saving || locations.length === 0}>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Apply to all locations
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apply to all {locations.length} locations?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Pushes the current settings to every location row under this tenant.
                    Each store will adopt these values as overrides — overwriting any
                    previously customized per-location settings. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApplyToAll} disabled={saving}>
                    {saving ? "Applying…" : "Apply to all"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.k ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {tab === t.k && (
              <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-foreground" />
            )}
          </button>
        ))}
      </div>
      <div className="text-xs text-muted-foreground/70 mb-4">
        {tabs.find((t) => t.k === tab)?.sub}
      </div>

      {/* THEME TAB */}
      {tab === "theme" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          <Card className="p-5 space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Brand colors
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-2 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="color"
                    value={draft.top_bar_bg}
                    onChange={(e) => set("top_bar_bg", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                  />
                  <div>
                    <div className="text-xs font-medium">Primary</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {draft.top_bar_bg}
                    </div>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-2 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="color"
                    value={draft.customer_file_accent}
                    onChange={(e) => set("customer_file_accent", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                  />
                  <div>
                    <div className="text-xs font-medium">Accent</div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {draft.customer_file_accent}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Choose a direction
                </div>
                <button
                  onClick={() => applyPreset({ bg: "#00407f", accent: "#005bb5" })}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset to default
                </button>
              </div>
              <div className="space-y-2">
                {PRESET_THEMES.map((p) => {
                  const active = draft.top_bar_bg.toLowerCase() === p.bg.toLowerCase();
                  return (
                    <button
                      key={p.name}
                      onClick={() => applyPreset(p)}
                      className={`w-full border rounded-lg p-3 text-left transition-colors flex items-center gap-3 ${
                        active ? "bg-muted/60 border-foreground" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex gap-0.5 shrink-0">
                        <div className="w-6 h-10 rounded-sm" style={{ background: p.bg }} />
                        <div className="w-6 h-10 rounded-sm" style={{ background: p.accent }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold">{p.name}</span>
                          {p.recommended && (
                            <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                              Rec
                            </span>
                          )}
                          {active && (
                            <span className="text-[9px] uppercase tracking-wider font-bold text-foreground bg-foreground/10 rounded px-1.5 py-0.5 ml-auto">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">{p.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom accent override card */}
            <div className="rounded-lg border border-dashed border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Custom accent</div>
              <p className="text-[11.5px] text-muted-foreground mt-1 mb-2">
                Override the selected theme&apos;s accent with your own brand color. Only applies if you've picked a theme that uses an accent.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.customer_file_accent}
                  onChange={(e) => set("customer_file_accent", e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent"
                />
                <div className="text-[11px] font-mono text-muted-foreground">{draft.customer_file_accent}</div>
                <button
                  onClick={() => {
                    const matching = PRESET_THEMES.find((t) => t.bg.toLowerCase() === draft.top_bar_bg.toLowerCase());
                    if (matching) set("customer_file_accent", matching.accent);
                  }}
                  className="ml-auto text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </Card>

          {/* Live preview */}
          <Card className="p-4 h-fit">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Live preview
            </div>
            <div className="rounded-md overflow-hidden border border-border">
              <div
                className="h-10 flex items-center px-2.5 gap-2"
                style={{ background: draft.top_bar_bg }}
              >
                <div
                  className="h-6 px-1.5 rounded bg-white/95 flex items-center text-[11px] font-black"
                  style={{ color: draft.top_bar_bg }}
                >
                  Logo
                </div>
                <span className="text-[10px] text-white/90 font-semibold">
                  Good afternoon, Marcus
                </span>
              </div>
              <div className="p-3 space-y-2 bg-muted">
                <div className="h-2 w-20 rounded bg-muted-foreground/20" />
                <div
                  className="h-8 rounded"
                  style={{ background: draft.customer_file_accent, opacity: 0.15 }}
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Applied everywhere: admin, customer file, staff tools.
            </div>
          </Card>
        </div>
      )}

      {/* LAYOUT TAB */}
      {tab === "layout" && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Top bar style
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TOP_BAR_STYLES.map((o) => {
                const previewBg =
                  o.k === "gradient"
                    ? `linear-gradient(90deg, ${draft.top_bar_bg}, ${draft.top_bar_bg_2})`
                    : o.k === "gradient-diagonal"
                      ? `linear-gradient(135deg, ${draft.top_bar_bg}, ${draft.top_bar_bg_2})`
                      : o.k === "gradient-3stop"
                        ? `linear-gradient(to right, ${draft.top_bar_bg} 0%, ${draft.top_bar_bg}cc 50%, ${draft.top_bar_bg}99 100%), ${draft.top_bar_bg_2}`
                        : draft.top_bar_bg;
                return (
                  <button
                    key={o.k}
                    onClick={() => handleStyleChange(o.k)}
                    className={`border rounded-md px-3 py-3 text-xs text-left transition-colors ${
                      draft.top_bar_style === o.k
                        ? "bg-muted font-semibold border-foreground"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="h-6 rounded mb-2" style={{ background: previewBg }} />
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-[11px] text-muted-foreground flex items-center gap-2">
                <span className="w-24">
                  {draft.top_bar_style === "solid" ? "Background" : "Start color"}
                </span>
                <input
                  type="color"
                  value={draft.top_bar_bg}
                  onChange={(e) => set("top_bar_bg", e.target.value)}
                  className="w-10 h-8 rounded border border-border bg-transparent"
                />
                <span className="font-mono text-[11px]">{draft.top_bar_bg}</span>
              </label>
              {draft.top_bar_style !== "solid" && (
                <label className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="w-24">End color</span>
                  <input
                    type="color"
                    value={draft.top_bar_bg_2}
                    onChange={(e) => set("top_bar_bg_2", e.target.value)}
                    className="w-10 h-8 rounded border border-border bg-transparent"
                  />
                  <span className="font-mono text-[11px]">{draft.top_bar_bg_2}</span>
                </label>
              )}
              <label className="text-[11px] text-muted-foreground flex items-center gap-2">
                <span className="w-24">Text color</span>
                <input
                  type="color"
                  value={draft.top_bar_text}
                  onChange={(e) => set("top_bar_text", e.target.value)}
                  className="w-10 h-8 rounded border border-border bg-transparent"
                />
                <span className="font-mono text-[11px]">{draft.top_bar_text}</span>
              </label>
            </div>
          </Card>

          {/* UI scale */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  UI scale
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Scale all text & controls proportionally. Baseline is 100%.
                </div>
              </div>
              <span className="text-sm font-mono text-muted-foreground">{draft.ui_scale}%</span>
            </div>
            <Slider
              min={85}
              max={125}
              step={1}
              value={[draft.ui_scale]}
              onValueChange={([v]) => set("ui_scale", v)}
            />
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => set("ui_scale", 100)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
              >
                Reset to 100%
              </button>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {[90, 100, 110, 120].map((v) => (
                  <button
                    key={v}
                    onClick={() => set("ui_scale", v)}
                    className="px-1.5 py-0.5 border border-border rounded hover:bg-muted/50"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Text scale */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Text size
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Scale text only — layout & icons stay the same.
                </div>
              </div>
              <span className="text-sm font-mono text-muted-foreground">{draft.text_scale}%</span>
            </div>
            <Slider
              min={85}
              max={140}
              step={1}
              value={[draft.text_scale]}
              onValueChange={([v]) => set("text_scale", v)}
            />
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => set("text_scale", 100)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
              >
                Reset to 100%
              </button>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {[90, 100, 115, 130].map((v) => (
                  <button
                    key={v}
                    onClick={() => set("text_scale", v)}
                    className="px-1.5 py-0.5 border border-border rounded hover:bg-muted/50"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Top bar height */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Top bar height
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {draft.top_bar_height}px
              </span>
            </div>
            <Slider
              min={40}
              max={135}
              step={1}
              value={[draft.top_bar_height]}
              onValueChange={([v]) => set("top_bar_height", v)}
            />
          </Card>

          {/* File layout */}
          <Card className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Customer file layout
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FILE_LAYOUTS.map((o) => (
                <button
                  key={o.k}
                  onClick={() => set("file_layout", o.k)}
                  className={`border rounded-md px-3 py-3 text-left transition-colors ${
                    draft.file_layout === o.k
                      ? "bg-muted font-semibold border-foreground"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="text-sm">{o.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{o.sub}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Header Layout Options visualizer + picker (Classic only) */}
          <Card className="p-5">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Customer file header layout
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                Classic only — Conversation-first uses its own header
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Three arrangements of the blue identity bar. Same data, same width, different hierarchy.
            </p>

            <div className="space-y-3">
              {[
                {
                  k: "a" as const,
                  label: "Vehicle-first",
                  sub: "Big YEAR · MAKE · MODEL dominates. Customer name isn't in the header at all.",
                  best: "Appraisal-only workflow",
                },
                {
                  k: "b" as const,
                  label: "Customer-first, vehicle-right",
                  sub: "Three-column identity: person on the left, vehicle in the middle, money on the right. Mirrors how every CRM anchors a record.",
                  best: "Mixed CRM + appraisal (recommended)",
                  recommended: true,
                },
                {
                  k: "c" as const,
                  label: "Stacked, full hierarchy",
                  sub: "Person on top, divider, vehicle below. Cleanest reading order; costs ~60px more vertical space.",
                  best: "Long-form documents, print",
                },
              ].map((opt) => {
                const active = draft.customer_file_header_layout === opt.k;
                return (
                  <button
                    key={opt.k}
                    onClick={() => set("customer_file_header_layout", opt.k)}
                    className={`w-full text-left border rounded-md px-4 py-3 transition-colors ${
                      active ? "bg-muted/60 border-foreground" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm">{opt.label}</span>
                        {opt.recommended && (
                          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                            Recommended
                          </span>
                        )}
                      </div>
                      {active && (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-foreground bg-foreground/10 rounded px-2 py-0.5">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{opt.sub}</p>
                    <div className="text-[11px] text-muted-foreground/80 mt-1">
                      Best when: <span className="text-foreground/80">{opt.best}</span>
                    </div>

                    {/* Mini visual mock */}
                    <div className="mt-3 rounded-md p-3 text-white text-[10px]" style={{
                      background: `linear-gradient(to right, ${draft.top_bar_bg}, ${draft.top_bar_bg_2 || draft.top_bar_bg})`,
                    }}>
                      {opt.k === "a" && (
                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[8px] uppercase tracking-wider text-white/55 font-bold">2021 · 42,000 mi</div>
                            <div className="text-[16px] font-bold leading-none mt-0.5 truncate">Ford F-150</div>
                            <div className="text-[9px] text-white/80 mt-1">1FTFW1E50MFA12345 · ABC-123 · Oxford White</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[8px] uppercase tracking-wider text-white/55 font-bold">Offer Given</div>
                            <div className="text-[18px] font-bold leading-none mt-0.5">$42,500</div>
                          </div>
                        </div>
                      )}
                      {opt.k === "b" && (
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-4 min-w-0">
                            <div className="text-[8px] uppercase tracking-wider text-white/55 font-bold">Customer</div>
                            <div className="text-[14px] font-bold leading-none mt-0.5 truncate">John Smith</div>
                            <div className="text-[9px] text-white/80 mt-1">(555) 123-4567</div>
                          </div>
                          <div className="col-span-5 min-w-0">
                            <div className="text-[8px] uppercase tracking-wider text-white/55 font-bold">Vehicle</div>
                            <div className="text-[14px] font-bold leading-none mt-0.5 truncate">2021 Ford F-150 XLT</div>
                            <div className="text-[9px] text-white/80 mt-1">42,000 mi · Oxford White</div>
                          </div>
                          <div className="col-span-3 text-right">
                            <div className="text-[8px] uppercase tracking-wider text-white/55 font-bold">Offer Given</div>
                            <div className="text-[15px] font-bold leading-none mt-0.5">$42,500</div>
                          </div>
                        </div>
                      )}
                      {opt.k === "c" && (
                        <>
                          <div className="flex items-end justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[8px] uppercase tracking-wider text-white/55 font-bold">Customer</div>
                              <div className="text-[14px] font-bold leading-none mt-0.5 truncate">John Smith</div>
                              <div className="text-[9px] text-white/80 mt-1">(555) 123-4567 · john.smith@email.com</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[8px] uppercase tracking-wider text-white/55 font-bold">Offer</div>
                              <div className="text-[15px] font-bold leading-none mt-0.5">$42,500</div>
                            </div>
                          </div>
                          <div className="h-px bg-white/15 my-2" />
                          <div>
                            <div className="text-[8px] uppercase tracking-wider text-white/55 font-bold">Vehicle</div>
                            <div className="text-[12px] font-bold leading-none mt-0.5">2021 Ford F-150 XLT</div>
                            <div className="text-[9px] text-white/80 mt-1">42,000 mi · ABC-123 · Oxford White</div>
                          </div>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick compare table */}
            <div className="mt-5 rounded-md border border-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Quick compare
              </div>
              <div className="grid grid-cols-4 text-[11.5px] divide-x divide-border">
                <div className="px-3 py-2 font-semibold text-muted-foreground">Trait</div>
                <div className={`px-3 py-2 font-semibold ${draft.customer_file_header_layout === "a" ? "bg-muted" : ""}`}>A — Vehicle-first</div>
                <div className={`px-3 py-2 font-semibold ${draft.customer_file_header_layout === "b" ? "bg-muted" : ""}`}>B — Customer-first</div>
                <div className={`px-3 py-2 font-semibold ${draft.customer_file_header_layout === "c" ? "bg-muted" : ""}`}>C — Stacked</div>

                {[
                  { trait: "Customer name", a: "Not visible", b: "Left column, 30px serif", c: "Top row, 32px serif" },
                  { trait: "Phone number", a: "Not visible", b: "Always visible + click-to-call", c: "Visible inline" },
                  { trait: "Vehicle prominence", a: "Hero (34px)", b: "Co-hero (30px)", c: "Secondary (24px)" },
                  { trait: "Header height", a: "~170 px", b: "~180 px", c: "~230 px" },
                  { trait: "Best when", a: "Appraisal-only workflow", b: "Mixed CRM + appraisal (you)", c: "Long-form documents, print" },
                ].map((row) => (
                  <>
                    <div className="px-3 py-2 border-t border-border text-muted-foreground">{row.trait}</div>
                    <div className={`px-3 py-2 border-t border-border ${draft.customer_file_header_layout === "a" ? "bg-muted" : ""}`}>{row.a}</div>
                    <div className={`px-3 py-2 border-t border-border ${draft.customer_file_header_layout === "b" ? "bg-muted" : ""}`}>{row.b}</div>
                    <div className={`px-3 py-2 border-t border-border ${draft.customer_file_header_layout === "c" ? "bg-muted" : ""}`}>{row.c}</div>
                  </>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* FINE-TUNE TAB */}
      {tab === "finetune" && (
        <Card className="p-5 space-y-4">
          <div className="text-sm text-muted-foreground">
            Advanced per-component tweaks. These mirror the floating Tweaks panel for a dedicated
            full-page editing flow.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 border border-border rounded-md">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Top bar shimmer
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.top_bar_shimmer}
                  onChange={(e) => set("top_bar_shimmer", e.target.checked)}
                />
                <span className="font-semibold">{draft.top_bar_shimmer ? "On" : "Off"}</span>
              </label>
            </div>
            <div className="p-3 border border-border rounded-md">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Shimmer style
              </div>
              <select
                value={draft.top_bar_shimmer_style}
                onChange={(e) => set("top_bar_shimmer_style", e.target.value)}
                className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
                disabled={!draft.top_bar_shimmer}
              >
                <option value="sheen">Sheen (subtle)</option>
                <option value="hartecash">Hartecash (bold)</option>
              </select>
            </div>
            <div className="p-3 border border-border rounded-md">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Shimmer speed
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  min={1}
                  max={10}
                  step={0.1}
                  value={[draft.top_bar_shimmer_speed]}
                  onValueChange={([v]) => set("top_bar_shimmer_speed", v)}
                  disabled={!draft.top_bar_shimmer}
                />
                <span className="text-[11px] font-mono w-10 text-right">
                  {draft.top_bar_shimmer_speed.toFixed(1)}s
                </span>
              </div>
            </div>
            <div className="p-3 border border-border rounded-md">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Customer file accent 2
              </div>
              <input
                type="color"
                value={draft.customer_file_accent_2}
                onChange={(e) => set("customer_file_accent_2", e.target.value)}
                className="w-10 h-8 rounded border border-border bg-transparent"
              />
            </div>
          </div>
        </Card>
      )}

      <div className="mt-5 flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          Tenant: <span className="font-mono">{(config as any).dealership_id || "default"}</span>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
};

export default AppearanceSettings;
