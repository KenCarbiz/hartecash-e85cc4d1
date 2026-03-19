import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save, Plus, Trash2, Flame, SlidersHorizontal, Target, Zap, AlertTriangle } from "lucide-react";

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

interface OfferSettingsRow {
  id: string;
  dealership_id: string;
  bb_value_basis: string;
  global_adjustment_pct: number;
  deductions_config: DeductionsConfig;
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

const DEDUCTION_LABELS: Record<string, string> = {
  accidents: "Accidents",
  exterior_damage: "Exterior Damage",
  interior_damage: "Interior Damage",
  windshield_damage: "Windshield Damage",
  engine_issues: "Engine Issues",
  mechanical_issues: "Mechanical Issues",
  tech_issues: "Technology Issues",
  not_drivable: "Not Drivable",
  smoked_in: "Smoked In",
  tires_not_replaced: "Tires Not Replaced",
  missing_keys: "Missing Keys",
};

const DEFAULT_DEDUCTIONS: DeductionsConfig = {
  accidents: true,
  exterior_damage: true,
  interior_damage: true,
  windshield_damage: true,
  engine_issues: true,
  mechanical_issues: true,
  tech_issues: true,
  not_drivable: true,
  smoked_in: true,
  tires_not_replaced: true,
  missing_keys: true,
};

const emptyRule: Omit<OfferRule, "id" | "dealership_id"> = {
  name: "",
  rule_type: "criteria",
  criteria: {},
  adjustment_pct: 0,
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

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [settingsRes, rulesRes] = await Promise.all([
      supabase.from("offer_settings" as any).select("*").eq("dealership_id", "default").maybeSingle(),
      supabase.from("offer_rules" as any).select("*").eq("dealership_id", "default").order("priority", { ascending: false }),
    ]);

    if (settingsRes.data) {
      setSettings(settingsRes.data as unknown as OfferSettingsRow);
    }
    if (rulesRes.data) {
      setRules(rulesRes.data as unknown as OfferRule[]);
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
      deductions_config: {
        ...settings.deductions_config,
        [key]: !settings.deductions_config[key as keyof DeductionsConfig],
      },
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
    setEditingRule({
      ...editingRule,
      criteria: { ...editingRule.criteria, [key]: value },
    });
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading offer settings…</div>;
  }

  if (!settings) {
    return <div className="text-center py-12 text-muted-foreground">No settings found.</div>;
  }

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
        <Select
          value={settings.bb_value_basis}
          onValueChange={(v) => setSettings({ ...settings, bb_value_basis: v })}
        >
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BB_VALUE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Section 2: Global Adjustment ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-accent" />
          <h3 className="font-bold text-card-foreground">Global Adjustment</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Apply a blanket percentage increase or decrease to all calculated offers.
        </p>
        <div className="flex items-center gap-3 max-w-sm">
          <Input
            type="number"
            value={settings.global_adjustment_pct}
            onChange={(e) => setSettings({ ...settings, global_adjustment_pct: Number(e.target.value) })}
            className="w-28"
            step="0.5"
          />
          <span className="text-sm font-semibold text-muted-foreground">%</span>
          <span className="text-xs text-muted-foreground">
            {settings.global_adjustment_pct > 0 ? "(increases all offers)" : settings.global_adjustment_pct < 0 ? "(decreases all offers)" : "(no change)"}
          </span>
        </div>
      </div>

      {/* ── Section 3: Deduction Toggles ── */}
      <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-card-foreground">Condition Deductions</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Toggle which condition factors deduct from the offer. Disabled items will not affect the calculated price.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(DEDUCTION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
              <Label htmlFor={`ded-${key}`} className="text-sm cursor-pointer">{label}</Label>
              <Switch
                id={`ded-${key}`}
                checked={settings.deductions_config[key as keyof DeductionsConfig] ?? true}
                onCheckedChange={() => toggleDeduction(key)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save button for settings */}
      <Button onClick={handleSaveSettings} disabled={saving} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save Settings"}
      </Button>

      {/* ── Section 4: Criteria-Based Rules ── */}
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
          Adjust offers automatically based on vehicle attributes like year, mileage, make/model, or condition.
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

      {/* ── Section 5: Hot List ── */}
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
                  <Input
                    type="number"
                    value={editingRule.criteria?.year_min || ""}
                    onChange={(e) => updateCriteria("year_min", e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Any"
                  />
                </div>
                <div>
                  <Label>Year Max</Label>
                  <Input
                    type="number"
                    value={editingRule.criteria?.year_max || ""}
                    onChange={(e) => updateCriteria("year_max", e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Any"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mileage Min</Label>
                  <Input
                    type="number"
                    value={editingRule.criteria?.mileage_min || ""}
                    onChange={(e) => updateCriteria("mileage_min", e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Any"
                  />
                </div>
                <div>
                  <Label>Mileage Max</Label>
                  <Input
                    type="number"
                    value={editingRule.criteria?.mileage_max || ""}
                    onChange={(e) => updateCriteria("mileage_max", e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Any"
                  />
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

              <div>
                <Label>Adjustment %</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    value={editingRule.adjustment_pct || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, adjustment_pct: Number(e.target.value) })}
                    className="w-28"
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
  rule,
  onEdit,
  onDelete,
  onToggle,
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

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border ${rule.is_active ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 opacity-60"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {rule.rule_type === "hot_list" && rule.flag_in_dashboard && <span>🔥</span>}
          <span className="font-semibold text-sm text-card-foreground">{rule.name}</span>
          <Badge variant={rule.adjustment_pct > 0 ? "default" : rule.adjustment_pct < 0 ? "destructive" : "secondary"} className="text-xs">
            {rule.adjustment_pct > 0 ? "+" : ""}{rule.adjustment_pct}%
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
