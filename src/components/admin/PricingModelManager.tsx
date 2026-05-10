import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { isManagerRole } from "@/lib/adminConstants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Save, Plus, Trash2, Copy, Star, Layers, Power, CalendarRange,
  ShieldCheck, Clock, XCircle, SendHorizonal,
} from "lucide-react";
import type {
  OfferSettings,
  ConditionMultipliers, ConditionBasisMap, ConditionEquipmentMap,
  DeductionsConfig, DeductionAmounts, DeductionModes,
  LowMileageBonus, HighMileagePenalty,
  ColorDesirability, SeasonalAdjustment,
  AgeTier, MileageTier,
  MarketAdjustmentConfig,
} from "@/lib/offerCalculator";
import type { Database } from "@/integrations/supabase/types";

// ── Types ──
// Derive from the generated Supabase row type so any schema change shows up
// as a compile error here. Override the JSONB columns with the richer shapes
// from offerCalculator instead of the catch-all `Json` so the rest of this
// file can read/write them without per-field casts.
type PricingModelRow    = Database["public"]["Tables"]["pricing_models"]["Row"];
type PricingModelInsert = Database["public"]["Tables"]["pricing_models"]["Insert"];

type JsonbCol =
  | "condition_multipliers" | "condition_basis_map" | "condition_equipment_map"
  | "deductions_config" | "deduction_amounts" | "deduction_modes"
  | "low_mileage_bonus" | "high_mileage_penalty"
  | "color_desirability" | "seasonal_adjustment"
  | "age_tiers" | "mileage_tiers" | "market_adjustment";

interface PricingModel extends Omit<PricingModelRow, JsonbCol> {
  condition_multipliers: ConditionMultipliers;
  condition_basis_map: ConditionBasisMap;
  condition_equipment_map: ConditionEquipmentMap;
  deductions_config: DeductionsConfig;
  deduction_amounts: DeductionAmounts;
  deduction_modes: DeductionModes;
  low_mileage_bonus: LowMileageBonus;
  high_mileage_penalty: HighMileagePenalty;
  color_desirability: ColorDesirability;
  seasonal_adjustment: SeasonalAdjustment;
  age_tiers: AgeTier[];
  mileage_tiers: MileageTier[];
  market_adjustment: MarketAdjustmentConfig | null;
}

// Single boundary cast: typed local model → Supabase Insert/Update payload.
// JSONB columns serialize fine; this just bridges TS's Json invariance.
const toDbPayload = (p: Record<string, unknown>) => p as unknown as PricingModelInsert;

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
  condition_multipliers: { excellent: 1.0, very_good: 1.0, good: 1.0, fair: 1.0 },
  condition_basis_map: {
    excellent: "retail_xclean",
    very_good: "tradein_clean",
    good: "tradein_avg",
    fair: "wholesale_rough",
  },
  deductions_config: {
    accidents: true, exterior_damage: true, interior_damage: true,
    windshield_damage: true, engine_issues: true, mechanical_issues: true,
    tech_issues: true, not_drivable: true, smoked_in: true,
    tires_not_replaced: true, missing_keys: true,
  },
  deduction_amounts: {
    accidents_1: 800, accidents_2: 1800, accidents_3plus: 3000,
    exterior_damage_per_item: 300, interior_damage_per_item: 200,
    windshield_cracked: 400, windshield_chipped: 150, moonroof_broken: 300,
    engine_issue_per_item: 500, mechanical_issue_per_item: 350, tech_issue_per_item: 150,
    not_drivable: 1500, smoked_in: 500, tires_not_replaced: 400,
    missing_keys_1: 200, missing_keys_0: 400,
  } satisfies DeductionAmounts,
  recon_cost: 0,
  offer_floor: 500,
  offer_ceiling: null as number | null,
  age_tiers: [] as AgeTier[],
  mileage_tiers: [] as MileageTier[],
};

// ── Props ──
interface Props {
  onModelChange?: (settings: OfferSettings) => void;
  onRegisterSync?: (syncFn: (settings: OfferSettings) => void) => void;
  onRegisterSave?: (saveFn: () => Promise<void>) => void;
  onModelNameChange?: (name: string, isNew: boolean) => void;
  /** Current user's role — needed for approval workflow */
  userRole?: string;
}

const APPROVAL_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "outline", icon: Clock },
  pending: { label: "Pending Approval", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: ShieldCheck },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
};

