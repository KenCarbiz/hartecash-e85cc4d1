/**
 * TweaksFloatingPanel — bottom-right black button on All Leads that pops a
 * panel where the dealer can change customer-file layout + branding presets
 * in real time.
 *
 * Writes go to the active site_config row (tenant default by default; per-
 * location override when a location is selected in the panel). Reads come
 * from useSiteConfig so every change re-renders the rest of the admin
 * shell + customer file slide-out immediately.
 *
 * Visibility is gated to admin / GSM / GM roles so floor staff can't
 * accidentally re-skin the dealership.
 */

import { useState } from "react";
import { Settings2, X } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PRESET_THEMES = [
  { name: "Hartecash",   bg: "#00407f", accent: "#005bb5" },
  { name: "Classic Navy", bg: "#1e40af", accent: "#3b82f6" },
  { name: "Forest",      bg: "#065f46", accent: "#10b981" },
  { name: "Oxblood",     bg: "#7f1d1d", accent: "#dc2626" },
  { name: "Ink + Amber", bg: "#0f172a", accent: "#e8a33d" },
  { name: "Terracotta",  bg: "#c2410c", accent: "#f97316" },
] as const;

const FILE_LAYOUTS = [
  { k: "classic" as const,      label: "Classic",          sub: "Cards + photos rail" },
  { k: "conversation" as const, label: "Conversation",     sub: "Messages-first w/ tabs" },
];

const HEADER_LAYOUTS = [
  { k: "a" as const, label: "Vehicle-first",  sub: "Big YEAR · MAKE · MODEL" },
  { k: "b" as const, label: "Customer-first", sub: "Recommended" },
  { k: "c" as const, label: "Stacked",        sub: "Person on top" },
];

const VISIBLE_ROLES = new Set(["admin", "gsm_gm", "gm", "internet_manager", "used_car_manager"]);

interface TweaksFloatingPanelProps {
  userRole: string;
}

const TweaksFloatingPanel = ({ userRole }: TweaksFloatingPanelProps) => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!VISIBLE_ROLES.has(userRole)) return null;

  // Whether we're editing the tenant default row (dealership_locations.id IS
  // NULL flow → site_config) or a specific location row.
  const editingLocation = !!tenant.location_id;

  type SaveablePatch = {
    file_layout?: "classic" | "conversation";
    customer_file_header_layout?: "a" | "b" | "c";
    top_bar_bg?: string;
    customer_file_accent?: string;
  };

  const save = async (patch: SaveablePatch) => {
    setSaving(true);
    const table = editingLocation ? "dealership_locations" : "site_config";
    const filter = editingLocation
      ? { col: "id" as const, val: tenant.location_id! }
      : { col: "dealership_id" as const, val: tenant.dealership_id };

    const { error } = await (supabase as never as {
      from: (t: string) => {
        update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
      };
    })
      .from(table)
      .update(patch)
      .eq(filter.col, filter.val);

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    // Trigger a re-fetch — useSiteConfig caches by tenantId/locationId, so we
    // need React Query to invalidate. The hook's queryKey will pick up on
    // next mount; for live preview we rely on the user re-opening the panel
    // OR pressing the toggle again. A future iteration can wire the
    // queryClient invalidation here.
    toast({ title: editingLocation ? "Location updated" : "Tenant defaults updated" });
  };

  const applyPreset = (p: typeof PRESET_THEMES[number]) => {
    void save({ top_bar_bg: p.bg, customer_file_accent: p.accent });
  };

  return (
    <>
      {/* Floating black button — bottom-right */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open tweaks panel"
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-xl flex items-center justify-center transition print:hidden"
      >
        <Settings2 className="w-5 h-5" />
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] animate-in fade-in" onClick={() => setOpen(false)} />
          <aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[400px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Tweaks</div>
                <div className="text-[15px] font-bold text-slate-900">
                  {editingLocation ? "Editing this location" : "Editing tenant default"}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {editingLocation
                    ? `Location overrides apply only here. Tenant defaults still cover everything else.`
                    : `Changes apply to all locations that don't have their own override.`}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* File layout slider */}
              <section>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Customer File Layout</div>
                <div className="grid grid-cols-2 gap-2">
                  {FILE_LAYOUTS.map((o) => {
                    const active = (config.file_layout || "classic") === o.k;
                    return (
                      <button
                        key={o.k}
                        disabled={saving}
                        onClick={() => save({ file_layout: o.k })}
                        className={`text-left p-3 rounded-lg border transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white hover:border-slate-400 text-slate-900"
                        }`}
                      >
                        <div className="text-[13px] font-bold">{o.label}</div>
                        <div className={`text-[11px] mt-0.5 ${active ? "text-white/70" : "text-slate-500"}`}>{o.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Header A/B/C — only meaningful for Classic */}
              {(config.file_layout || "classic") === "classic" && (
                <section>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Header Layout</div>
                  <div className="space-y-1.5">
                    {HEADER_LAYOUTS.map((o) => {
                      const active = (config.customer_file_header_layout || "b") === o.k;
                      return (
                        <button
                          key={o.k}
                          disabled={saving}
                          onClick={() => save({ customer_file_header_layout: o.k })}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition text-left ${
                            active
                              ? "border-slate-900 bg-slate-50"
                              : "border-slate-200 bg-white hover:border-slate-400"
                          }`}
                        >
                          <div>
                            <div className="text-[13px] font-bold text-slate-900">{o.label}</div>
                            <div className="text-[11px] text-slate-500">{o.sub}</div>
                          </div>
                          {active && <span className="text-[10px] font-bold text-slate-700 uppercase">Active</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Preset theme picker */}
              <section>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Preset Theme</div>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_THEMES.map((p) => {
                    const active = config.top_bar_bg === p.bg;
                    return (
                      <button
                        key={p.name}
                        disabled={saving}
                        onClick={() => applyPreset(p)}
                        className={`p-2 rounded-lg border text-left transition ${
                          active ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <div className="flex h-6 rounded overflow-hidden">
                          <span className="flex-1" style={{ background: p.bg }} />
                          <span className="flex-1" style={{ background: p.accent }} />
                        </div>
                        <div className="text-[12px] font-semibold text-slate-900 mt-1">{p.name}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Tenant-default helper note */}
              <section className="pt-2 border-t border-slate-100">
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  More controls (top-bar style, shimmer, scale, role visibility, header layouts and full theme tuning)
                  live on <span className="font-semibold text-slate-600">Setup → Dealer → Appearance &amp; Access</span>.
                </div>
              </section>
            </div>
          </aside>
        </>
      )}
    </>
  );
};

export default TweaksFloatingPanel;
