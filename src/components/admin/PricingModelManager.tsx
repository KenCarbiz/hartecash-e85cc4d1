import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Save, Plus, Trash2, Copy, Star, Layers, Power, CalendarRange,
} from "lucide-react";
import type { OfferSettings } from "@/lib/offerCalculator";

// ── Types ──

interface PricingModel {
  id: string;
  dealership_id: string;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  priority: number;
  bb_value_basis: string;
  global_adjustment_pct: number;
  regional_adjustment_pct: number;
  condition_multipliers: Record<string, number>;
  deductions_config: Record<string, boolean>;
  deduction_amounts: Record<string, number>;
  recon_cost: number;
  offer_floor: number;
  offer_ceiling: number | null;
  age_tiers: any[];
  mileage_tiers: any[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const BB_VALUE_OPTIONS = [
  { value: "wholesale_xclean", label: "Wholesale – X-Clean" },
  { value: "wholesale_clean", label: "Wholesale – Clean" },
  { value: "wholesale_avg", label: "Wholesale – Avg" },
  { value: "wholesale_rough", label: "Wholesale – Rough" },
  { value: "tradein_clean", label: "Trade-In – Clean" },
  { value: "tradein_avg", label: "Trade-In – Avg" },
  { value: "tradein_rough", label: "Trade-In – Rough" },
  { value: "retail_xclean", label: "Retail – X-Clean" },
  { value: "retail_clean", label: "Retail – Clean" },
  { value: "retail_avg", label: "Retail – Avg" },
  { value: "retail_rough", label: "Retail – Rough" },
];

const DEFAULT_MODEL_SETTINGS = {
  bb_value_basis: "tradein_avg",
  global_adjustment_pct: 0,
  regional_adjustment_pct: 0,
  condition_multipliers: { excellent: 1.05, good: 1.0, fair: 0.90, rough: 0.78 },
  deductions_config: {
    accidents: true, exterior_damage: true, interior_damage: true,
    windshield_damage: true, engine_issues: true, mechanical_issues: true,
    tech_issues: true, not_drivable: true, smoked_in: true,
    tires_not_replaced: true, missing_keys: true,
  },
  deduction_amounts: {
    accidents_1: 800, accidents_2: 1800, accidents_3plus: 3000,
    exterior_damage_per_item: 300, interior_damage_per_item: 200,
    windshield_cracked: 400, windshield_chipped: 150,
    engine_issue_per_item: 500, mechanical_issue_per_item: 350, tech_issue_per_item: 150,
    not_drivable: 1500, smoked_in: 500, tires_not_replaced: 400,
    missing_keys_1: 200, missing_keys_0: 400,
  },
  recon_cost: 0,
  offer_floor: 500,
  offer_ceiling: null as number | null,
  age_tiers: [] as any[],
  mileage_tiers: [] as any[],
};

// ── Props ──
interface Props {
  onModelChange?: (settings: OfferSettings) => void;
  onRegisterSync?: (syncFn: (settings: OfferSettings) => void) => void;
  /** Expose save trigger so the workbench can call save */
  onRegisterSave?: (saveFn: () => Promise<void>) => void;
  /** Expose model name for workbench header */
  onModelNameChange?: (name: string, isNew: boolean) => void;
}

const PricingModelManager = ({ onModelChange, onRegisterSync, onRegisterSave, onModelNameChange }: Props) => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const [models, setModels] = useState<PricingModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [editModel, setEditModel] = useState<Partial<PricingModel> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsDesc, setSaveAsDesc] = useState("");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleModelId, setScheduleModelId] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");

  useEffect(() => { fetchModels(); }, []);

  const fetchModels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pricing_models" as any)
      .select("*")
      .eq("dealership_id", "default")
      .order("priority", { ascending: false });
    const parsed = ((data as any[]) || []).map((d: any) => ({
      ...d,
      condition_multipliers: d.condition_multipliers || DEFAULT_MODEL_SETTINGS.condition_multipliers,
      deductions_config: d.deductions_config || DEFAULT_MODEL_SETTINGS.deductions_config,
      deduction_amounts: d.deduction_amounts || DEFAULT_MODEL_SETTINGS.deduction_amounts,
      age_tiers: Array.isArray(d.age_tiers) ? d.age_tiers : [],
      mileage_tiers: Array.isArray(d.mileage_tiers) ? d.mileage_tiers : [],
    })) as PricingModel[];
    setModels(parsed);
    if (!selectedModelId && parsed.length > 0) {
      const def = parsed.find(m => m.is_default) || parsed[0];
      setSelectedModelId(def.id);
      setEditModel({ ...def });
    }
    setLoading(false);
  };

  // Convert edit model to OfferSettings
  const modelAsSettings: OfferSettings | null = useMemo(() => {
    if (!editModel) return null;
    return {
      bb_value_basis: editModel.bb_value_basis || "tradein_avg",
      global_adjustment_pct: editModel.global_adjustment_pct || 0,
      deductions_config: editModel.deductions_config as any || DEFAULT_MODEL_SETTINGS.deductions_config,
      deduction_amounts: editModel.deduction_amounts as any || DEFAULT_MODEL_SETTINGS.deduction_amounts,
      condition_multipliers: editModel.condition_multipliers as any || DEFAULT_MODEL_SETTINGS.condition_multipliers,
      recon_cost: editModel.recon_cost || 0,
      offer_floor: editModel.offer_floor || 500,
      offer_ceiling: editModel.offer_ceiling ?? null,
      age_tiers: editModel.age_tiers || [],
      mileage_tiers: editModel.mileage_tiers || [],
      regional_adjustment_pct: editModel.regional_adjustment_pct || 0,
    };
  }, [editModel]);

  // Notify parent of model changes
  useEffect(() => {
    if (modelAsSettings && onModelChange) {
      onModelChange(modelAsSettings);
    }
  }, [modelAsSettings]);

  // Notify parent of name changes
  useEffect(() => {
    if (editModel && onModelNameChange) {
      onModelNameChange(editModel.name || "Untitled", !selectedModelId);
    }
  }, [editModel?.name, selectedModelId]);

  // Register sync callback so workbench can push changes back
  useEffect(() => {
    if (onRegisterSync) {
      onRegisterSync((incoming: OfferSettings) => {
        setEditModel(prev => prev ? {
          ...prev,
          bb_value_basis: incoming.bb_value_basis,
          global_adjustment_pct: incoming.global_adjustment_pct,
          regional_adjustment_pct: incoming.regional_adjustment_pct,
          condition_multipliers: incoming.condition_multipliers as any,
          deductions_config: incoming.deductions_config as any,
          deduction_amounts: incoming.deduction_amounts as any,
          recon_cost: incoming.recon_cost,
          offer_floor: incoming.offer_floor,
          offer_ceiling: incoming.offer_ceiling,
          age_tiers: incoming.age_tiers as any,
          mileage_tiers: incoming.mileage_tiers as any,
        } : prev);
      });
    }
  }, [onRegisterSync]);

  // Register save callback so workbench can trigger save
  useEffect(() => {
    if (onRegisterSave) {
      onRegisterSave(handleSave);
    }
  }, [onRegisterSave, editModel, selectedModelId]);

  const selectModel = (id: string) => {
    const m = models.find(m => m.id === id);
    if (m) {
      setSelectedModelId(id);
      setEditModel({ ...m });
    }
  };

  const handleCreateNew = () => {
    setEditModel({ ...DEFAULT_MODEL_SETTINGS, dealership_id: "default", name: "New Model", description: "", is_default: false, is_active: false, schedule_start: null, schedule_end: null, priority: 0, created_by: null } as any);
    setSelectedModelId(null);
  };

  const handleSave = async () => {
    if (!editModel?.name?.trim()) {
      toast({ title: "Name required", description: "Give your pricing model a name before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      dealership_id: "default",
      name: editModel.name,
      description: editModel.description || "",
      is_default: editModel.is_default || false,
      is_active: editModel.is_active || false,
      schedule_start: editModel.schedule_start || null,
      schedule_end: editModel.schedule_end || null,
      priority: editModel.priority || 0,
      bb_value_basis: editModel.bb_value_basis || "tradein_avg",
      global_adjustment_pct: editModel.global_adjustment_pct || 0,
      regional_adjustment_pct: editModel.regional_adjustment_pct || 0,
      condition_multipliers: editModel.condition_multipliers as any,
      deductions_config: editModel.deductions_config as any,
      deduction_amounts: editModel.deduction_amounts as any,
      recon_cost: editModel.recon_cost || 0,
      offer_floor: editModel.offer_floor || 500,
      offer_ceiling: editModel.offer_ceiling ?? null,
      age_tiers: editModel.age_tiers as any || [],
      mileage_tiers: editModel.mileage_tiers as any || [],
      updated_at: new Date().toISOString(),
    };

    let error;
    if (selectedModelId) {
      ({ error } = await supabase.from("pricing_models" as any).update(payload as any).eq("id", selectedModelId));
    } else {
      const { data, error: e } = await supabase.from("pricing_models" as any).insert(payload as any).select().single();
      error = e;
      if (data) setSelectedModelId((data as any).id);
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✓ Model Saved", description: `"${editModel.name}" saved successfully.` });
      fetchModels();
    }
    setSaving(false);
  };

  const handleSaveAs = async () => {
    if (!saveAsName.trim() || !editModel) return;
    setSaving(true);
    const payload = {
      dealership_id: "default",
      name: saveAsName,
      description: saveAsDesc,
      is_default: false,
      is_active: false,
      priority: 0,
      bb_value_basis: editModel.bb_value_basis || "tradein_avg",
      global_adjustment_pct: editModel.global_adjustment_pct || 0,
      regional_adjustment_pct: editModel.regional_adjustment_pct || 0,
      condition_multipliers: editModel.condition_multipliers as any,
      deductions_config: editModel.deductions_config as any,
      deduction_amounts: editModel.deduction_amounts as any,
      recon_cost: editModel.recon_cost || 0,
      offer_floor: editModel.offer_floor || 500,
      offer_ceiling: editModel.offer_ceiling ?? null,
      age_tiers: editModel.age_tiers as any || [],
      mileage_tiers: editModel.mileage_tiers as any || [],
    };
    const { data, error } = await supabase.from("pricing_models" as any).insert(payload as any).select().single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Model created", description: `"${saveAsName}" saved.` });
      setSelectedModelId((data as any).id);
      setShowSaveAsDialog(false);
      setSaveAsName("");
      setSaveAsDesc("");
      fetchModels();
    }
    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from("pricing_models" as any).update({ is_default: false } as any).eq("dealership_id", "default");
    await supabase.from("pricing_models" as any).update({ is_default: true, is_active: true } as any).eq("id", id);
    toast({ title: "Default set" });
    fetchModels();
    if (editModel && selectedModelId === id) {
      setEditModel({ ...editModel, is_default: true, is_active: true });
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("pricing_models" as any).update({ is_active: !current } as any).eq("id", id);
    fetchModels();
    if (editModel && selectedModelId === id) {
      setEditModel({ ...editModel, is_active: !current });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this pricing model?")) return;
    await supabase.from("pricing_models" as any).delete().eq("id", id);
    if (selectedModelId === id) {
      setSelectedModelId(null);
      setEditModel(null);
    }
    toast({ title: "Model deleted" });
    fetchModels();
  };

  const handleSchedule = async () => {
    if (!scheduleModelId) return;
    await supabase.from("pricing_models" as any).update({
      schedule_start: scheduleStart || null,
      schedule_end: scheduleEnd || null,
      is_active: true,
    } as any).eq("id", scheduleModelId);
    toast({ title: "Schedule set" });
    setShowScheduleDialog(false);
    fetchModels();
  };

  const updateModelName = (name: string) => {
    if (editModel) setEditModel({ ...editModel, name });
  };

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading pricing models…</div>;

  const selectedModel = models.find(m => m.id === selectedModelId);
  const activeModels = models.filter(m => m.is_active);

  return (
    <div className="space-y-3">
      {/* ── Compact Model Selector Strip ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Layers className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-bold text-card-foreground uppercase tracking-wider">Model:</span>

        {/* Horizontal scrollable model chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {models.map(m => (
            <button
              key={m.id}
              onClick={() => selectModel(m.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                selectedModelId === m.id
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-card-foreground"
              }`}
            >
              {m.is_default && <Star className="w-3 h-3 fill-amber-500 text-amber-500" />}
              {m.is_active && !m.is_default && <Power className="w-3 h-3 text-green-500" />}
              {m.schedule_start && <CalendarRange className="w-3 h-3 text-primary" />}
              <span className="truncate max-w-[120px]">{m.name}</span>
            </button>
          ))}

          <button
            onClick={handleCreateNew}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:border-primary/30 hover:text-card-foreground transition-all"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>

        {activeModels.length > 0 && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {activeModels.length} active
          </Badge>
        )}
      </div>

      {/* ── Inline model name + actions bar ── */}
      {editModel && (
        <div className="flex items-center gap-2 flex-wrap bg-muted/30 rounded-lg px-3 py-2 border border-border">
          <Input
            value={editModel.name || ""}
            onChange={e => updateModelName(e.target.value)}
            className="h-8 text-sm font-semibold flex-1 min-w-[160px] max-w-[280px]"
            placeholder="Model name…"
          />
          <Input
            value={editModel.description || ""}
            onChange={e => setEditModel({ ...editModel, description: e.target.value })}
            className="h-8 text-xs flex-1 min-w-[120px] max-w-[240px]"
            placeholder="Description (optional)"
          />

          <div className="flex items-center gap-1 shrink-0">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground h-8 text-xs">
              <Save className="w-3.5 h-3.5" />
              {saving ? "…" : selectedModelId ? "Save" : "Create"}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => { setSaveAsName((editModel.name || "") + " (Copy)"); setShowSaveAsDialog(true); }}>
              <Copy className="w-3 h-3" /> As
            </Button>
            {selectedModelId && (
              <>
                <Button
                  variant={selectedModel?.is_default ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleSetDefault(selectedModelId)}
                  disabled={selectedModel?.is_default}
                >
                  <Star className={`w-3 h-3 ${selectedModel?.is_default ? "fill-amber-500 text-amber-500" : ""}`} />
                </Button>
                <Button
                  variant={selectedModel?.is_active ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleToggleActive(selectedModelId, !!selectedModel?.is_active)}
                >
                  <Power className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline" size="sm" className="h-8 text-xs gap-1"
                  onClick={() => {
                    setScheduleModelId(selectedModelId);
                    setScheduleStart(selectedModel?.schedule_start || "");
                    setScheduleEnd(selectedModel?.schedule_end || "");
                    setShowScheduleDialog(true);
                  }}
                >
                  <CalendarRange className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(selectedModelId)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Save As Dialog ── */}
      <Dialog open={showSaveAsDialog} onOpenChange={setShowSaveAsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Save As New Model</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Name</Label>
              <Input value={saveAsName} onChange={e => setSaveAsName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Input value={saveAsDesc} onChange={e => setSaveAsDesc(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveAs} disabled={saving || !saveAsName.trim()} className="gap-1.5">
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Create Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Dialog ── */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Schedule Model Activation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Start Date</Label>
              <Input type="date" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">End Date</Label>
              <Input type="date" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSchedule} className="gap-1.5">
              <CalendarRange className="w-4 h-4" /> Set Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingModelManager;
