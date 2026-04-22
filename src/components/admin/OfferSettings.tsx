import { useState, useEffect, useRef, useCallback } from "react";
import OfferSimulator from "./OfferSimulator";
import PricingModelManager from "./PricingModelManager";
import PricingAccessGate from "./PricingAccessGate";
import PricingAccessRequests from "./PricingAccessRequests";
import StrategyModeSelector from "./StrategyModeSelector";
import MarketAdjustmentConfigPanel from "./MarketAdjustmentConfig";
import ArchetypeOverrides, { type ArchetypeDeductionOverrides } from "./ArchetypeOverrides";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import type { OfferSettings as OfferSettingsType, StrategyMode, MarketAdjustmentConfig } from "@/lib/offerCalculator";
import { STRATEGY_MODE_PRESETS, STRATEGY_PRESETS, DEFAULT_MARKET_ADJUSTMENT } from "@/lib/offerCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Save, Plus, Trash2, Flame, SlidersHorizontal, Target, Zap, AlertTriangle, DollarSign, Shield, Gauge, Calendar, ChevronDown, MapPin, Loader2, TrendingUp, Truck, Brain } from "lucide-react";

// ── Collapsible Section wrapper ──
const Section = ({
  icon, title, children, defaultOpen = false, className = "",
  headerRight,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerRight?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`bg-card rounded-xl shadow-lg border border-border overflow-hidden ${className}`}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              {icon}
              <h3 className="font-bold text-card-foreground">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
              {headerRight}
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// ── Types ──────────────────────────────────────────────────────
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
  moonroof_broken: number;
  engine_issue_per_item: number;
  mechanical_issue_per_item: number;
  tech_issue_per_item: number;
  not_drivable: number;
  smoked_in: number;
  tires_not_replaced: number;
  missing_keys_1: number;
  missing_keys_0: number;
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

interface ConditionMultipliers {
  excellent: number;
  very_good: number;
  good: number;
  fair: number;
}

interface ConditionBasisMap {
  excellent: string;
  very_good: string;
  good: string;
  fair: string;
}

interface ConditionEquipmentMap {
  excellent: boolean;
  very_good: boolean;
  good: boolean;
  fair: boolean;
}

interface OfferSettingsRow {
  id: string;
  dealership_id: string;
  bb_value_basis: string;
  global_adjustment_pct: number;
  deductions_config: DeductionsConfig;
  deduction_amounts: DeductionAmounts;
  condition_multipliers: ConditionMultipliers;
  condition_basis_map: ConditionBasisMap;
  condition_equipment_map: ConditionEquipmentMap;
  recon_cost: number;
  offer_floor: number;
  offer_ceiling: number | null;
  age_tiers: AgeTier[];
  mileage_tiers: MileageTier[];
  regional_adjustment_pct: number;
  retail_search_radius: number;
  retail_search_zip: string;
  dealer_pack: number;
  hide_pack_from_appraisal: boolean;
  retail_profit_basis: string;
  low_mileage_bonus: { enabled: boolean; avg_miles_per_year: number; bonus_pct_per_step: number; step_size_pct: number; max_bonus_pct: number; min_miles_per_year: number };
}

interface OfferRule {
  id: string;
  dealership_id: string;
  name: string;
  rule_type: string;
  criteria: {
    year_min?: number;
    year_max?: number;
    mileage_min?: number;
    mileage_max?: number;
    makes?: string[];
    models?: string[];
    conditions?: string[];
  };
  adjustment_pct: number;
  adjustment_type: "pct" | "flat";
  is_active: boolean;
  flag_in_dashboard: boolean;
  priority: number;
}

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
  moonroof_broken: { label: "Moonroof Not Working", amountKey: "moonroof_broken" },
  engine_issues: { label: "Engine Issues", amountKey: "engine_issue_per_item" },
  mechanical_issues: { label: "Mechanical Issues", amountKey: "mechanical_issue_per_item" },
  tech_issues: { label: "Technology Issues", amountKey: "tech_issue_per_item" },
  not_drivable: { label: "Not Drivable", amountKey: "not_drivable" },
  smoked_in: { label: "Smoked In", amountKey: "smoked_in" },
  tires_not_replaced: { label: "Tires Not Replaced", amountKey: "tires_not_replaced" },
  missing_keys: { label: "Missing Keys", amountKey: ["missing_keys_1", "missing_keys_0"] },
};

