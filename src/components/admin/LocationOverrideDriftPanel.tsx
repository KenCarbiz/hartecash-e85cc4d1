import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Undo2, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

// The list of override-able appearance fields. Mirrors the
// LOCATION_OVERRIDE_KEYS subset that AppearanceSettings actually edits.
// Kept here as a single source of truth; the order is the order shown
// in the panel.
const APPEARANCE_OVERRIDE_FIELDS: { key: string; label: string }[] = [
  { key: "top_bar_style", label: "Top-bar style" },
  { key: "top_bar_bg", label: "Top-bar background" },
  { key: "top_bar_bg_2", label: "Top-bar gradient stop" },
  { key: "top_bar_text", label: "Top-bar text" },
  { key: "top_bar_height", label: "Top-bar height" },
  { key: "top_bar_shimmer", label: "Top-bar shimmer" },
  { key: "top_bar_shimmer_style", label: "Shimmer style" },
  { key: "top_bar_shimmer_speed", label: "Shimmer speed" },
  { key: "ui_scale", label: "UI scale" },
  { key: "text_scale", label: "Text scale" },
  { key: "file_layout", label: "Customer-file layout" },
  { key: "customer_file_header_layout", label: "Customer-file header" },
  { key: "customer_file_accent", label: "Customer-file accent" },
  { key: "customer_file_accent_2", label: "Customer-file accent 2" },
  { key: "sidebar_active_color", label: "Sidebar active color" },
];

interface Props {
  /** When null, panel renders nothing (corporate-default mode). */
  locationId: string | null;
  /** Locations available — used for friendly display. */
  locationName?: string;
  /** Fired after a successful reset so the parent can re-load draft state. */
  onChange: () => void;
}

/**
 * Diff & reset panel for per-location appearance overrides.
 *
 * The audit (May 2026) flagged: "AppearanceSettings per-location
 * override UX has no diff/reset surface. A 30-rooftop CFO can't tell
 * which fields a rooftop has drifted on, or revert to corporate."
 *
 * This panel reads the raw dealership_locations row (no merge with
 * corporate fallback) and lists every field that is currently
 * overridden — the fields where the location row has a non-NULL
 * value, taking the location's own setting instead of inheriting
 * from corporate site_config. Each override gets a Reset button;
 * a Reset All button clears every override in one click.
 *
 * Resetting a field = UPDATE dealership_locations SET <field> = NULL.
 */
const LocationOverrideDriftPanel = ({ locationId, locationName, onChange }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) {
      setOverrides({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const cols = APPEARANCE_OVERRIDE_FIELDS.map((f) => f.key).join(", ");
    (async () => {
      const { data, error } = await (supabase as any)
        .from("dealership_locations")
        .select(cols)
        .eq("id", locationId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast({
          title: "Couldn't load overrides",
          description: error.message,
          variant: "destructive",
        });
        setOverrides({});
      } else if (data) {
        // Only keep keys whose value is non-null AND non-empty-string.
        const filtered: Record<string, unknown> = {};
        for (const f of APPEARANCE_OVERRIDE_FIELDS) {
          const v = (data as any)[f.key];
          if (v !== null && v !== undefined && v !== "") {
            filtered[f.key] = v;
          }
        }
        setOverrides(filtered);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId, toast]);

  if (!locationId) return null;
  const overrideCount = Object.keys(overrides).length;

  const resetField = async (key: string) => {
    if (!locationId) return;
    setResetting(key);
    try {
      const { error } = await (supabase as any)
        .from("dealership_locations")
        .update({ [key]: null })
        .eq("id", locationId);
      if (error) throw error;
      const next = { ...overrides };
      delete next[key];
      setOverrides(next);
      onChange();
      toast({
        title: "Reset to corporate",
        description: `${APPEARANCE_OVERRIDE_FIELDS.find((f) => f.key === key)?.label ?? key} now inherits from corporate.`,
      });
    } catch (e) {
      toast({
        title: "Reset failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setResetting(null);
    }
  };

  const resetAll = async () => {
    if (!locationId) return;
    if (overrideCount === 0) return;
    if (
      !confirm(
        `Reset all ${overrideCount} appearance overrides for ${locationName ?? "this location"} back to corporate? This can't be undone.`,
      )
    ) {
      return;
    }
    setResetting("__all");
    try {
      const updates: Record<string, null> = {};
      for (const k of Object.keys(overrides)) updates[k] = null;
      const { error } = await (supabase as any)
        .from("dealership_locations")
        .update(updates)
        .eq("id", locationId);
      if (error) throw error;
      setOverrides({});
      onChange();
      toast({
        title: `${overrideCount} overrides cleared`,
        description: `${locationName ?? "Location"} now fully inherits corporate appearance.`,
      });
    } catch (e) {
      toast({
        title: "Reset all failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setResetting(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 mt-3 mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-sm font-medium text-card-foreground"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          Drift from corporate
          {!loading && (
            <Badge
              variant={overrideCount > 0 ? "secondary" : "outline"}
              className="ml-1 text-[10px]"
            >
              {overrideCount === 0
                ? "fully inherited"
                : `${overrideCount} override${overrideCount === 1 ? "" : "s"}`}
            </Badge>
          )}
        </span>
        {overrideCount > 0 && open && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              resetAll();
            }}
            disabled={resetting === "__all"}
            className="h-7 text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Reset all
          </Button>
        )}
      </button>

      {open && !loading && overrideCount === 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {locationName ?? "This location"} inherits every appearance setting from corporate. Edit any field above to start overriding.
        </p>
      )}

      {open && overrideCount > 0 && (
        <ul className="mt-3 divide-y divide-border/50">
          {APPEARANCE_OVERRIDE_FIELDS.filter((f) => f.key in overrides).map((f) => (
            <li key={f.key} className="flex items-center justify-between py-2 gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-card-foreground">{f.label}</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {String(overrides[f.key])}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => resetField(f.key)}
                disabled={resetting === f.key}
                className="h-7 text-xs"
              >
                <Undo2 className="w-3 h-3 mr-1.5" />
                {resetting === f.key ? "Resetting…" : "Reset"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationOverrideDriftPanel;
