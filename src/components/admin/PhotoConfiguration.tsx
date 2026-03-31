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
const OVERLAY_COLOR = "#00FF88";

const PhotoConfiguration = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [rows, setRows] = useState<PhotoConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewShot, setPreviewShot] = useState<string | null>(null);
  const [previewArchetype, setPreviewArchetype] = useState<VehicleArchetype>("sedan");

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Photo Requirements
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which photos customers must take. GhostCar overlays adapt to the vehicle body style automatically.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </Button>
      </div>

      <div className="flex gap-3 items-center text-sm">
        <Badge variant="secondary">{enabledCount} shots enabled</Badge>
        <Badge variant="outline" className="border-success/40 text-success">{requiredCount} required</Badge>
        <Badge variant="outline">{enabledCount - requiredCount} optional</Badge>
      </div>

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
                color={OVERLAY_COLOR}
                width={480}
                height={270}
              />
              {/* Corner brackets */}
              {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([r, b], i) => (
                <div key={i} className="absolute w-5 h-5" style={{
                  [r ? "right" : "left"]: 8,
                  [b ? "bottom" : "top"]: 8,
                  borderColor: OVERLAY_COLOR,
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

      {/* Shot rows */}
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <Card key={row.id} className={`transition-all ${!row.is_enabled ? "opacity-50" : ""}`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />

                {/* Enable toggle */}
                <Switch
                  checked={row.is_enabled}
                  onCheckedChange={(v) => updateRow(idx, { is_enabled: v, is_required: v ? row.is_required : false })}
                />

                {/* Shot info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Input
                      value={row.label}
                      onChange={(e) => updateRow(idx, { label: e.target.value })}
                      className="h-7 text-sm font-semibold w-48"
                    />
                    {row.is_enabled && row.is_required && (
                      <Badge className="bg-success/10 text-success border-success/30 text-[10px]">Required</Badge>
                    )}
                    {row.is_enabled && !row.is_required && (
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

                {/* Required toggle */}
                {row.is_enabled && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Required</span>
                    <Switch
                      checked={row.is_required}
                      onCheckedChange={(v) => updateRow(idx, { is_required: v })}
                    />
                  </div>
                )}

                {/* Preview button */}
                <button
                  onClick={() => setPreviewShot(previewShot === row.shot_id ? null : row.shot_id)}
                  className={`p-1.5 rounded transition-colors ${previewShot === row.shot_id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  title="Preview overlay"
                >
                  {previewShot === row.shot_id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PhotoConfiguration;