const AMOUNT_LABELS: Record<string, string> = {
  accidents_1: "1 Accident",
  accidents_2: "2 Accidents",
  accidents_3plus: "3+ Accidents",
  exterior_damage_per_item: "Per Item",
  interior_damage_per_item: "Per Item",
  windshield_cracked: "Cracked",
  windshield_chipped: "Chipped",
  moonroof_broken: "Not Working",
  engine_issue_per_item: "Per Issue",
  mechanical_issue_per_item: "Per Issue",
  tech_issue_per_item: "Per Issue",
  not_drivable: "Flat Deduction",
  smoked_in: "Flat Deduction",
  tires_not_replaced: "Flat Deduction",
  missing_keys_1: "1 Key Only",
  missing_keys_0: "0 Keys",
};

const DEFAULT_DEDUCTION_AMOUNTS: DeductionAmounts = {
  accidents_1: 800, accidents_2: 1800, accidents_3plus: 3000,
  exterior_damage_per_item: 300, interior_damage_per_item: 200,
  windshield_cracked: 400, windshield_chipped: 150, moonroof_broken: 300,
  engine_issue_per_item: 500, mechanical_issue_per_item: 350, tech_issue_per_item: 150,
  not_drivable: 1500, smoked_in: 500, tires_not_replaced: 400,
  missing_keys_1: 200, missing_keys_0: 400,
};

const DEFAULT_CONDITION_MULTIPLIERS: ConditionMultipliers = {
  excellent: 1.0, very_good: 1.0, good: 1.0, fair: 1.0,
};

const emptyRule: Omit<OfferRule, "id" | "dealership_id"> = {
  name: "",
  rule_type: "criteria",
  criteria: {},
  adjustment_pct: 0,
  adjustment_type: "pct",
  is_active: true,
  flag_in_dashboard: false,
  priority: 0,
};

interface OfferSettingsProps {
  userId?: string;
  userRole?: string;
}