const PricingModelManager = ({ onModelChange, onRegisterSync, onRegisterSave, onModelNameChange, userRole }: Props) => {
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
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectModelId, setRejectModelId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmDeleteModelId, setConfirmDeleteModelId] = useState<string | null>(null);

  const isApprover = userRole === "gsm_gm" || userRole === "admin";
  const isManager = isManagerRole(userRole) || userRole === "admin";

  useEffect(() => { fetchModels(); }, []);

  const fetchModels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pricing_models")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("priority", { ascending: false });
    const parsed = (data ?? []).map((d) => ({
      ...d,
      condition_multipliers: d.condition_multipliers || DEFAULT_MODEL_SETTINGS.condition_multipliers,
      deductions_config: d.deductions_config || DEFAULT_MODEL_SETTINGS.deductions_config,
      deduction_amounts: d.deduction_amounts || DEFAULT_MODEL_SETTINGS.deduction_amounts,
      age_tiers: Array.isArray(d.age_tiers) ? d.age_tiers : [],
      mileage_tiers: Array.isArray(d.mileage_tiers) ? d.mileage_tiers : [],
    })) as unknown as PricingModel[];
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
      deductions_config: editModel.deductions_config || DEFAULT_MODEL_SETTINGS.deductions_config,
      deduction_amounts: editModel.deduction_amounts || DEFAULT_MODEL_SETTINGS.deduction_amounts,
      condition_multipliers: editModel.condition_multipliers || DEFAULT_MODEL_SETTINGS.condition_multipliers,
      condition_basis_map: editModel.condition_basis_map || DEFAULT_MODEL_SETTINGS.condition_basis_map,
      condition_equipment_map: editModel.condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true },
      recon_cost: editModel.recon_cost || 0,
      offer_floor: editModel.offer_floor || 500,
      offer_ceiling: editModel.offer_ceiling ?? null,
      age_tiers: editModel.age_tiers || [],
      mileage_tiers: editModel.mileage_tiers || [],
      regional_adjustment_pct: editModel.regional_adjustment_pct || 0,
      low_mileage_bonus: editModel.low_mileage_bonus || { enabled: false, avg_miles_per_year: 12000, bonus_pct_per_step: 2, step_size_pct: 20, max_bonus_pct: 8, min_miles_per_year: 4000 },
      high_mileage_penalty: editModel.high_mileage_penalty || { enabled: false, avg_miles_per_year: 12000, penalty_pct_per_step: 2, step_size_pct: 20, max_penalty_pct: 10, max_miles_per_year: 25000 },
      color_desirability: editModel.color_desirability || { enabled: false, adjustments: {} },
      seasonal_adjustment: editModel.seasonal_adjustment || { enabled: false, adjustment_pct: 0 },
      deduction_modes: editModel.deduction_modes || { accidents: "flat", not_drivable: "flat" },
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
          condition_multipliers: incoming.condition_multipliers,
          condition_basis_map: incoming.condition_basis_map,
          condition_equipment_map: incoming.condition_equipment_map,
          deductions_config: incoming.deductions_config,
          deduction_amounts: incoming.deduction_amounts,
          recon_cost: incoming.recon_cost,
          offer_floor: incoming.offer_floor,
          offer_ceiling: incoming.offer_ceiling,
          age_tiers: incoming.age_tiers,
          mileage_tiers: incoming.mileage_tiers,
          low_mileage_bonus: incoming.low_mileage_bonus,
          high_mileage_penalty: incoming.high_mileage_penalty,
          color_desirability: incoming.color_desirability,
          seasonal_adjustment: incoming.seasonal_adjustment,
          deduction_modes: incoming.deduction_modes,
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
    setEditModel({
      ...DEFAULT_MODEL_SETTINGS,
      dealership_id: dealershipId,
      name: "New Model",
      description: "",
      is_default: false,
      is_active: false,
      schedule_start: null,
      schedule_end: null,
      priority: 0,
      created_by: null,
    } as Partial<PricingModel>);
    setSelectedModelId(null);
  };

  const handleSave = async () => {
    if (!editModel?.name?.trim()) {
      toast({ title: "Name required", description: "Give your offer logic a name before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = toDbPayload({
      dealership_id: dealershipId,
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
      condition_multipliers: editModel.condition_multipliers,
      condition_basis_map: editModel.condition_basis_map,
      condition_equipment_map: editModel.condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true },
      deductions_config: editModel.deductions_config,
      deduction_amounts: editModel.deduction_amounts,
      recon_cost: editModel.recon_cost || 0,
      offer_floor: editModel.offer_floor || 500,
      offer_ceiling: editModel.offer_ceiling ?? null,
      age_tiers: editModel.age_tiers || [],
      mileage_tiers: editModel.mileage_tiers || [],
      low_mileage_bonus: editModel.low_mileage_bonus || { enabled: false, avg_miles_per_year: 12000, bonus_pct_per_step: 2, step_size_pct: 20, max_bonus_pct: 8, min_miles_per_year: 4000 },
      high_mileage_penalty: editModel.high_mileage_penalty || { enabled: false, avg_miles_per_year: 12000, penalty_pct_per_step: 2, step_size_pct: 20, max_penalty_pct: 10, max_miles_per_year: 25000 },
      color_desirability: editModel.color_desirability || { enabled: false, adjustments: {} },
      seasonal_adjustment: editModel.seasonal_adjustment || { enabled: false, adjustment_pct: 0 },
      deduction_modes: editModel.deduction_modes || { accidents: "flat", not_drivable: "flat" },
      updated_at: new Date().toISOString(),
    });

    let error;
    if (selectedModelId) {
      ({ error } = await supabase.from("pricing_models").update(payload).eq("id", selectedModelId));
    } else {
      const { data, error: e } = await supabase.from("pricing_models").insert(payload).select().single();
      error = e;
      if (data) setSelectedModelId(data.id);
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
    const payload = toDbPayload({
      dealership_id: dealershipId,
      name: saveAsName,
      description: saveAsDesc,
      is_default: false,
      is_active: false,
      priority: 0,
      bb_value_basis: editModel.bb_value_basis || "tradein_avg",
      global_adjustment_pct: editModel.global_adjustment_pct || 0,
      regional_adjustment_pct: editModel.regional_adjustment_pct || 0,
      condition_multipliers: editModel.condition_multipliers,
      condition_basis_map: editModel.condition_basis_map,
      condition_equipment_map: editModel.condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true },
      deductions_config: editModel.deductions_config,
      deduction_amounts: editModel.deduction_amounts,
      recon_cost: editModel.recon_cost || 0,
      offer_floor: editModel.offer_floor || 500,
      offer_ceiling: editModel.offer_ceiling ?? null,
      age_tiers: editModel.age_tiers || [],
      mileage_tiers: editModel.mileage_tiers || [],
      low_mileage_bonus: editModel.low_mileage_bonus || { enabled: false, avg_miles_per_year: 12000, bonus_pct_per_step: 2, step_size_pct: 20, max_bonus_pct: 8, min_miles_per_year: 4000 },
      high_mileage_penalty: editModel.high_mileage_penalty || { enabled: false, avg_miles_per_year: 12000, penalty_pct_per_step: 2, step_size_pct: 20, max_penalty_pct: 10, max_miles_per_year: 25000 },
      color_desirability: editModel.color_desirability || { enabled: false, adjustments: {} },
      seasonal_adjustment: editModel.seasonal_adjustment || { enabled: false, adjustment_pct: 0 },
      deduction_modes: editModel.deduction_modes || { accidents: "flat", not_drivable: "flat" },
    });
    const { data, error } = await supabase.from("pricing_models").insert(payload).select().single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Model created", description: `"${saveAsName}" saved.` });
      setSelectedModelId(data.id);
      setShowSaveAsDialog(false);
      setSaveAsName("");
      setSaveAsDesc("");
      fetchModels();
    }
    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    const model = models.find(m => m.id === id);
    if (model && model.approval_status !== "approved") {
      toast({ title: "Cannot set default", description: "Only approved models can be set as default.", variant: "destructive" });
      return;
    }
    await supabase.from("pricing_models").update({ is_default: false }).eq("dealership_id", dealershipId);
    await supabase.from("pricing_models").update({ is_default: true, is_active: true }).eq("id", id);
    toast({ title: "Default set" });
    fetchModels();
    if (editModel && selectedModelId === id) {
      setEditModel({ ...editModel, is_default: true, is_active: true });
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const model = models.find(m => m.id === id);
    if (!current && model && model.approval_status !== "approved") {
      toast({ title: "Approval required", description: "This model must be approved before it can be activated.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("pricing_models").update({ is_active: !current }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    fetchModels();
    if (editModel && selectedModelId === id) {
      setEditModel({ ...editModel, is_active: !current });
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    const { error } = await supabase.from("pricing_models").update({ approval_status: "pending" }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Submitted for approval", description: "A GM or admin will need to approve this model before it can go live." });
      fetchModels();
    }
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("pricing_models").update({ approval_status: "approved" }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✓ Model approved", description: "This model can now be activated." });
      fetchModels();
    }
  };

  const handleReject = async () => {
    if (!rejectModelId) return;
    const { error } = await supabase.from("pricing_models").update({
      approval_status: "rejected",
      rejection_reason: rejectReason || null,
    }).eq("id", rejectModelId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Model rejected" });
      setShowRejectDialog(false);
      setRejectModelId(null);
      setRejectReason("");
      fetchModels();
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteModelId(id);
  };

  const executeDeleteModel = async () => {
    if (!confirmDeleteModelId) return;
    const id = confirmDeleteModelId;
    setConfirmDeleteModelId(null);
    await supabase.from("pricing_models").delete().eq("id", id);
    if (selectedModelId === id) {
      setSelectedModelId(null);
      setEditModel(null);
    }
    toast({ title: "Model deleted" });
    fetchModels();
  };

  const handleSchedule = async () => {
    if (!scheduleModelId) return;
    const model = models.find(m => m.id === scheduleModelId);
    if (model && model.approval_status !== "approved") {
      toast({ title: "Approval required", description: "Model must be approved before scheduling.", variant: "destructive" });
      return;
    }
    await supabase.from("pricing_models").update({
      schedule_start: scheduleStart || null,
      schedule_end: scheduleEnd || null,
      is_active: true,
    }).eq("id", scheduleModelId);
    toast({ title: "Schedule set" });
    setShowScheduleDialog(false);
    fetchModels();
  };

  const updateModelName = (name: string) => {
    if (editModel) setEditModel({ ...editModel, name });
  };

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading offer logic…</div>;

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
          {models.map(m => {
            const approval = APPROVAL_BADGE[m.approval_status] || APPROVAL_BADGE.draft;
            const ApprovalIcon = approval.icon;
            return (
              <button
                key={m.id}
                onClick={() => selectModel(m.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  selectedModelId === m.id
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-card-foreground"
                }`}
              >
                {m.is_default && <Star className="w-3 h-3 fill-amber-500 text-warning" />}
                {m.is_active && !m.is_default && <Power className="w-3 h-3 text-success" />}
                {m.schedule_start && <CalendarRange className="w-3 h-3 text-primary" />}
                {m.approval_status === "pending" && <Clock className="w-3 h-3 text-warning" />}
                {m.approval_status === "rejected" && <XCircle className="w-3 h-3 text-destructive" />}
                <span className="truncate max-w-[120px]">{m.name}</span>
              </button>
            );
          })}

          <button
            onClick={handleCreateNew}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:border-primary/30 hover:text-card-foreground transition-all"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>

        {activeModels.length > 0 && (
          <Badge variant="secondary" className="text-micro shrink-0">
            {activeModels.length} active
          </Badge>
        )}
      </div>

      {/* ── Inline model name + actions bar ── */}
      {editModel && (
        <div className="space-y-2">
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

            {/* Approval badge */}
            {selectedModelId && selectedModel && (() => {
              const ab = APPROVAL_BADGE[selectedModel.approval_status] || APPROVAL_BADGE.draft;
              const AbIcon = ab.icon;
              return (
                <Badge variant={ab.variant} className="gap-1 text-micro shrink-0">
                  <AbIcon className="w-3 h-3" /> {ab.label}
                </Badge>
              );
            })()}

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
                  {/* Submit for approval — managers who aren't approvers */}
                  {isManager && !isApprover && selectedModel?.approval_status !== "pending" && selectedModel?.approval_status !== "approved" && (
                    <Button
                      variant="outline" size="sm" className="h-8 text-xs gap-1"
                      onClick={() => handleSubmitForApproval(selectedModelId)}
                    >
                      <SendHorizonal className="w-3 h-3" /> Submit
                    </Button>
                  )}

                  {/* Approve / Reject — approvers only */}
                  {isApprover && selectedModel?.approval_status === "pending" && (
                    <>
                      <Button
                        size="sm" className="h-8 text-xs gap-1 bg-success hover:bg-success/90 text-success-foreground"
                        onClick={() => handleApprove(selectedModelId)}
                      >
                        <ShieldCheck className="w-3 h-3" /> Approve
                      </Button>
                      <Button
                        variant="destructive" size="sm" className="h-8 text-xs gap-1"
                        onClick={() => { setRejectModelId(selectedModelId); setRejectReason(""); setShowRejectDialog(true); }}
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </Button>
                    </>
                  )}

                  <Button
                    variant={selectedModel?.is_default ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => handleSetDefault(selectedModelId)}
                    disabled={selectedModel?.is_default}
                  >
                    <Star className={`w-3 h-3 ${selectedModel?.is_default ? "fill-amber-500 text-warning" : ""}`} />
                  </Button>
                  <Button
                    variant={selectedModel?.is_active ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => handleToggleActive(selectedModelId, !!selectedModel?.is_active)}
                    disabled={selectedModel?.approval_status !== "approved" && !selectedModel?.is_active}
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

          {/* Rejection reason banner */}
          {selectedModel?.approval_status === "rejected" && selectedModel.rejection_reason && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-destructive">Rejected:</span>{" "}
                <span className="text-muted-foreground">{selectedModel.rejection_reason}</span>
              </div>
            </div>
          )}
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

      {/* ── Reject Dialog ── */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reject Pricing Model</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Reason (optional)</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this model was rejected…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} className="gap-1.5">
              <XCircle className="w-4 h-4" /> Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteModelId} onOpenChange={(open) => { if (!open) setConfirmDeleteModelId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offer Logic</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this offer logic? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteModel}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PricingModelManager;
