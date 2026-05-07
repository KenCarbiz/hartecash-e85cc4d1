import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Camera, GripVertical, Loader2, Eye, EyeOff, Sparkles } from "lucide-react";
import GhostCarSilhouette from "@/components/upload/GhostCarSilhouette";
import type { VehicleArchetype } from "@/lib/vehicleArchetypes";
import { FileText, Layers } from "lucide-react";

type PreAppointmentRole = "off" | "optional" | "required";
type BoostRole = "off" | "bonus" | "required";
type DocumentRole = "off" | "optional" | "required" | "conditional";

interface DocumentConfigRow {
  id: string;
  dealership_id: string;
  doc_id: string;
  label: string;
  description: string;
  role: DocumentRole;
  conditional_on: string | null;
  ocr_pipeline: string | null;
  customer_visible: boolean;
  staff_only: boolean;
  sort_order: number;
}

const DOC_ROLE_OPTIONS: Array<{ value: DocumentRole; label: string }> = [
  { value: "off",         label: "Off" },
  { value: "optional",    label: "Optional" },
  { value: "required",    label: "Required" },
  { value: "conditional", label: "Conditional" },
];

const HELPER_DOC = "How this document is collected. Conditional rows are only required when the customer's loan status matches (e.g. payoff statement only required when there's a loan).";

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
  const [docRows, setDocRows] = useState<DocumentConfigRow[]>([]);

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

    // Load document_config — same clone-from-default-on-first-touch
    // pattern photo_config uses, so a brand-new tenant gets the seed
    // catalog they can customize from there.
    let { data: docData } = await supabase
      .from("document_config" as never)
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("sort_order");
    if (!docData || (docData as unknown[]).length === 0) {
      const { data: docDefaults } = await supabase
        .from("document_config" as never)
        .select("*")
        .eq("dealership_id", "default")
        .order("sort_order");
      if (docDefaults && (docDefaults as unknown[]).length > 0) {
        const cloned = (docDefaults as unknown as DocumentConfigRow[]).map((d) => ({
          dealership_id: dealershipId,
          doc_id: d.doc_id,
          label: d.label,
          description: d.description,
          role: d.role,
          conditional_on: d.conditional_on,
          ocr_pipeline: d.ocr_pipeline,
          customer_visible: d.customer_visible,
          staff_only: d.staff_only,
          sort_order: d.sort_order,
        }));
        await supabase.from("document_config" as never).insert(cloned as never);
        const res = await supabase
          .from("document_config" as never)
          .select("*")
          .eq("dealership_id", dealershipId)
          .order("sort_order");
        docData = res.data;
      }
    }
    if (docData) setDocRows(docData as unknown as DocumentConfigRow[]);

    setLoading(false);
  }, [dealershipId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateRow = (idx: number, patch: Partial<PhotoConfigRow>) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const updateDocRow = (idx: number, patch: Partial<DocumentConfigRow>) => {
    setDocRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
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
      for (const doc of docRows) {
        await supabase
          .from("document_config" as never)
          .update({
            label: doc.label,
            description: doc.description,
            role: doc.role,
            conditional_on: doc.conditional_on,
            customer_visible: doc.customer_visible,
            staff_only: doc.staff_only,
            sort_order: doc.sort_order,
          } as never)
          .eq("id", doc.id);
      }
      toast({ title: "Settings saved" });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Customer requirements
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            What we ask the customer to provide — photos and documents — and how each is used across the upload flow, the AI photo re-review (Boost), and the customer-file uploader staff use at the dealership.
            Settings are unique to <strong>{tenant.display_name || "this rooftop"}</strong> — every dealership and group configures its own list, no global policy.
          </p>
        </div>
        <Badge variant="secondary">Dealer admin</Badge>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Default overlay color</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sets the default guide line color customers see when they open the camera. {allowColorChange ? "They can still change it on their screen." : "Customers cannot change it."}
            </p>
          </div>
          <div className="flex gap-3">
            {OVERLAY_COLOR_OPTIONS.map((opt) => {
              const isSelected = overlayColor === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setOverlayColor(opt.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all text-sm font-medium ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full shrink-0 ${opt.value === "#FFFFFF" ? "border border-border" : ""}`}
                    style={{ background: opt.value }}
                  />
                  {opt.label}
                  {isSelected && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">default</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Allow customer to change color</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              If on, customers see the color picker dots in the viewfinder and can switch on their own.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={allowColorChange} onCheckedChange={setAllowColorChange} />
            <Label className="text-sm text-muted-foreground">
              {allowColorChange ? "On — customers can change it" : "Off — locked to default color"}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Unified shot matrix — one row per shot, two role columns:
          Before appointment (Off / Optional / Required) and
          In boost flow    (Off / Bonus    / Required).
          A single shot can live in both columns at the same time
          (e.g. Front: Required before AND Required for boost). */}
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Shot list</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Each shot answers two questions: how it behaves <strong>before the appointment</strong> (in the customer's first upload) and how it behaves <strong>during AI photo re-review (Boost)</strong> if the dealer offers that path.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px]">
                First upload — {preRequiredCount} required, {preActiveCount} shown
              </Badge>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700">
                Boost — {boostRequiredCount} required + {boostBonusCount} bonus
              </Badge>
            </div>
          </div>

          {/* Column header strip — two grouped columns, faint emerald
              wash behind the boost column to read at a glance. */}
          <div className="hidden md:grid md:grid-cols-[1fr_minmax(220px,260px)_minmax(220px,260px)_36px] gap-3 px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <div>Shot</div>
            <div>Before appointment</div>
            <div className="text-emerald-700">In boost flow</div>
            <div />
          </div>

          <div className="space-y-2">
            {rows.map((row, idx) => {
              const preDimmed   = row.pre_appointment_role === "off";
              const boostActive = row.boost_role !== "off";
              return (
                <div
                  key={row.id}
                  className={`flex flex-col md:grid md:grid-cols-[1fr_minmax(220px,260px)_minmax(220px,260px)_36px] gap-3 py-2.5 px-3 rounded-lg border bg-card transition-colors ${
                    preDimmed && !boostActive
                      ? "border-border opacity-70"
                      : "border-border"
                  }`}
                >
                  {/* Shot identity column */}
                  <div className="flex items-start gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          value={row.label}
                          onChange={(e) => updateRow(idx, { label: e.target.value })}
                          className="h-7 text-sm font-semibold w-44"
                        />
                        {boostActive && (
                          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] gap-1">
                            <Sparkles className="w-3 h-3" />
                            {row.boost_role === "required" ? "Boost" : "Bonus"}
                          </Badge>
                        )}
                      </div>
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(idx, { description: e.target.value })}
                        className="h-6 text-xs text-muted-foreground border-none p-0 mt-0.5"
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
                    onClick={() => setPreviewShot(previewShot === row.shot_id ? null : row.shot_id)}
                    className={`p-1.5 rounded transition-colors self-start md:self-center ${
                      previewShot === row.shot_id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Preview overlay"
                  >
                    {previewShot === row.shot_id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Documents ──────────────────────────────────────────────
          Same per-tenant story as Photos but with a simpler 4-state
          role (off / optional / required / conditional). No boost
          dimension because docs don't pass through AI re-review.
          'Conditional' is paired with conditional_on and resolves at
          runtime against the customer's loan_status. */}
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Documents
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Driver's license, title, registration, payoff statement. The customer portal renders only customer-visible docs; the dealer's customer-file uploader can attach the full list including staff-only items.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px]">
                Required — {docRows.filter((d) => d.role === "required" && d.customer_visible).length}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Conditional — {docRows.filter((d) => d.role === "conditional").length}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Staff-only — {docRows.filter((d) => d.staff_only).length}
              </Badge>
            </div>
          </div>

          <div className="hidden md:grid md:grid-cols-[1fr_minmax(240px,300px)_120px_36px] gap-3 px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <div>Document</div>
            <div>Role</div>
            <div>Visibility</div>
            <div />
          </div>

          <div className="space-y-2">
            {docRows.map((doc, idx) => {
              const isOff = doc.role === "off";
              const showCondPicker = doc.role === "conditional";
              return (
                <div
                  key={doc.id}
                  className={`flex flex-col md:grid md:grid-cols-[1fr_minmax(240px,300px)_120px_36px] gap-3 py-2.5 px-3 rounded-lg border bg-card transition-colors ${
                    isOff ? "border-border opacity-70" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          value={doc.label}
                          onChange={(e) => updateDocRow(idx, { label: e.target.value })}
                          className="h-7 text-sm font-semibold w-56"
                        />
                        {doc.ocr_pipeline && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700">
                            OCR auto-fill
                          </Badge>
                        )}
                      </div>
                      <Input
                        value={doc.description}
                        onChange={(e) => updateDocRow(idx, { description: e.target.value })}
                        className="h-6 text-xs text-muted-foreground border-none p-0 mt-0.5"
                        placeholder="Instruction for customer..."
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 self-start" title={HELPER_DOC}>
                    <RoleSegmented<DocumentRole>
                      value={doc.role}
                      options={DOC_ROLE_OPTIONS}
                      onChange={(v) => updateDocRow(idx, {
                        role: v,
                        // Default the condition to has_loan when first
                        // flipping to conditional, so the dealer doesn't
                        // see a half-configured row.
                        conditional_on: v === "conditional"
                          ? (doc.conditional_on || "has_loan")
                          : null,
                      })}
                      accent="primary"
                      helper={HELPER_DOC}
                    />
                    {showCondPicker && (
                      <select
                        value={doc.conditional_on || "has_loan"}
                        onChange={(e) => updateDocRow(idx, { conditional_on: e.target.value })}
                        className="h-7 text-xs rounded-md border border-border bg-background px-2 text-foreground"
                      >
                        <option value="has_loan">When customer has a loan</option>
                        <option value="has_lease">When customer has a lease</option>
                      </select>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 self-start text-xs">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={doc.customer_visible}
                        onChange={(e) => updateDocRow(idx, { customer_visible: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-border accent-primary"
                      />
                      <span className="text-muted-foreground">Customer-visible</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={doc.staff_only}
                        onChange={(e) => updateDocRow(idx, {
                          staff_only: e.target.checked,
                          // Staff-only and customer-visible are
                          // mutually exclusive in the UI to avoid the
                          // confusing "shown to both" state.
                          customer_visible: e.target.checked ? false : doc.customer_visible,
                        })}
                        className="w-3.5 h-3.5 rounded border-border accent-primary"
                      />
                      <span className="text-muted-foreground">Staff-only</span>
                    </label>
                  </div>

                  <div />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {previewShot && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Overlay Preview: {rows.find((r) => r.shot_id === previewShot)?.label}</span>
              <div className="flex gap-2">
                {(["sedan", "compact_suv", "truck", "van"] as VehicleArchetype[]).map((a) => (
                  <button key={a} onClick={() => setPreviewArchetype(a)}
                    className={`text-xs px-2 py-0.5 rounded ${previewArchetype === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {a.replace("_", " ")}
                  </button>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full max-w-md mx-auto bg-black/90 rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <GhostCarSilhouette
                archetype={previewArchetype}
                shotId={previewShot}
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
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => fetchConfig()}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
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
    ? "bg-emerald-500 text-white border-emerald-500"
    : "bg-primary text-primary-foreground border-primary";
  const groupBg = accent === "emerald" ? "bg-emerald-50/40" : "bg-muted/30";
  return (
    <div className={`inline-flex p-0.5 rounded-lg border border-border ${groupBg} self-start`} title={helper}>
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
                : "border-transparent text-muted-foreground hover:text-foreground"
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
