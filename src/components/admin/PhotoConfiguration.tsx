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
import { Save, Camera, GripVertical, Loader2, Eye, EyeOff, Palette } from "lucide-react";
import GhostCarSilhouette from "@/components/upload/GhostCarSilhouette";
import type { VehicleArchetype } from "@/lib/vehicleArchetypes";

interface PhotoConfigRow {
  id: string;
  dealership_id: string;
  shot_id: string;
  label: string;
  description: string;
  orientation: string;
  is_enabled: boolean;
  is_required: boolean;
  sort_order: number;
}

const PREVIEW_ARCHETYPE: VehicleArchetype = "sedan";
const OVERLAY_COLOR_OPTIONS = [
  { value: "#00FF88", label: "Green" },
  { value: "#FF3B3B", label: "Red" },
  { value: "#FFFFFF", label: "White" },
];

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

    // If no tenant-specific config, clone from default
    if (!data || data.length === 0) {
      const { data: defaults } = await supabase
        .from("photo_config")
        .select("*")
        .eq("dealership_id", "default")
        .order("sort_order");

      if (defaults && defaults.length > 0) {
        const cloned = defaults.map(d => ({
          dealership_id: dealershipId,
          shot_id: d.shot_id,
          label: d.label,
          description: d.description,
          orientation: d.orientation,
          is_enabled: d.is_enabled,
          is_required: d.is_required,
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
      setRows(data.map(d => ({
        id: d.id,
        dealership_id: d.dealership_id,
        shot_id: d.shot_id,
        label: d.label,
        description: d.description,
        orientation: d.orientation,
        is_enabled: d.is_enabled,
        is_required: d.is_required,
        sort_order: d.sort_order,
      })));
    }

    // Fetch overlay color settings from site_config
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
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        await supabase.from("photo_config").update({
          label: row.label,
          description: row.description,
          is_enabled: row.is_enabled,
          is_required: row.is_required,
          sort_order: row.sort_order,
        }).eq("id", row.id);
      }
      // Save overlay color settings to site_config
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

  const enabledCount = rows.filter(r => r.is_enabled).length;
  const requiredCount = rows.filter(r => r.is_enabled && r.is_required).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Photo Upload — GhostCar Overlay Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            These settings control the <strong>camera overlay</strong> customers see when uploading vehicle photos — the transparent silhouette guide that helps them frame each shot.
            This does <em>not</em> affect the vehicle display image on the offer page (that's configured under Site Configuration → Vehicle Display Image).
          </p>
        </div>
        <Badge variant="secondary">Dealer admin</Badge>
      </div>

      {/* Default Overlay Color */}
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Default overlay color</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sets the default guide line color customers see when they open the camera. {allowColorChange ? "They can still change it on their screen." : "Customers cannot change it."}
            </p>
          </div>
          <div className="flex gap-3">
            {OVERLAY_COLOR_OPTIONS.map(opt => {
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

      {/* Allow customer to change color */}
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

      {/* Enabled photo shots */}
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Enabled photo shots</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toggle which shots are required for this rooftop. Unchecked shots are hidden from the customer flow.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {rows.map((row, idx) => (
              <label
                key={row.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                  row.is_enabled
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={row.is_enabled}
                  onChange={(e) => updateRow(idx, { is_enabled: e.target.checked, is_required: e.target.checked ? row.is_required : false })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30 accent-primary"
                />
                <span className={`text-sm ${row.is_enabled ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {row.label}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overlay preview */}
      {previewShot && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Overlay Preview: {rows.find(r => r.shot_id === previewShot)?.label}</span>
              <div className="flex gap-2">
                {(["sedan", "compact_suv", "truck", "van"] as VehicleArchetype[]).map(a => (
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

      {/* Shot detail rows (for label/description editing & required toggle) */}
      <Card>
        <CardContent className="pt-5 pb-3 px-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Shot details &amp; requirements</h3>
          <div className="space-y-1.5">
            {rows.filter(r => r.is_enabled).map((row, _i) => {
              const idx = rows.findIndex(r => r.id === row.id);
              return (
                <div key={row.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-card">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Input
                        value={row.label}
                        onChange={(e) => updateRow(idx, { label: e.target.value })}
                        className="h-7 text-sm font-semibold w-44"
                      />
                      {row.is_required ? (
                        <Badge className="bg-success/10 text-success border-success/30 text-[10px]">Required</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Optional</Badge>
                      )}
                    </div>
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(idx, { description: e.target.value })}
                      className="h-6 text-xs text-muted-foreground border-none p-0 mt-0.5"
                      placeholder="Instruction for customer..."
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Required</span>
                    <Switch
                      checked={row.is_required}
                      onCheckedChange={(v) => updateRow(idx, { is_required: v })}
                    />
                  </div>
                  <button
                    onClick={() => setPreviewShot(previewShot === row.shot_id ? null : row.shot_id)}
                    className={`p-1.5 rounded transition-colors ${previewShot === row.shot_id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
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

      {/* Footer actions */}
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

export default PhotoConfiguration;
