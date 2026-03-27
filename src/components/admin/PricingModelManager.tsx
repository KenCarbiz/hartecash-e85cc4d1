import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Save, Plus, Trash2, Copy, Calendar, ChevronDown, Shield, Star,
  SlidersHorizontal, Gauge, Zap, AlertTriangle, DollarSign, Layers,
  Clock, Lock, CheckCircle2, CalendarRange, Power,
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
  condition_multipliers: ConditionMultipliers;
  deductions_config: DeductionsConfig;
  deduction_amounts: DeductionAmounts;
  recon_cost: number;
  offer_floor: number;
  offer_ceiling: number | null;
  age_tiers: AgeTier[];
  mileage_tiers: MileageTier[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface DeductionsConfig {
  accidents: boolean;
  exterior_damage: boolean;
  interior_damage: boolean;
  windshield_damage: boolean;
  engine_issues: boolean;
  mechanical_issues: boolean;
  tech_issues: boolean;
  not_drivable: boolean;
  smoked_in: boolean;
  tires_not_replaced: boolean;
  missing_keys: boolean;
}

interface DeductionAmounts {
  accidents_1: number;
  accidents_2: number;
  accidents_3plus: number;
  exterior_damage_per_item: number;
  interior_damage_per_item: number;
  windshield_cracked: number;
  windshield_chipped: number;
  engine_issue_per_item: number;
  mechanical_issue_per_item: number;
  tech_issue_per_item: number;
  not_drivable: number;
  smoked_in: number;
  tires_not_replaced: number;
  missing_keys_1: number;
  missing_keys_0: number;
}

interface ConditionMultipliers {
  excellent: number;
  good: number;
  fair: number;
  rough: number;
}

interface AgeTier {
  min_years: number;
  max_years: number;
  adjustment_pct: number;
}

interface MileageTier {
  min_miles: number;
  max_miles: number;
  adjustment_flat: number;
}

// ── Constants ──

const BB_VALUE_OPTIONS = [
  { value: "wholesale_xclean", label: "Wholesale – Extra Clean" },
  { value: "wholesale_clean", label: "Wholesale – Clean" },
  { value: "wholesale_avg", label: "Wholesale – Average" },
  { value: "wholesale_rough", label: "Wholesale – Rough" },
  { value: "tradein_clean", label: "Trade-In – Clean" },
  { value: "tradein_avg", label: "Trade-In – Average" },
  { value: "tradein_rough", label: "Trade-In – Rough" },
  { value: "retail_xclean", label: "Retail – Extra Clean" },
  { value: "retail_clean", label: "Retail – Clean" },
  { value: "retail_avg", label: "Retail – Average" },
  { value: "retail_rough", label: "Retail – Rough" },
];

const DEDUCTION_LABELS: Record<string, { label: string; amountKey: string | string[] }> = {
  accidents: { label: "Accidents", amountKey: ["accidents_1", "accidents_2", "accidents_3plus"] },
  exterior_damage: { label: "Exterior Damage", amountKey: "exterior_damage_per_item" },
  interior_damage: { label: "Interior Damage", amountKey: "interior_damage_per_item" },
  windshield_damage: { label: "Windshield Damage", amountKey: ["windshield_cracked", "windshield_chipped"] },
  engine_issues: { label: "Engine Issues", amountKey: "engine_issue_per_item" },
  mechanical_issues: { label: "Mechanical Issues", amountKey: "mechanical_issue_per_item" },
  tech_issues: { label: "Technology Issues", amountKey: "tech_issue_per_item" },
  not_drivable: { label: "Not Drivable", amountKey: "not_drivable" },
  smoked_in: { label: "Smoked In", amountKey: "smoked_in" },
  tires_not_replaced: { label: "Tires Not Replaced", amountKey: "tires_not_replaced" },
  missing_keys: { label: "Missing Keys", amountKey: ["missing_keys_1", "missing_keys_0"] },
};

const AMOUNT_LABELS: Record<string, string> = {
  accidents_1: "1 Accident", accidents_2: "2 Accidents", accidents_3plus: "3+",
  exterior_damage_per_item: "Per Item", interior_damage_per_item: "Per Item",
  windshield_cracked: "Cracked", windshield_chipped: "Chipped",
  engine_issue_per_item: "Per Issue", mechanical_issue_per_item: "Per Issue", tech_issue_per_item: "Per Issue",
  not_drivable: "Flat", smoked_in: "Flat", tires_not_replaced: "Flat",
  missing_keys_1: "1 Key", missing_keys_0: "0 Keys",
};

const DEFAULT_MODEL: Omit<PricingModel, "id" | "created_at" | "updated_at"> = {
  dealership_id: "default",
  name: "",
  description: "",
  is_default: false,
  is_active: false,
  schedule_start: null,
  schedule_end: null,
  priority: 0,
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
  offer_ceiling: null,
  age_tiers: [],
  mileage_tiers: [],
  created_by: null,
};

// ── Collapsible Section ──
const Section = ({
  icon, title, children, defaultOpen = false, headerRight,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
  defaultOpen?: boolean; headerRight?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              {icon}
              <span className="font-semibold text-sm text-card-foreground">{title}</span>
            </div>
            <div className="flex items-center gap-2">
              {headerRight}
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// ── Props ──
interface Props {
  /** Called when the active model changes so the simulator can recalculate */
  onModelChange?: (settings: OfferSettings) => void;
  /** Ref-style callback so parent can push workbench changes back into the edit model */
  onRegisterSync?: (syncFn: (settings: OfferSettings) => void) => void;
}

const PricingModelManager = ({ onModelChange }: Props) => {
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
      condition_multipliers: d.condition_multipliers || DEFAULT_MODEL.condition_multipliers,
      deductions_config: d.deductions_config || DEFAULT_MODEL.deductions_config,
      deduction_amounts: d.deduction_amounts || DEFAULT_MODEL.deduction_amounts,
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

  // Convert edit model to OfferSettings for simulator
  const modelAsSettings: OfferSettings | null = useMemo(() => {
    if (!editModel) return null;
    return {
      bb_value_basis: editModel.bb_value_basis || "tradein_avg",
      global_adjustment_pct: editModel.global_adjustment_pct || 0,
      deductions_config: editModel.deductions_config as any || DEFAULT_MODEL.deductions_config,
      deduction_amounts: editModel.deduction_amounts as any || DEFAULT_MODEL.deduction_amounts,
      condition_multipliers: editModel.condition_multipliers as any || DEFAULT_MODEL.condition_multipliers,
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

  const selectModel = (id: string) => {
    const m = models.find(m => m.id === id);
    if (m) {
      setSelectedModelId(id);
      setEditModel({ ...m });
    }
  };

  const handleCreateNew = () => {
    setEditModel({ ...DEFAULT_MODEL, name: "New Model" } as any);
    setSelectedModelId(null);
  };

  const handleSave = async () => {
    if (!editModel?.name?.trim()) {
      toast({ title: "Name required", variant: "destructive" });
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
      toast({ title: "Model saved", description: `"${editModel.name}" saved successfully.` });
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
    // Clear existing defaults
    await supabase.from("pricing_models" as any).update({ is_default: false } as any).eq("dealership_id", "default");
    await supabase.from("pricing_models" as any).update({ is_default: true, is_active: true } as any).eq("id", id);
    toast({ title: "Default set", description: "This model is now the default pricing model." });
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
    toast({ title: "Schedule set", description: "Model will auto-activate during the set date range." });
    setShowScheduleDialog(false);
    fetchModels();
  };

  // Update helpers
  const updateField = <K extends keyof PricingModel>(key: K, value: PricingModel[K]) => {
    if (!editModel) return;
    setEditModel({ ...editModel, [key]: value });
  };

  const toggleDeduction = (key: string) => {
    if (!editModel?.deductions_config) return;
    setEditModel({
      ...editModel,
      deductions_config: { ...editModel.deductions_config, [key]: !(editModel.deductions_config as any)[key] },
    });
  };

  const updateDeductionAmount = (key: string, value: number) => {
    if (!editModel?.deduction_amounts) return;
    setEditModel({
      ...editModel,
      deduction_amounts: { ...editModel.deduction_amounts as any, [key]: value },
    });
  };

  const updateConditionMultiplier = (key: string, value: number) => {
    if (!editModel?.condition_multipliers) return;
    setEditModel({
      ...editModel,
      condition_multipliers: { ...editModel.condition_multipliers as any, [key]: value },
    });
  };

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading pricing models…</div>;

  const selectedModel = models.find(m => m.id === selectedModelId);
  const activeModels = models.filter(m => m.is_active);

  return (
    <div className="space-y-4">
      {/* ── Model Selector Bar ── */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Pricing Models</h3>
          <Badge variant="secondary" className="text-xs">{models.length} model{models.length !== 1 ? "s" : ""}</Badge>
          {activeModels.length > 0 && (
            <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
              {activeModels.length} active (stacked)
            </Badge>
          )}
        </div>

        {/* Model cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
          {models.map(m => (
            <button
              key={m.id}
              onClick={() => selectModel(m.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                selectedModelId === m.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-card-foreground truncate">{m.name}</span>
                <div className="flex gap-1 shrink-0">
                  {m.is_default && (
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  )}
                  {m.is_active && (
                    <Power className="w-3.5 h-3.5 text-green-500" />
                  )}
                  {m.schedule_start && (
                    <CalendarRange className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{BB_VALUE_OPTIONS.find(o => o.value === m.bb_value_basis)?.label || m.bb_value_basis}</span>
                {m.global_adjustment_pct !== 0 && (
                  <span className={m.global_adjustment_pct > 0 ? "text-green-600" : "text-destructive"}>
                    {m.global_adjustment_pct > 0 ? "+" : ""}{m.global_adjustment_pct}%
                  </span>
                )}
              </div>
              {m.schedule_start && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  📅 {m.schedule_start} → {m.schedule_end || "∞"}
                </div>
              )}
            </button>
          ))}

          {/* New model button */}
          <button
            onClick={handleCreateNew}
            className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/30 hover:bg-muted/30 transition-all text-muted-foreground"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Model</span>
          </button>
        </div>
      </div>

      {/* ── Model Editor ── */}
      {editModel && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          {/* Name & meta */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs font-semibold">Model Name</Label>
              <Input
                value={editModel.name || ""}
                onChange={e => updateField("name", e.target.value)}
                className="h-9 font-semibold"
                placeholder="e.g. Winter Aggressive, Summer Standard"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-4">
              <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground">
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : selectedModelId ? "Save" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => { setSaveAsName(editModel.name + " (Copy)"); setShowSaveAsDialog(true); }} className="gap-1.5">
                <Copy className="w-4 h-4" /> Save As
              </Button>
              {selectedModelId && (
                <>
                  <Button
                    variant={selectedModel?.is_default ? "secondary" : "outline"}
                    onClick={() => handleSetDefault(selectedModelId)}
                    className="gap-1.5"
                    disabled={selectedModel?.is_default}
                  >
                    <Star className={`w-4 h-4 ${selectedModel?.is_default ? "fill-amber-500 text-amber-500" : ""}`} />
                    {selectedModel?.is_default ? "Default" : "Set Default"}
                  </Button>
                  <Button
                    variant={selectedModel?.is_active ? "default" : "outline"}
                    onClick={() => handleToggleActive(selectedModelId, !!selectedModel?.is_active)}
                    className="gap-1.5"
                  >
                    <Power className="w-4 h-4" />
                    {selectedModel?.is_active ? "Active" : "Activate"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setScheduleModelId(selectedModelId);
                      setScheduleStart(selectedModel?.schedule_start || "");
                      setScheduleEnd(selectedModel?.schedule_end || "");
                      setShowScheduleDialog(true);
                    }}
                    className="gap-1.5"
                  >
                    <CalendarRange className="w-4 h-4" /> Schedule
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(selectedModelId)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                value={editModel.description || ""}
                onChange={e => updateField("description", e.target.value)}
                className="h-9"
                placeholder="Optional notes about this model's strategy"
              />
            </div>
            <div className="w-24">
              <Label className="text-xs font-semibold">Priority</Label>
              <Input
                type="number"
                value={editModel.priority || 0}
                onChange={e => updateField("priority", Number(e.target.value))}
                className="h-9"
              />
            </div>
          </div>

          {/* ── Valuation Basis ── */}
          <Section icon={<SlidersHorizontal className="w-4 h-4 text-primary" />} title="Valuation Basis" defaultOpen>
            <Select value={editModel.bb_value_basis || "tradein_avg"} onValueChange={v => updateField("bb_value_basis", v)}>
              <SelectTrigger className="w-full max-w-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BB_VALUE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Section>

          {/* ── Condition Multipliers ── */}
          <Section icon={<Gauge className="w-4 h-4 text-primary" />} title="Condition Multipliers">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(["excellent", "good", "fair", "rough"] as const).map(grade => (
                <div key={grade} className="space-y-2">
                  <Label className="capitalize text-xs font-semibold">{grade}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" step="0.01" min="0" max="2"
                      value={(editModel.condition_multipliers as any)?.[grade] ?? 1}
                      onChange={e => updateConditionMultiplier(grade, Number(e.target.value))}
                      className="w-20 h-8 text-sm"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {((editModel.condition_multipliers as any)?.[grade] ?? 1) > 1 ? "↑" : ((editModel.condition_multipliers as any)?.[grade] ?? 1) < 1 ? "↓" : "="}
                    </span>
                  </div>
                  <Slider
                    value={[((editModel.condition_multipliers as any)?.[grade] ?? 1) * 100]}
                    min={50} max={130} step={1}
                    onValueChange={([v]) => updateConditionMultiplier(grade, Math.round(v) / 100)}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* ── Global Controls ── */}
          <Section icon={<Zap className="w-4 h-4 text-accent" />} title="Global Controls" defaultOpen>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Global Adjustment %</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" value={editModel.global_adjustment_pct || 0} onChange={e => updateField("global_adjustment_pct", Number(e.target.value))} className="w-24 h-8 text-sm" step="0.5" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Regional Adjustment %</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" value={editModel.regional_adjustment_pct || 0} onChange={e => updateField("regional_adjustment_pct", Number(e.target.value))} className="w-24 h-8 text-sm" step="0.5" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Recon Cost</Label>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                  <Input type="number" value={editModel.recon_cost || 0} onChange={e => updateField("recon_cost", Number(e.target.value))} className="w-24 h-8 text-sm" step="50" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Floor (Min)</Label>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                  <Input type="number" value={editModel.offer_floor || 500} onChange={e => updateField("offer_floor", Number(e.target.value))} className="w-24 h-8 text-sm" step="100" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Ceiling (Max)</Label>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                  <Input type="number" value={editModel.offer_ceiling ?? ""} onChange={e => updateField("offer_ceiling", e.target.value ? Number(e.target.value) : null)} className="w-24 h-8 text-sm" step="1000" placeholder="No cap" />
                </div>
              </div>
            </div>
          </Section>

          {/* ── Age Tiers ── */}
          <Section icon={<Calendar className="w-4 h-4 text-primary" />} title="Age-Based Adjustments">
            <div className="space-y-2">
              {(editModel.age_tiers || []).map((tier: AgeTier, idx: number) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 border-border text-sm">
                  <Input type="number" value={tier.min_years} onChange={e => { const u = [...(editModel.age_tiers || [])]; u[idx] = { ...u[idx], min_years: Number(e.target.value) }; updateField("age_tiers", u); }} className="w-16 h-7 text-xs" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="number" value={tier.max_years} onChange={e => { const u = [...(editModel.age_tiers || [])]; u[idx] = { ...u[idx], max_years: Number(e.target.value) }; updateField("age_tiers", u); }} className="w-16 h-7 text-xs" />
                  <span className="text-xs text-muted-foreground">yrs →</span>
                  <Input type="number" value={tier.adjustment_pct} onChange={e => { const u = [...(editModel.age_tiers || [])]; u[idx] = { ...u[idx], adjustment_pct: Number(e.target.value) }; updateField("age_tiers", u); }} className="w-16 h-7 text-xs" step="0.5" />
                  <span className="text-xs text-muted-foreground">%</span>
                  <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => updateField("age_tiers", (editModel.age_tiers || []).filter((_: any, i: number) => i !== idx))}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={() => {
              const tiers = editModel.age_tiers || [];
              const lastMax = tiers.length > 0 ? (tiers as AgeTier[])[tiers.length - 1].max_years + 1 : 5;
              updateField("age_tiers", [...tiers, { min_years: lastMax, max_years: lastMax + 4, adjustment_pct: -3 }]);
            }}>
              <Plus className="w-3 h-3" /> Add Tier
            </Button>
          </Section>

          {/* ── Mileage Tiers ── */}
          <Section icon={<Gauge className="w-4 h-4 text-primary" />} title="Mileage-Based Deductions">
            <div className="space-y-2">
              {(editModel.mileage_tiers || []).map((tier: MileageTier, idx: number) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 border-border text-sm">
                  <Input type="number" value={tier.min_miles} onChange={e => { const u = [...(editModel.mileage_tiers || [])]; u[idx] = { ...u[idx], min_miles: Number(e.target.value) }; updateField("mileage_tiers", u); }} className="w-24 h-7 text-xs" step="5000" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="number" value={tier.max_miles} onChange={e => { const u = [...(editModel.mileage_tiers || [])]; u[idx] = { ...u[idx], max_miles: Number(e.target.value) }; updateField("mileage_tiers", u); }} className="w-24 h-7 text-xs" step="5000" />
                  <span className="text-xs text-muted-foreground">mi →</span>
                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                  <Input type="number" value={tier.adjustment_flat} onChange={e => { const u = [...(editModel.mileage_tiers || [])]; u[idx] = { ...u[idx], adjustment_flat: Number(e.target.value) }; updateField("mileage_tiers", u); }} className="w-20 h-7 text-xs" step="100" />
                  <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => updateField("mileage_tiers", (editModel.mileage_tiers || []).filter((_: any, i: number) => i !== idx))}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={() => {
              const tiers = editModel.mileage_tiers || [];
              const lastMax = tiers.length > 0 ? (tiers as MileageTier[])[tiers.length - 1].max_miles + 1 : 80000;
              updateField("mileage_tiers", [...tiers, { min_miles: lastMax, max_miles: lastMax + 20000, adjustment_flat: -500 }]);
            }}>
              <Plus className="w-3 h-3" /> Add Tier
            </Button>
          </Section>

          {/* ── Deductions ── */}
          <Section icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} title="Condition Deductions">
            <div className="space-y-2">
              {Object.entries(DEDUCTION_LABELS).map(([key, config]) => {
                const enabled = (editModel.deductions_config as any)?.[key] ?? true;
                const amountKeys = Array.isArray(config.amountKey) ? config.amountKey : [config.amountKey];
                return (
                  <div key={key} className={`rounded-lg border ${enabled ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 opacity-60"}`}>
                    <div className="flex items-center justify-between px-3 py-2">
                      <Label className="text-xs font-semibold cursor-pointer">{config.label}</Label>
                      <Switch checked={enabled} onCheckedChange={() => toggleDeduction(key)} />
                    </div>
                    {enabled && (
                      <div className="px-3 pb-2 flex flex-wrap gap-2">
                        {amountKeys.map(amtKey => (
                          <div key={amtKey} className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{AMOUNT_LABELS[amtKey]}:</span>
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                            <Input type="number" value={(editModel.deduction_amounts as any)?.[amtKey] ?? 0} onChange={e => updateDeductionAmount(amtKey, Number(e.target.value))} className="w-16 h-6 text-[10px]" step="25" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      )}

      {!editModel && models.length === 0 && (
        <div className="bg-muted/40 rounded-lg p-6 text-center text-muted-foreground">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No pricing models yet. Create your first model to start building your valuation strategy.</p>
          <Button onClick={handleCreateNew} className="mt-3 gap-1.5">
            <Plus className="w-4 h-4" /> Create First Model
          </Button>
        </div>
      )}

      {/* ── Save As Dialog ── */}
      <Dialog open={showSaveAsDialog} onOpenChange={setShowSaveAsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save As New Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Model Name</Label>
              <Input value={saveAsName} onChange={e => setSaveAsName(e.target.value)} placeholder="e.g. Summer Aggressive" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={saveAsDesc} onChange={e => setSaveAsDesc(e.target.value)} placeholder="Optional notes" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveAsDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAs} disabled={saving || !saveAsName.trim()} className="gap-1.5">
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Dialog ── */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-primary" />
              Schedule Model
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Set a date range for this model to auto-activate. It will stack with other active models based on priority.</p>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setScheduleStart("");
              setScheduleEnd("");
              if (scheduleModelId) {
                supabase.from("pricing_models" as any).update({ schedule_start: null, schedule_end: null } as any).eq("id", scheduleModelId).then(() => fetchModels());
              }
              setShowScheduleDialog(false);
            }}>Clear Schedule</Button>
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