const OfferSettings = ({ userId, userRole }: OfferSettingsProps = {}) => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OfferSettingsRow | null>(null);
  const [savedSettings, setSavedSettings] = useState<OfferSettingsRow | null>(null);
  const [rules, setRules] = useState<OfferRule[]>([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<OfferRule> | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<string | null>(null);
  const [modelOverrideSettings, setModelOverrideSettings] = useState<OfferSettingsType | null>(null);
  const [strategyMode, setStrategyMode] = useState<StrategyMode>("standard");
  const [marketAdjustment, setMarketAdjustment] = useState<MarketAdjustmentConfig>(DEFAULT_MARKET_ADJUSTMENT);
  const syncToModelRef = useRef<((s: OfferSettingsType) => void) | null>(null);

  const handleWorkbenchChange = useCallback((newSettings: OfferSettingsType) => {
    setModelOverrideSettings(newSettings);
    // Push workbench changes back into the PricingModelManager's editModel
    syncToModelRef.current?.(newSettings);
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [settingsRes, rulesRes] = await Promise.all([
      supabase.from("offer_settings" as any).select("*").eq("dealership_id", dealershipId).maybeSingle(),
      supabase.from("offer_rules" as any).select("*").eq("dealership_id", dealershipId).order("priority", { ascending: false }),
    ]);
    if (settingsRes.data) {
      const d = settingsRes.data as any;
      setSettings({
        ...d,
        deduction_amounts: d.deduction_amounts || DEFAULT_DEDUCTION_AMOUNTS,
        condition_multipliers: d.condition_multipliers || DEFAULT_CONDITION_MULTIPLIERS,
        condition_basis_map: d.condition_basis_map || { excellent: "retail_xclean", very_good: "tradein_clean", good: "tradein_avg", fair: "wholesale_rough" },
        condition_equipment_map: d.condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true },
        offer_floor: d.offer_floor ?? 500,
        offer_ceiling: d.offer_ceiling ?? null,
        age_tiers: Array.isArray(d.age_tiers) ? d.age_tiers : [],
        mileage_tiers: Array.isArray(d.mileage_tiers) ? d.mileage_tiers : [],
        regional_adjustment_pct: d.regional_adjustment_pct ?? 0,
        retail_search_radius: d.retail_search_radius ?? 100,
        retail_search_zip: d.retail_search_zip || "",
        dealer_pack: d.dealer_pack ?? 0,
        hide_pack_from_appraisal: d.hide_pack_from_appraisal ?? false,
        retail_profit_basis: d.retail_profit_basis || "retail_avg",
        low_mileage_bonus: d.low_mileage_bonus || { enabled: false, avg_miles_per_year: 12000, bonus_pct_per_step: 2, step_size_pct: 20, max_bonus_pct: 8, min_miles_per_year: 4000 },
      } as OfferSettingsRow);
      // Detect strategy_mode from saved data
      if (d.strategy_mode) {
        setStrategyMode(d.strategy_mode as StrategyMode);
      } else if (d.condition_basis_map) {
        const basis = d.condition_basis_map;
        if (basis?.excellent?.startsWith("wholesale")) setStrategyMode("conservative");
        else if (basis?.very_good === "retail_clean") setStrategyMode("predator");
        else if (basis?.good === "tradein_clean") setStrategyMode("aggressive");
        else setStrategyMode("standard");
      }
      setSavedSettings({
        ...d,
        deduction_amounts: d.deduction_amounts || DEFAULT_DEDUCTION_AMOUNTS,
        condition_multipliers: d.condition_multipliers || DEFAULT_CONDITION_MULTIPLIERS,
        condition_basis_map: d.condition_basis_map || { excellent: "retail_xclean", very_good: "tradein_clean", good: "tradein_avg", fair: "wholesale_rough" },
        condition_equipment_map: d.condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true },
        offer_floor: d.offer_floor ?? 500,
        offer_ceiling: d.offer_ceiling ?? null,
        age_tiers: Array.isArray(d.age_tiers) ? d.age_tiers : [],
        mileage_tiers: Array.isArray(d.mileage_tiers) ? d.mileage_tiers : [],
        regional_adjustment_pct: d.regional_adjustment_pct ?? 0,
        retail_search_radius: d.retail_search_radius ?? 100,
        retail_search_zip: d.retail_search_zip || "",
        dealer_pack: d.dealer_pack ?? 0,
        hide_pack_from_appraisal: d.hide_pack_from_appraisal ?? false,
        retail_profit_basis: d.retail_profit_basis || "retail_avg",
        low_mileage_bonus: d.low_mileage_bonus || { enabled: false, avg_miles_per_year: 12000, bonus_pct_per_step: 2, step_size_pct: 20, max_bonus_pct: 8, min_miles_per_year: 4000 },
      } as OfferSettingsRow);
      // Detect strategy_mode from saved data (savedSettings mirror)
      if (d.strategy_mode) {
        setStrategyMode(d.strategy_mode as StrategyMode);
      } else if (d.condition_basis_map) {
        const basis = d.condition_basis_map;
        if (basis?.excellent?.startsWith("wholesale")) setStrategyMode("conservative");
        else if (basis?.very_good === "retail_clean") setStrategyMode("predator");
        else if (basis?.good === "tradein_clean") setStrategyMode("aggressive");
        else setStrategyMode("standard");
      }
    }
    if (rulesRes.data) {
      setRules((rulesRes.data as any[]).map(r => ({ ...r, adjustment_type: r.adjustment_type || "pct" })) as OfferRule[]);
    }
    setLoading(false);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("offer_settings" as any).update({
      bb_value_basis: settings.bb_value_basis,
      global_adjustment_pct: settings.global_adjustment_pct,
      deductions_config: settings.deductions_config as any,
      deduction_amounts: settings.deduction_amounts as any,
      condition_multipliers: settings.condition_multipliers as any,
      condition_basis_map: settings.condition_basis_map as any,
      condition_equipment_map: settings.condition_equipment_map as any,
      recon_cost: settings.recon_cost,
      offer_floor: settings.offer_floor,
      offer_ceiling: settings.offer_ceiling,
      age_tiers: settings.age_tiers as any,
      mileage_tiers: settings.mileage_tiers as any,
      regional_adjustment_pct: settings.regional_adjustment_pct,
      retail_search_radius: settings.retail_search_radius ?? 100,
      retail_search_zip: settings.retail_search_zip || null,
      dealer_pack: settings.dealer_pack ?? 0,
      hide_pack_from_appraisal: settings.hide_pack_from_appraisal ?? false,
      retail_profit_basis: settings.retail_profit_basis || "retail_avg",
      manager_pin: (settings as any).manager_pin || "0000",
      target_gross_min: (settings as any).target_gross_min || 0,
      wholesale_only_mileage: (settings as any).wholesale_only_mileage || 120000,
      wholesale_only_age_years: (settings as any).wholesale_only_age_years || 10,
      max_market_pct: (settings as any).max_market_pct ?? 90,
      floor_plan_rate_pct: (settings as any).floor_plan_rate_pct ?? 6.5,
      lot_cost_per_day: (settings as any).lot_cost_per_day ?? 8,
      learning_threshold: (settings as any).learning_threshold ?? 250,
      archetype_deduction_overrides: (settings as any).archetype_deduction_overrides ?? null,
      strategy_mode: strategyMode,
      updated_at: new Date().toISOString(),
    } as any).eq("id", settings.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Offer settings updated." });
      setSavedSettings({ ...settings });
    }
    setSaving(false);
  };

  const toggleDeduction = (key: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      deductions_config: { ...settings.deductions_config, [key]: !settings.deductions_config[key as keyof DeductionsConfig] },
    });
  };

  const updateDeductionAmount = (key: string, value: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      deduction_amounts: { ...settings.deduction_amounts, [key]: value },
    });
  };

  const updateConditionMultiplier = (key: string, value: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      condition_multipliers: { ...settings.condition_multipliers, [key]: value },
    });
  };

  const openNewRule = (type: string) => {
    setEditingRule({ ...emptyRule, rule_type: type, flag_in_dashboard: type === "hot_list" });
    setShowRuleDialog(true);
  };

  const openEditRule = (rule: OfferRule) => {
    setEditingRule({ ...rule });
    setShowRuleDialog(true);
  };

  const handleSaveRule = async () => {
    if (!editingRule?.name?.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSavingRule(true);
    const payload = {
      dealership_id: dealershipId,
      name: editingRule.name,
      rule_type: editingRule.rule_type,
      criteria: editingRule.criteria || {},
      adjustment_pct: editingRule.adjustment_pct || 0,
      adjustment_type: editingRule.adjustment_type || "pct",
      is_active: editingRule.is_active ?? true,
      flag_in_dashboard: editingRule.flag_in_dashboard ?? false,
      priority: editingRule.priority || 0,
    };

    let error;
    if (editingRule.id) {
      ({ error } = await supabase.from("offer_rules" as any).update(payload as any).eq("id", editingRule.id));
    } else {
      ({ error } = await supabase.from("offer_rules" as any).insert(payload as any));
    }
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingRule.id ? "Rule updated" : "Rule created" });
      setShowRuleDialog(false);
      setEditingRule(null);
      fetchAll();
    }
    setSavingRule(false);
  };

  const handleDeleteRule = (id: string) => {
    setConfirmDeleteRuleId(id);
  };

  const executeDeleteRule = async () => {
    if (!confirmDeleteRuleId) return;
    const id = confirmDeleteRuleId;
    setConfirmDeleteRuleId(null);
    const { error } = await supabase.from("offer_rules" as any).delete().eq("id", id);
    if (!error) {
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Rule deleted" });
    }
  };

  const handleToggleRuleActive = async (rule: OfferRule) => {
    const { error } = await supabase.from("offer_rules" as any).update({ is_active: !rule.is_active } as any).eq("id", rule.id);
    if (!error) {
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    }
  };

  const updateCriteria = (key: string, value: any) => {
    if (!editingRule) return;
    setEditingRule({ ...editingRule, criteria: { ...editingRule.criteria, [key]: value } });
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading offer settings…</div>;
  if (!settings) return <div className="text-center py-12 text-muted-foreground">No settings found.</div>;

  const criteriaRules = rules.filter((r) => r.rule_type === "criteria");
  const hotListRules = rules.filter((r) => r.rule_type === "hot_list");

  const canManageRequests = userRole === "admin" || userRole === "gsm_gm";

  return (
    <div className="space-y-4">
      {/* Admin/GM: show pending GSM access requests */}
      {canManageRequests && userId && (
        <PricingAccessRequests userId={userId} />
      )}

      {/* Gate pricing tools behind access control */}
      <PricingAccessGate userId={userId || ""} userRole={userRole || "admin"}>
      {/* ── Price Builder Workbench — Simulator First ── */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-primary/20 p-5 mb-2">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-card-foreground">Price Builder Workbench</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Look up any VIN to see real-time valuations. Adjust every pricing lever inline and watch the offer, profit gauge, and market context update instantly. Save your formula as a named offer logic.
        </p>

        {/* Pricing Model Manager — model save/load/schedule */}
        <PricingModelManager
          onModelChange={setModelOverrideSettings}
          onRegisterSync={(fn) => { syncToModelRef.current = fn; }}
          userRole={userRole}
        />

        {/* Unified Simulator — all controls inline alongside results */}
        <div className="mt-4">
          <OfferSimulator
            settings={modelOverrideSettings || settings}
            savedSettings={savedSettings}
            rules={rules}
            inlineControls={true}
            onSettingsChange={handleWorkbenchChange}
          />
        </div>
      </div>

      {/* ── Strategy Mode Selector ── */}
      <Section
        icon={<Shield className="w-5 h-5 text-primary" />}
        title="Strategy Mode"
        defaultOpen
      >
        <StrategyModeSelector
          value={strategyMode}
          onChange={(mode) => {
            setStrategyMode(mode);
            if (mode !== "custom" && settings) {
              const modePreset = STRATEGY_MODE_PRESETS[mode];
              const calcPreset = STRATEGY_PRESETS[mode] || {};
              setSettings({
                ...settings,
                strategy_mode: mode,
                condition_basis_map: modePreset.condition_basis_map as any,
                global_adjustment_pct: modePreset.global_adjustment_pct,
                ...(calcPreset.condition_multipliers ? { condition_multipliers: calcPreset.condition_multipliers } : {}),
              } as any);
            } else if (mode === "custom" && settings) {
              setSettings({ ...settings, strategy_mode: mode } as any);
            }
          }}
        />
      </Section>

      {/* ── Hot List — Cars We Want (moved up for priority) ── */}
      <Section
        icon={<Flame className="w-5 h-5 text-destructive" />}
        title="Hot List — Cars We Want"
        defaultOpen
        className="border-l-4 border-l-destructive/50"
        headerRight={<Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openNewRule("hot_list"); }} className="gap-1"><Plus className="w-4 h-4" /> Add Vehicle</Button>}
      >
        <p className="text-sm text-muted-foreground mb-4">
          Add vehicles you're actively looking for. Matching submissions get an automatic offer boost and are flagged in the dashboard.
        </p>
        {hotListRules.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No hot list entries yet.</p>
        ) : (
          <div className="space-y-2">
            {hotListRules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onEdit={openEditRule} onDelete={handleDeleteRule} onToggle={handleToggleRuleActive} />
            ))}
          </div>
        )}
      </Section>

      {/* ── Live Market Adjustment ── */}
      <Section
        icon={<TrendingUp className="w-5 h-5 text-primary" />}
        title="Live Market Adjustment"
        defaultOpen={false}
        headerRight={
          <Badge variant={marketAdjustment.enabled ? "default" : "outline"} className="text-[9px]">
            {marketAdjustment.enabled ? "Enabled" : "Disabled"}
          </Badge>
        }
      >
        <MarketAdjustmentConfigPanel
          config={marketAdjustment}
          onChange={setMarketAdjustment}
        />
      </Section>

      {/* ── Market Search Radius ── */}
      {settings && (
        <Section
          icon={<MapPin className="w-5 h-5 text-primary" />}
          title="Market Data Settings"
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Market Search ZIP Code</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Default ZIP for live retail market lookups. Leave empty to use the dealer's primary location ZIP automatically.
              </p>
              <Input
                value={settings.retail_search_zip || ""}
                onChange={(e) => setSettings({ ...settings, retail_search_zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                placeholder="Auto (dealer location ZIP)"
                maxLength={5}
                className="max-w-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Retail Listings Search Radius</Label>
              <p className="text-xs text-muted-foreground mb-2">
                How far to search for comparable retail listings when pulling live market data from Black Book.
              </p>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.retail_search_radius ?? 100]}
                  min={25}
                  max={500}
                  step={25}
                  onValueChange={([v]) => setSettings({ ...settings, retail_search_radius: v })}
                  className="flex-1"
                />
                <span className="text-sm font-bold text-card-foreground w-20 text-right">{settings.retail_search_radius ?? 100} mi</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Dealer Costs (Internal Only) ── */}
      {settings && (
        <Section
          icon={<DollarSign className="w-5 h-5 text-primary" />}
          title="Dealer Costs — Profit Analysis Only"
          defaultOpen={false}
          headerRight={<Badge variant="outline" className="text-[9px] text-muted-foreground">Internal</Badge>}
        >
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 mb-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              ⚠ These are profit analysis inputs. They do NOT reduce the customer offer.
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Recon cost and dealer pack are internal references that appear in the waterfall's profit section and ACV sheet, but never change the offer the customer sees.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-semibold">Recon Reserve</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                Avg cost to recondition before retail.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={0} step={50}
                  value={settings.recon_cost}
                  onChange={(e) => setSettings({ ...settings, recon_cost: Number(e.target.value) || 0 })}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Dealer Pack</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                Standard acquisition pack per deal.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={0} step={50}
                  value={settings.dealer_pack}
                  onChange={(e) => setSettings({ ...settings, dealer_pack: Number(e.target.value) || 0 })}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Target Gross Minimum</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                Red warning if projected gross falls below this.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={0} step={100}
                  value={(settings as any).target_gross_min || 0}
                  onChange={(e) => setSettings({ ...settings, target_gross_min: Number(e.target.value) || 0 } as any)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <Label className="text-sm font-semibold">Floor Plan Rate</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                Annual floor plan interest rate used for carrying cost calculations.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={20} step={0.25}
                  value={(settings as any).floor_plan_rate_pct ?? 6.5}
                  onChange={(e) => setSettings({ ...settings, floor_plan_rate_pct: Number(e.target.value) } as any)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">% / year</span>
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Lot Cost Per Day</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                Daily overhead allocated to each used vehicle on the lot.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number" min={0} step={1}
                  value={(settings as any).lot_cost_per_day ?? 8}
                  onChange={(e) => setSettings({ ...settings, lot_cost_per_day: Number(e.target.value) } as any)}
                  className="pl-7 w-24"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 p-3 rounded-lg border border-border bg-muted/30">
            <Switch
              checked={settings.hide_pack_from_appraisal}
              onCheckedChange={(checked) => setSettings({ ...settings, hide_pack_from_appraisal: checked })}
            />
            <div>
              <Label className="text-sm font-semibold">Combine Pack into Reconditioning</Label>
              <p className="text-[10px] text-muted-foreground">
                Hides the dealer pack from appraisal staff by merging it into a single "Recon" line.
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg border border-border bg-muted/30">
            <Label className="text-sm font-semibold">Retail Basis for Profit Calculations</Label>
            <p className="text-[10px] text-muted-foreground mb-2">
              Which retail tier to use when calculating projected profit and margin.
            </p>
            <Select
              value={settings.retail_profit_basis || "retail_avg"}
              onValueChange={(v) => setSettings({ ...settings, retail_profit_basis: v })}
            >
              <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retail_xclean">Extra Clean Retail</SelectItem>
                <SelectItem value="retail_clean">Clean Retail</SelectItem>
                <SelectItem value="retail_avg">Average Retail</SelectItem>
                <SelectItem value="retail_rough">Rough Retail</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>
      )}

      {/* ── Safety Caps ── */}
      {settings && (
        <Section
          icon={<Shield className="w-5 h-5 text-destructive" />}
          title="Safety Caps & Guardrails"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold">Offer Floor</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Minimum offer regardless of deductions.</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" min={0} step={100} value={settings.offer_floor ?? 500} onChange={(e) => setSettings({ ...settings, offer_floor: Number(e.target.value) || 0 })} className="pl-7" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Offer Ceiling</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Max offer cap (blank = no ceiling).</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" min={0} step={500} value={settings.offer_ceiling ?? ""} onChange={(e) => setSettings({ ...settings, offer_ceiling: e.target.value ? Number(e.target.value) : null })} placeholder="No ceiling" className="pl-7" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Max % of Retail</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Never offer more than this % of BB retail avg.</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={50} max={100} step={1} value={(settings as any).max_market_pct ?? 90} onChange={(e) => setSettings({ ...settings, max_market_pct: Number(e.target.value) || 90 } as any)} className="w-24" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Manager PIN</Label>
              <p className="text-[10px] text-muted-foreground mb-1">4-digit PIN for management override on appraisals.</p>
              <Input type="password" maxLength={4} value={(settings as any).manager_pin || "0000"} onChange={(e) => setSettings({ ...settings, manager_pin: e.target.value.replace(/\D/g, "").slice(0, 4) } as any)} className="w-28 text-center font-mono tracking-widest" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Label className="text-sm font-semibold mb-3 block">Wholesale-Only Threshold</Label>
            <p className="text-[10px] text-muted-foreground mb-3">If a vehicle exceeds these thresholds, flag it as "Wholesale Only" on the appraisal page.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Max Mileage</Label>
                <Input type="number" step={5000} value={(settings as any).wholesale_only_mileage || 120000} onChange={(e) => setSettings({ ...settings, wholesale_only_mileage: Number(e.target.value) } as any)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max Vehicle Age (years)</Label>
                <Input type="number" step={1} value={(settings as any).wholesale_only_age_years || 10} onChange={(e) => setSettings({ ...settings, wholesale_only_age_years: Number(e.target.value) } as any)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Settings
            </Button>
          </div>
        </Section>
      )}

      {/* ── Archetype Overrides ── */}
      {settings && (
        <Section
          icon={<Truck className="w-5 h-5 text-primary" />}
          title="Archetype Deduction Overrides"
          defaultOpen={false}
          headerRight={
            (settings as any).archetype_deduction_overrides && Object.keys((settings as any).archetype_deduction_overrides).length > 0
              ? <Badge variant="secondary" className="text-[9px]">{Object.keys((settings as any).archetype_deduction_overrides).length} overrides</Badge>
              : undefined
          }
        >
          <ArchetypeOverrides
            value={(settings as any).archetype_deduction_overrides || null}
            onChange={(v) => setSettings({ ...settings, archetype_deduction_overrides: Object.keys(v).length > 0 ? v : null } as any)}
            defaultAmounts={{
              tires_not_replaced: settings.deduction_amounts.tires_not_replaced || 400,
              exterior_damage_per_item: settings.deduction_amounts.exterior_damage_per_item || 300,
              smoked_in: settings.deduction_amounts.smoked_in || 500,
            }}
          />
          <div className="flex justify-end mt-4">
            <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Settings
            </Button>
          </div>
        </Section>
      )}

      {/* ── Intelligence Learning Layer ── */}
      {settings && (
        <Section
          icon={<Brain className="w-5 h-5 text-primary" />}
          title="Intelligence Learning Layer"
          defaultOpen={false}
          headerRight={<Badge variant="outline" className="text-[9px]">Threshold: {(settings as any).learning_threshold || 250}</Badge>}
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              The learning engine activates automatically once your dealership reaches the configured threshold of finalized appraisals with known outcomes. It provides historical acceptance rates, recon accuracy, and price realization insights per vehicle segment.
            </p>
            <div>
              <Label className="text-sm font-semibold">Activation Threshold</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                Minimum finalized appraisals with outcomes before historical insights appear on the appraisal page.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={50} max={1000} step={25}
                  value={(settings as any).learning_threshold ?? 250}
                  onChange={(e) => setSettings({ ...settings, learning_threshold: Number(e.target.value) || 250 } as any)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">finalized appraisals</span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save Settings
              </Button>
            </div>
          </div>
        </Section>
      )}

      {/* ── Section 5: Criteria-Based Rules ── */}
      <Section
        icon={<Target className="w-5 h-5 text-primary" />}
        title="Criteria-Based Rules"
        defaultOpen
        headerRight={<Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openNewRule("criteria"); }} className="gap-1"><Plus className="w-4 h-4" /> Add Rule</Button>}
      >
        <p className="text-sm text-muted-foreground mb-4">
          Adjust offers automatically based on vehicle attributes. Supports both percentage and flat dollar adjustments.
        </p>
        {criteriaRules.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No criteria rules yet.</p>
        ) : (
          <div className="space-y-2">
            {criteriaRules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onEdit={openEditRule} onDelete={handleDeleteRule} onToggle={handleToggleRuleActive} />
            ))}
          </div>
        )}
      </Section>

      {/* ── Rule Dialog ── */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRule?.id ? "Edit" : "New"} {editingRule?.rule_type === "hot_list" ? "Hot List Entry" : "Criteria Rule"}
            </DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editingRule.name || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder={editingRule.rule_type === "hot_list" ? 'e.g. "2022+ Toyota Tacoma"' : 'e.g. "High mileage penalty"'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Year Min</Label>
                  <Input type="number" value={editingRule.criteria?.year_min || ""} onChange={(e) => updateCriteria("year_min", e.target.value ? Number(e.target.value) : undefined)} placeholder="Any" />
                </div>
                <div>
                  <Label>Year Max</Label>
                  <Input type="number" value={editingRule.criteria?.year_max || ""} onChange={(e) => updateCriteria("year_max", e.target.value ? Number(e.target.value) : undefined)} placeholder="Any" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mileage Min</Label>
                  <Input type="number" value={editingRule.criteria?.mileage_min || ""} onChange={(e) => updateCriteria("mileage_min", e.target.value ? Number(e.target.value) : undefined)} placeholder="Any" />
                </div>
                <div>
                  <Label>Mileage Max</Label>
                  <Input type="number" value={editingRule.criteria?.mileage_max || ""} onChange={(e) => updateCriteria("mileage_max", e.target.value ? Number(e.target.value) : undefined)} placeholder="Any" />
                </div>
              </div>

              <div>
                <Label>Makes (comma-separated)</Label>
                <Input
                  value={(editingRule.criteria?.makes || []).join(", ")}
                  onChange={(e) => updateCriteria("makes", e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : [])}
                  placeholder="e.g. Toyota, Honda"
                />
              </div>

              <div>
                <Label>Models (comma-separated)</Label>
                <Input
                  value={(editingRule.criteria?.models || []).join(", ")}
                  onChange={(e) => updateCriteria("models", e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : [])}
                  placeholder="e.g. Camry, Civic"
                />
              </div>

              <div>
                <Label>Conditions (comma-separated)</Label>
                <Input
                  value={(editingRule.criteria?.conditions || []).join(", ")}
                  onChange={(e) => updateCriteria("conditions", e.target.value ? e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [])}
                  placeholder="e.g. excellent, good"
                />
              </div>

              {/* Adjustment Type + Value */}
              <div className="space-y-2">
                <Label>Adjustment Type</Label>
                <Select value={editingRule.adjustment_type || "pct"} onValueChange={(v) => setEditingRule({ ...editingRule, adjustment_type: v as "pct" | "flat" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pct">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat Dollar ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Adjustment {editingRule.adjustment_type === "flat" ? "Amount ($)" : "(%)"}</Label>
                <div className="flex items-center gap-2">
                  {editingRule.adjustment_type === "flat" && <DollarSign className="w-4 h-4 text-muted-foreground" />}
                  <Input
                    type="number"
                    step={editingRule.adjustment_type === "flat" ? "50" : "0.5"}
                    value={editingRule.adjustment_pct || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, adjustment_pct: Number(e.target.value) })}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    {(editingRule.adjustment_pct || 0) > 0 ? "boost" : (editingRule.adjustment_pct || 0) < 0 ? "penalty" : "no change"}
                  </span>
                </div>
              </div>

              {editingRule.rule_type === "hot_list" && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingRule.flag_in_dashboard ?? true}
                    onCheckedChange={(v) => setEditingRule({ ...editingRule, flag_in_dashboard: v })}
                  />
                  <Label>Flag in dashboard with 🔥</Label>
                </div>
              )}

              <div>
                <Label>Priority (higher = applied first)</Label>
                <Input
                  type="number"
                  value={editingRule.priority || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })}
                  className="w-28"
                />
              </div>

              <Button onClick={handleSaveRule} disabled={savingRule} className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                <Save className="w-4 h-4" />
                {savingRule ? "Saving…" : editingRule.id ? "Update Rule" : "Create Rule"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </PricingAccessGate>

      <AlertDialog open={!!confirmDeleteRuleId} onOpenChange={(open) => { if (!open) setConfirmDeleteRuleId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteRule}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Rule Row Component ──
const RuleRow = ({
  rule, onEdit, onDelete, onToggle,
}: {
  rule: OfferRule;
  onEdit: (r: OfferRule) => void;
  onDelete: (id: string) => void;
  onToggle: (r: OfferRule) => void;
}) => {
  const criteriaParts: string[] = [];
  const c = rule.criteria;
  if (c.year_min || c.year_max) criteriaParts.push(`Year: ${c.year_min || "any"}–${c.year_max || "any"}`);
  if (c.mileage_min || c.mileage_max) criteriaParts.push(`Miles: ${c.mileage_min?.toLocaleString() || "0"}–${c.mileage_max?.toLocaleString() || "any"}`);
  if (c.makes?.length) criteriaParts.push(`Make: ${c.makes.join(", ")}`);
  if (c.models?.length) criteriaParts.push(`Model: ${c.models.join(", ")}`);
  if (c.conditions?.length) criteriaParts.push(`Condition: ${c.conditions.join(", ")}`);

  const adjLabel = rule.adjustment_type === "flat"
    ? `${rule.adjustment_pct > 0 ? "+" : ""}$${rule.adjustment_pct.toLocaleString()}`
    : `${rule.adjustment_pct > 0 ? "+" : ""}${rule.adjustment_pct}%`;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border ${rule.is_active ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 opacity-60"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {rule.rule_type === "hot_list" && rule.flag_in_dashboard && <span>🔥</span>}
          <span className="font-semibold text-sm text-card-foreground">{rule.name}</span>
          <Badge variant={rule.adjustment_pct > 0 ? "default" : rule.adjustment_pct < 0 ? "destructive" : "secondary"} className="text-xs">
            {adjLabel}
          </Badge>
          {!rule.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
        </div>
        {criteriaParts.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{criteriaParts.join(" • ")}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Switch checked={rule.is_active} onCheckedChange={() => onToggle(rule)} />
        <Button variant="ghost" size="sm" onClick={() => onEdit(rule)}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(rule.id)} className="text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default OfferSettings;
