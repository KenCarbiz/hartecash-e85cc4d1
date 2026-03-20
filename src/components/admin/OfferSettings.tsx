import { useState, useEffect } from "react";
import OfferSimulator from "./OfferSimulator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Save, Plus, Trash2, Flame, SlidersHorizontal, Target, Zap, AlertTriangle, DollarSign, Shield, Gauge, Calendar } from "lucide-react";

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
  good: number;
  fair: number;
  rough: number;
}

interface OfferSettingsRow {
  id: string;
  dealership_id: string;
  bb_value_basis: string;
  global_adjustment_pct: number;
  deductions_config: DeductionsConfig;
  deduction_amounts: DeductionAmounts;
  condition_multipliers: ConditionMultipliers;
  recon_cost: number;
  offer_floor: number;
  offer_ceiling: number | null;
  age_tiers: AgeTier[];
  mileage_tiers: MileageTier[];
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
  windshield_cracked: 400, windshield_chipped: 150,
  engine_issue_per_item: 500, mechanical_issue_per_item: 350, tech_issue_per_item: 150,
  not_drivable: 1500, smoked_in: 500, tires_not_replaced: 400,
  missing_keys_1: 200, missing_keys_0: 400,
};

const DEFAULT_CONDITION_MULTIPLIERS: ConditionMultipliers = {
  excellent: 1.05, good: 1.0, fair: 0.90, rough: 0.78,
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

const OfferSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OfferSettingsRow | null>(null);
  const [rules, setRules] = useState<OfferRule[]>([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<OfferRule> | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [settingsRes, rulesRes] = await Promise.all([
      supabase.from("offer_settings" as any).select("*").eq("dealership_id", "default").maybeSingle(),
      supabase.from("offer_rules" as any).select("*").eq("dealership_id", "default").order("priority", { ascending: false }),
    ]);
    if (settingsRes.data) {
      const d = settingsRes.data as any;
      setSettings({
        ...d,
        deduction_amounts: d.deduction_amounts || DEFAULT_DEDUCTION_AMOUNTS,
        condition_multipliers: d.condition_multipliers || DEFAULT_CONDITION_MULTIPLIERS,
        recon_cost: d.recon_cost ?? 0,
        offer_floor: d.offer_floor ?? 500,
        offer_ceiling: d.offer_ceiling ?? null,
        age_tiers: Array.isArray(d.age_tiers) ? d.age_tiers : [],
        mileage_tiers: Array.isArray(d.mileage_tiers) ? d.mileage_tiers : [],
      } as OfferSettingsRow);
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
      recon_cost: settings.recon_cost,
      offer_floor: settings.offer_floor,
      offer_ceiling: settings.offer_ceiling,
      age_tiers: settings.age_tiers as any,
      mileage_tiers: settings.mileage_tiers as any,
      updated_at: new Date().toISOString(),
    } as any).eq("id", settings.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Offer settings updated." });
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
      dealership_id: "default",
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

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
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

  return (
    <div className="space-y-6">
      {/* ── Section 1: Value Basis ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Valuation Basis</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Choose which Black Book value is used as the starting point for all offers.
        </p>
        <Select value={settings.bb_value_basis} onValueChange={(v) => setSettings({ ...settings, bb_value_basis: v })}>
          <SelectTrigger className="w-full max-w-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BB_VALUE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Section 2: Condition Multipliers ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Condition Multipliers</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Adjust the multiplier applied to the base value for each condition grade. A multiplier of 1.0 means no change.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(["excellent", "good", "fair", "rough"] as const).map((grade) => (
            <div key={grade} className="space-y-2">
              <Label className="capitalize font-semibold">{grade}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="2"
                  value={settings.condition_multipliers[grade]}
                  onChange={(e) => updateConditionMultiplier(grade, Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">
                  {settings.condition_multipliers[grade] > 1 ? "↑ boost" : settings.condition_multipliers[grade] < 1 ? "↓ penalty" : "neutral"}
                </span>
              </div>
              <Slider
                value={[settings.condition_multipliers[grade] * 100]}
                min={50}
                max={130}
                step={1}
                onValueChange={([v]) => updateConditionMultiplier(grade, Math.round(v) / 100)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Global Adjustment + Recon + Floor/Ceiling ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-accent" />
          <h3 className="font-bold text-card-foreground">Global Controls</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Global % */}
          <div>
            <Label className="text-sm font-semibold">Global Adjustment %</Label>
            <p className="text-xs text-muted-foreground mb-2">Blanket % increase/decrease on all offers.</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={settings.global_adjustment_pct}
                onChange={(e) => setSettings({ ...settings, global_adjustment_pct: Number(e.target.value) })}
                className="w-28"
                step="0.5"
              />
              <span className="text-sm font-semibold text-muted-foreground">%</span>
            </div>
          </div>
          {/* Recon Cost */}
          <div>
            <Label className="text-sm font-semibold">Reconditioning Cost</Label>
            <p className="text-xs text-muted-foreground mb-2">Flat $ deducted from every offer (transport, detail, inspection).</p>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                value={settings.recon_cost}
                onChange={(e) => setSettings({ ...settings, recon_cost: Number(e.target.value) })}
                className="w-28"
                step="50"
              />
            </div>
          </div>
          {/* Offer Floor */}
          <div>
            <Label className="text-sm font-semibold">Offer Floor (Minimum)</Label>
            <p className="text-xs text-muted-foreground mb-2">No offer will go below this amount.</p>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                value={settings.offer_floor}
                onChange={(e) => setSettings({ ...settings, offer_floor: Number(e.target.value) })}
                className="w-28"
                step="100"
              />
            </div>
          </div>
          {/* Offer Ceiling */}
          <div>
            <Label className="text-sm font-semibold">Offer Ceiling (Maximum)</Label>
            <p className="text-xs text-muted-foreground mb-2">No offer will exceed this amount. Leave blank for no cap.</p>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                value={settings.offer_ceiling ?? ""}
                onChange={(e) => setSettings({ ...settings, offer_ceiling: e.target.value ? Number(e.target.value) : null })}
                className="w-28"
                step="1000"
                placeholder="No cap"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3b: Age-Based Tier Adjustments ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Age-Based Adjustments</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Automatically adjust offers based on vehicle age. Only the first matching tier is applied (ordered top to bottom).
        </p>
        <div className="space-y-2">
          {settings.age_tiers.map((tier, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30 border-border">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="number"
                  value={tier.min_years}
                  onChange={(e) => {
                    const updated = [...settings.age_tiers];
                    updated[idx] = { ...updated[idx], min_years: Number(e.target.value) };
                    setSettings({ ...settings, age_tiers: updated });
                  }}
                  className="w-20 h-8 text-sm"
                  min="0"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="number"
                  value={tier.max_years}
                  onChange={(e) => {
                    const updated = [...settings.age_tiers];
                    updated[idx] = { ...updated[idx], max_years: Number(e.target.value) };
                    setSettings({ ...settings, age_tiers: updated });
                  }}
                  className="w-20 h-8 text-sm"
                  min="0"
                />
                <span className="text-sm text-muted-foreground">years old →</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={tier.adjustment_pct}
                    onChange={(e) => {
                      const updated = [...settings.age_tiers];
                      updated[idx] = { ...updated[idx], adjustment_pct: Number(e.target.value) };
                      setSettings({ ...settings, age_tiers: updated });
                    }}
                    className="w-20 h-8 text-sm"
                    step="0.5"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">%</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {tier.adjustment_pct > 0 ? "↑ boost" : tier.adjustment_pct < 0 ? "↓ penalty" : "no change"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const updated = settings.age_tiers.filter((_, i) => i !== idx);
                  setSettings({ ...settings, age_tiers: updated });
                }}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1"
          onClick={() => {
            const lastMax = settings.age_tiers.length > 0
              ? settings.age_tiers[settings.age_tiers.length - 1].max_years + 1
              : 5;
            setSettings({
              ...settings,
              age_tiers: [...settings.age_tiers, { min_years: lastMax, max_years: lastMax + 4, adjustment_pct: -3 }],
            });
          }}
        >
          <Plus className="w-4 h-4" /> Add Tier
        </Button>
      </div>

      {/* ── Section 3c: Mileage-Based Tier Adjustments ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Mileage-Based Deductions</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Auto-deduct a flat dollar amount based on the vehicle's reported mileage. Only the first matching tier is applied.
        </p>
        <div className="space-y-2">
          {settings.mileage_tiers.map((tier, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30 border-border">
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <Input
                  type="number"
                  value={tier.min_miles}
                  onChange={(e) => {
                    const updated = [...settings.mileage_tiers];
                    updated[idx] = { ...updated[idx], min_miles: Number(e.target.value) };
                    setSettings({ ...settings, mileage_tiers: updated });
                  }}
                  className="w-28 h-8 text-sm"
                  min="0"
                  step="5000"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="number"
                  value={tier.max_miles}
                  onChange={(e) => {
                    const updated = [...settings.mileage_tiers];
                    updated[idx] = { ...updated[idx], max_miles: Number(e.target.value) };
                    setSettings({ ...settings, mileage_tiers: updated });
                  }}
                  className="w-28 h-8 text-sm"
                  min="0"
                  step="5000"
                />
                <span className="text-sm text-muted-foreground">miles →</span>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                  <Input
                    type="number"
                    value={tier.adjustment_flat}
                    onChange={(e) => {
                      const updated = [...settings.mileage_tiers];
                      updated[idx] = { ...updated[idx], adjustment_flat: Number(e.target.value) };
                      setSettings({ ...settings, mileage_tiers: updated });
                    }}
                    className="w-24 h-8 text-sm"
                    step="100"
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {tier.adjustment_flat > 0 ? "↑ boost" : tier.adjustment_flat < 0 ? "↓ deduct" : "no change"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const updated = settings.mileage_tiers.filter((_, i) => i !== idx);
                  setSettings({ ...settings, mileage_tiers: updated });
                }}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1"
          onClick={() => {
            const lastMax = settings.mileage_tiers.length > 0
              ? settings.mileage_tiers[settings.mileage_tiers.length - 1].max_miles + 1
              : 80000;
            setSettings({
              ...settings,
              mileage_tiers: [...settings.mileage_tiers, { min_miles: lastMax, max_miles: lastMax + 20000, adjustment_flat: -500 }],
            });
          }}
        >
          <Plus className="w-4 h-4" /> Add Tier
        </Button>
      </div>

      {/* ── Section 4: Deduction Toggles + Amounts ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-card-foreground">Condition Deductions</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Toggle which condition factors deduct from the offer and set the dollar amount for each.
        </p>
        <div className="space-y-3">
          {Object.entries(DEDUCTION_LABELS).map(([key, config]) => {
            const enabled = settings.deductions_config[key as keyof DeductionsConfig] ?? true;
            const amountKeys = Array.isArray(config.amountKey) ? config.amountKey : [config.amountKey];

            return (
              <div key={key} className={`rounded-lg border ${enabled ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 opacity-60"}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <Label htmlFor={`ded-${key}`} className="text-sm font-semibold cursor-pointer">{config.label}</Label>
                  <Switch id={`ded-${key}`} checked={enabled} onCheckedChange={() => toggleDeduction(key)} />
                </div>
                {enabled && (
                  <div className="px-4 pb-3 flex flex-wrap gap-3">
                    {amountKeys.map((amtKey) => (
                      <div key={amtKey} className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{AMOUNT_LABELS[amtKey] || amtKey}:</span>
                        <div className="flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3 text-muted-foreground" />
                          <Input
                            type="number"
                            value={settings.deduction_amounts[amtKey as keyof DeductionAmounts] ?? 0}
                            onChange={(e) => updateDeductionAmount(amtKey, Number(e.target.value))}
                            className="w-20 h-7 text-xs"
                            step="25"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      <Button onClick={handleSaveSettings} disabled={saving} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save All Settings"}
      </Button>

      {/* ── Offer Simulator ── */}
      <OfferSimulator
        settings={{
          bb_value_basis: settings.bb_value_basis,
          global_adjustment_pct: settings.global_adjustment_pct,
          deductions_config: settings.deductions_config,
          deduction_amounts: settings.deduction_amounts,
          condition_multipliers: settings.condition_multipliers,
          recon_cost: settings.recon_cost,
          offer_floor: settings.offer_floor,
          offer_ceiling: settings.offer_ceiling,
          age_tiers: settings.age_tiers,
          mileage_tiers: settings.mileage_tiers,
        }}
        rules={rules}
      />

      {/* ── Section 5: Criteria-Based Rules ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-card-foreground">Criteria-Based Rules</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => openNewRule("criteria")} className="gap-1">
            <Plus className="w-4 h-4" /> Add Rule
          </Button>
        </div>
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
      </div>

      {/* ── Section 6: Hot List ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border border-l-4 border-l-destructive/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-destructive" />
            <h3 className="font-bold text-card-foreground">Hot List — Cars We Want</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => openNewRule("hot_list")} className="gap-1">
            <Plus className="w-4 h-4" /> Add Vehicle
          </Button>
        </div>
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
      </div>

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
