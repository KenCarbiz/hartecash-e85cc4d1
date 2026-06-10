import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Camera, Loader2, Eye, EyeOff, Sparkles } from "lucide-react";
import GhostCarSilhouette from "@/components/upload/GhostCarSilhouette";
import type { VehicleArchetype } from "@/lib/vehicleArchetypes";

type PreAppointmentRole = "off" | "optional" | "required";
type BoostRole = "off" | "bonus" | "required";

interface PhotoConfigRow {
  id: string;
  dealership_id: string;
  shot_id: string;
  label: string;
  description: string;
  orientation: string;
  is_enabled: boolean;
  is_required: boolean;
  pre_appointment_role: PreAppointmentRole;
  boost_role: BoostRole;
  sort_order: number;
}

const OVERLAY_COLOR_OPTIONS = [
  { value: "#00FF88", label: "Green" },
  { value: "#FF3B3B", label: "Red" },
  { value: "#FFFFFF", label: "White" },
];

const PRE_OPTIONS: Array<{ value: PreAppointmentRole; label: string }> = [
  { value: "off",      label: "Off" },
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
];
const BOOST_OPTIONS: Array<{ value: BoostRole; label: string }> = [
  { value: "off",      label: "Off" },
  { value: "bonus",    label: "Bonus" },
  { value: "required", label: "Required" },
];

const HELPER_PRE = "What the customer is asked to upload before their dealership appointment.";
const HELPER_BOOST = "What the customer is asked to capture during the AI photo re-review (Boost) — optional bonus shots earn upside-only signals.";

