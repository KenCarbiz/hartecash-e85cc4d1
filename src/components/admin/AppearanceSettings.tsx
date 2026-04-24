import { useState } from "react";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { supabase } from "@/integrations/supabase/client";

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

const PRESET_THEMES = [
  { name: "Hartecash", bg: "#00407f", accent: "#005bb5" },
  { name: "Classic Blue", bg: "#1e40af", accent: "#3b82f6" },
  { name: "Forest", bg: "#065f46", accent: "#10b981" },
  { name: "Oxblood", bg: "#7f1d1d", accent: "#dc2626" },
  { name: "Ink", bg: "#0f172a", accent: "#334155" },
  { name: "Terracotta", bg: "#c2410c", accent: "#f97316" },
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

const AppearanceSettings = ({ userRole, canManageAccess }: AppearanceSettingsProps) => {
  const { config, refresh } = useSiteConfig();
  const { toast } = useToast();
  const [tab, setTab] = useState<"theme" | "layout" | "finetune">("theme");
  const [saving, setSaving] = useState(false);

  // Local draft mirrors site_config so live preview updates without round-trip
  const [draft, setDraft] = useState({
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
    customer_file_accent: (config as any).customer_file_accent || "#003b80",
    customer_file_accent_2: (config as any).customer_file_accent_2 || "#005bb5",
  });

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
      const { error } = await (supabase as any)
        .from("site_config")
        .update(draft)
        .eq("dealership_id", (config as any).dealership_id || "default");

      if (error) throw error;

      toast({ title: "Appearance saved", description: "Changes applied to this tenant." });
      await refresh();
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
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Preset themes
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_THEMES.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="border border-border rounded-lg p-2 hover:bg-muted/50 text-left transition-colors"
                  >
                    <div className="flex gap-0.5 mb-1.5">
                      <div className="h-6 flex-1 rounded-sm" style={{ background: p.bg }} />
                      <div className="h-6 flex-1 rounded-sm" style={{ background: p.accent }} />
                    </div>
                    <div className="text-[11px] font-medium">{p.name}</div>
                  </button>
                ))}
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