const PhotoConfiguration = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [rows, setRows] = useState<PhotoConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewShot, setPreviewShot] = useState<string | null>(null);
  const [previewArchetype, setPreviewArchetype] = useState<VehicleArchetype>("sedan");
  const [overlayColor, setOverlayColor] = useState("#00FF88");
  const [allowColorChange, setAllowColorChange] = useState(true);
  const [siteConfigId, setSiteConfigId] = useState<string | null>(null);

  const dealershipId = tenant.dealership_id;

  const fetchConfig = useCallback(async () => {
    let { data } = await supabase
      .from("photo_config")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("sort_order");

    // First-time tenant: clone defaults so the matrix isn't empty.
    if (!data || data.length === 0) {
      const { data: defaults } = await supabase
        .from("photo_config")
        .select("*")
        .eq("dealership_id", "default")
        .order("sort_order");

      if (defaults && defaults.length > 0) {
        const cloned = defaults.map((d) => ({
          dealership_id: dealershipId,
          shot_id: d.shot_id,
          label: d.label,
          description: d.description,
          orientation: d.orientation,
          is_enabled: d.is_enabled,
          is_required: d.is_required,
          pre_appointment_role: d.pre_appointment_role ?? (d.is_enabled === false ? "off" : d.is_required ? "required" : "optional"),
          boost_role: d.boost_role ?? "off",
          sort_order: d.sort_order,
        }));
        await supabase.from("photo_config").insert(cloned);
        const res = await supabase
          .from("photo_config")
          .select("*")
          .eq("dealership_id", dealershipId)
          .order("sort_order");
        data = res.data;
      }
    }

    if (data) {
      setRows(data.map((d) => ({
        id: d.id,
        dealership_id: d.dealership_id,
        shot_id: d.shot_id,
        label: d.label,
        description: d.description,
        orientation: d.orientation,
        is_enabled: d.is_enabled,
        is_required: d.is_required,
        // Soft-fall-back for instances that haven't applied
        // 20260507010000_unified_photo_roles.sql yet (per CLAUDE.md
        // migrations don't auto-apply on merge to main).
        pre_appointment_role: (d.pre_appointment_role as PreAppointmentRole | null)
          ?? (d.is_enabled === false ? "off" : d.is_required ? "required" : "optional"),
        boost_role: (d.boost_role as BoostRole | null) ?? "off",
        sort_order: d.sort_order,
      })));
    }

    const { data: siteData } = await supabase
      .from("site_config")
      .select("id, photo_overlay_color, photo_allow_color_change")
      .eq("dealership_id", dealershipId)
      .maybeSingle();
    if (siteData) {
      setSiteConfigId(siteData.id);
      setOverlayColor(siteData.photo_overlay_color || "#00FF88");
      setAllowColorChange(siteData.photo_allow_color_change ?? true);
    }

    setLoading(false);
  }, [dealershipId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateRow = (idx: number, patch: Partial<PhotoConfigRow>) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        // Keep legacy is_enabled / is_required in sync with the roles
        // so older readers (admin queries, edge functions that haven't
        // moved over yet) keep working until they migrate.
        const isEnabled = row.pre_appointment_role !== "off" || row.boost_role !== "off";
        const isRequired = row.pre_appointment_role === "required";
        await supabase.from("photo_config").update({
          label: row.label,
          description: row.description,
          is_enabled: isEnabled,
          is_required: isRequired,
          pre_appointment_role: row.pre_appointment_role,
          boost_role: row.boost_role,
          sort_order: row.sort_order,
        }).eq("id", row.id);
      }
      if (siteConfigId) {
        await supabase.from("site_config").update({
          photo_overlay_color: overlayColor,
          photo_allow_color_change: allowColorChange,
        }).eq("id", siteConfigId);
      }
      toast({ title: "Photo config saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
    setSaving(false);
  };

  const preActiveCount   = rows.filter((r) => r.pre_appointment_role !== "off").length;
  const preRequiredCount = rows.filter((r) => r.pre_appointment_role === "required").length;
  const boostActiveCount   = rows.filter((r) => r.boost_role !== "off").length;
  const boostRequiredCount = rows.filter((r) => r.boost_role === "required").length;
  const boostBonusCount    = rows.filter((r) => r.boost_role === "bonus").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-[#06194A] flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#6D28D9]" />
            Inspection photos
          </h2>
          <p className="text-sm text-[#53627A] mt-1 max-w-2xl">
            What we ask the customer to capture, and how each shot is used.
            Settings are unique to <strong className="text-[#06194A]">{tenant.display_name || "this rooftop"}</strong> — every dealership and group configures its own list, no global policy.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[#EEF0FF] text-[#6D28D9] px-2.5 py-1 text-[11px] font-semibold shrink-0">Dealer admin</span>
      </div>

      {/* Camera overlay — color + change-permission in one card */}
      <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A879C]">Camera overlay</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#06194A]">Default guide color</h3>
            <p className="text-xs text-[#7A879C] mt-0.5">
              The guide-line color customers see when the camera opens.{allowColorChange ? " They can still change it on their screen." : " Locked to this color."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {OVERLAY_COLOR_OPTIONS.map((opt) => {
                const isSelected = overlayColor === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setOverlayColor(opt.value)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all text-sm font-medium ${
                      isSelected
                        ? "border-[#6D28D9] bg-[#EEF0FF] text-[#06194A]"
                        : "border-[#E6EAF0] bg-white text-[#53627A] hover:border-[#6D28D9]/40"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full shrink-0 ${opt.value === "#FFFFFF" ? "border border-[#E6EAF0]" : ""}`}
                      style={{ background: opt.value }}
                    />
                    {opt.label}
                    {isSelected && (
                      <span className="rounded-full bg-white text-[#6D28D9] px-1.5 text-[10px] font-semibold border border-[#6D28D9]/20">default</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#E6EAF0] bg-[#F4F6FA] px-4 py-3 lg:w-72">
            <Switch checked={allowColorChange} onCheckedChange={setAllowColorChange} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#06194A]">Let customers change it</div>
              <div className="text-xs text-[#7A879C]">
                {allowColorChange ? "On — picker shown in viewfinder" : "Off — locked to default"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unified shot matrix — one row per shot, two role columns:
          Before appointment (Off / Optional / Required) and
          In boost flow    (Off / Bonus    / Required).
          A single shot can live in both columns at the same time
          (e.g. Front: Required before AND Required for boost). The
          overlay preview expands inline beneath the shot it belongs to. */}
      <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A879C]">Shot list</div>
            <p className="text-xs text-[#7A879C] mt-1 max-w-2xl">
              Each shot answers two questions: how it behaves <strong className="text-[#06194A]">before the appointment</strong> (in the customer's first upload) and how it behaves <strong className="text-[#06194A]">during AI photo re-review (Boost)</strong> if the dealer offers that path.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-[#EEF0FF] text-[#6D28D9] px-2.5 py-1 text-[11px] font-semibold">
              First upload — {preRequiredCount} required, {preActiveCount} shown
            </span>
            <span className="inline-flex items-center rounded-full bg-[#E6FAF7] text-[#0F766E] px-2.5 py-1 text-[11px] font-semibold">
              Boost — {boostRequiredCount} required + {boostBonusCount} bonus
            </span>
          </div>
        </div>

        {/* Column header strip */}
        <div className="hidden md:grid md:grid-cols-[1fr_minmax(220px,260px)_minmax(220px,260px)_36px] gap-3 px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9AA6BC]">
          <div>Shot</div>
          <div>Before appointment</div>
          <div className="text-[#0F766E]">In boost flow</div>
          <div />
        </div>

        <div className="mt-1 space-y-2">
          {rows.map((row, idx) => {
            const preDimmed   = row.pre_appointment_role === "off";
            const boostActive = row.boost_role !== "off";
            const isPreviewing = previewShot === row.shot_id;
            return (
              <div key={row.id} className="space-y-0">
                <div
                  className={`flex flex-col md:grid md:grid-cols-[1fr_minmax(220px,260px)_minmax(220px,260px)_36px] gap-3 py-2.5 px-3 rounded-xl border bg-white transition-colors ${
                    isPreviewing
                      ? "border-[#6D28D9]/40 bg-[#FAFAFF]"
                      : preDimmed && !boostActive
                        ? "border-[#E6EAF0] opacity-70"
                        : "border-[#E6EAF0]"
                  }`}
                >
                  {/* Shot identity column */}
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          value={row.label}
                          onChange={(e) => updateRow(idx, { label: e.target.value })}
                          className="h-7 text-sm font-semibold w-44 border-[#E6EAF0]"
                        />
                        {boostActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#E6FAF7] text-[#0F766E] border border-[#0F766E]/20 px-2 py-0.5 text-[10px] font-semibold">
                            <Sparkles className="w-3 h-3" />
                            {row.boost_role === "required" ? "Boost" : "Bonus"}
                          </span>
                        )}
                      </div>
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(idx, { description: e.target.value })}
                        className="h-6 text-xs text-[#7A879C] border-none p-0 mt-0.5"
                        placeholder="Instruction for customer..."
                      />
                    </div>
                  </div>

                  {/* Before-appointment role */}
                  <RoleSegmented<PreAppointmentRole>
                    value={row.pre_appointment_role}
                    options={PRE_OPTIONS}
                    onChange={(v) => updateRow(idx, { pre_appointment_role: v })}
                    accent="primary"
                    helper={HELPER_PRE}
                  />

                  {/* Boost-flow role */}
                  <RoleSegmented<BoostRole>
                    value={row.boost_role}
                    options={BOOST_OPTIONS}
                    onChange={(v) => updateRow(idx, { boost_role: v })}
                    accent="emerald"
                    helper={HELPER_BOOST}
                  />

                  <button
                    onClick={() => setPreviewShot(isPreviewing ? null : row.shot_id)}
                    className={`p-1.5 rounded-lg transition-colors self-start md:self-center ${
                      isPreviewing ? "bg-[#EEF0FF] text-[#6D28D9]" : "text-[#9AA6BC] hover:text-[#6D28D9]"
                    }`}
                    title="Preview overlay"
                  >
                    {isPreviewing ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Inline overlay preview — attached to this shot */}
                {isPreviewing && (
                  <div className="mt-1 rounded-xl border border-[#6D28D9]/30 bg-[#FAFAFF] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-[#06194A]">Overlay preview — {row.label}</span>
                      <div className="flex gap-1.5">
                        {(["sedan", "compact_suv", "truck", "van"] as VehicleArchetype[]).map((a) => (
                          <button key={a} onClick={() => setPreviewArchetype(a)}
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors ${previewArchetype === a ? "bg-[#6D28D9] text-white" : "bg-white border border-[#E6EAF0] text-[#53627A] hover:text-[#6D28D9]"}`}>
                            {a.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative w-full max-w-md mx-auto bg-black/90 rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                      <GhostCarSilhouette
                        archetype={previewArchetype}
                        shotId={row.shot_id}
                        color={overlayColor}
                        width={480}
                        height={270}
                      />
                      {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([r, b], i) => (
                        <div key={i} className="absolute w-5 h-5" style={{
                          [r ? "right" : "left"]: 8,
                          [b ? "bottom" : "top"]: 8,
                          borderColor: overlayColor,
                          borderWidth: 2,
                          [r ? "borderLeft" : "borderRight"]: "none",
                          [b ? "borderTop" : "borderBottom"]: "none",
                          opacity: 0.6,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => fetchConfig()}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#6D28D9] hover:bg-[#6D28D9]/90 text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save settings
        </Button>
      </div>
    </div>
  );
};

interface RoleSegmentedProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  accent: "primary" | "emerald";
  helper: string;
}

function RoleSegmented<T extends string>({ value, options, onChange, accent, helper }: RoleSegmentedProps<T>) {
  const selectedClass = accent === "emerald"
    ? "bg-[#0D9488] text-white border-[#0D9488]"
    : "bg-[#6D28D9] text-white border-[#6D28D9]";
  const groupBg = accent === "emerald" ? "bg-[#E6FAF7]" : "bg-[#F4F6FA]";
  return (
    <div className={`inline-flex p-0.5 rounded-lg border border-[#E6EAF0] ${groupBg} self-start`} title={helper}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
              selected
                ? selectedClass
                : "border-transparent text-[#7A879C] hover:text-[#06194A]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default PhotoConfiguration;
