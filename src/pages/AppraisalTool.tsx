import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Car, DollarSign, TrendingUp, TrendingDown, Minus, Target,
  Gauge, Wrench, ChevronDown, Save, AlertTriangle, CheckCircle, XCircle,
  Pencil, ArrowDown, Loader2, ClipboardCheck, BarChart3,
} from "lucide-react";
import ProfitSpreadGauge from "@/components/admin/ProfitSpreadGauge";
import { calculateOffer, type OfferSettings, type OfferRule, type OfferEstimate } from "@/lib/offerCalculator";
import type { FormData, BBVehicle } from "@/components/sell-form/types";

// ── Types ──
interface Submission {
  id: string;
  token: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  mileage: string | null;
  exterior_color: string | null;
  overall_condition: string | null;
  offered_price: number | null;
  estimated_offer_high: number | null;
  estimated_offer_low: number | null;
  acv_value: number | null;
  bb_tradein_avg: number | null;
  bb_wholesale_avg: number | null;
  bb_retail_avg: number | null;
  bb_msrp: number | null;
  bb_mileage_adj: number | null;
  bb_regional_adj: number | null;
  bb_base_whole_avg: number | null;
  bb_add_deducts: any;
  bb_class_name: string | null;
  bb_drivetrain: string | null;
  bb_transmission: string | null;
  bb_fuel_type: string | null;
  bb_engine: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  progress_status: string;
  accidents: string | null;
  drivable: string | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  exterior_damage: string[] | null;
  interior_damage: string[] | null;
  windshield_damage: string | null;
  moonroof: string | null;
  tech_issues: string[] | null;
  engine_issues: string[] | null;
  mechanical_issues: string[] | null;
  modifications: string | null;
  drivetrain: string | null;
  internal_notes: string | null;
  tire_lf: number | null;
  tire_rf: number | null;
  tire_lr: number | null;
  tire_rr: number | null;
  tire_adjustment: number | null;
  ai_condition_score: string | null;
  ai_damage_summary: string | null;
  appraised_by: string | null;
  zip: string | null;
}

// ── Waterfall Block ──
interface WaterfallBlock {
  id: string;
  label: string;
  value: number;
  runningTotal: number;
  type: "base" | "add" | "subtract" | "total";
  editable: boolean;
  editKey?: string;
  editType?: "flat" | "pct" | "multiplier";
  currentEditValue?: number;
}

const WaterfallBlockRow = ({
  block, maxVal, onValueChange, isExpanded, onToggleExpand,
}: {
  block: WaterfallBlock; maxVal: number;
  onValueChange?: (editKey: string, value: number, editType: string) => void;
  isExpanded: boolean; onToggleExpand: () => void;
}) => {
  const barWidth = maxVal > 0 ? Math.abs(block.type === "total" || block.type === "base" ? block.runningTotal : block.value) / maxVal * 100 : 0;
  const isBase = block.type === "base";
  const isTotal = block.type === "total";
  const isPositive = block.type === "add";
  const isNegative = block.type === "subtract";
  const barColor = isBase ? "bg-primary/25 border-primary/40" : isTotal ? "bg-primary border-primary/60" : isPositive ? "bg-emerald-500/25 border-emerald-500/40" : "bg-destructive/25 border-destructive/40";
  const textColor = isTotal ? "text-primary-foreground" : isBase ? "text-primary" : isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-destructive";

  return (
    <div className="group">
      <button onClick={block.editable ? onToggleExpand : undefined}
        className={`flex items-center gap-2 w-full text-left transition-all rounded-md px-1 py-0.5 ${block.editable ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"} ${isExpanded ? "bg-muted/50" : ""}`}>
        <div className="w-4 shrink-0 flex items-center justify-center">
          {block.editable && <Pencil className={`w-2.5 h-2.5 transition-opacity ${isExpanded ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"}`} />}
        </div>
        <div className="w-28 shrink-0 text-right pr-1">
          <span className={`text-[11px] leading-tight ${isTotal ? "font-bold text-card-foreground" : "text-muted-foreground"}`}>{block.label}</span>
        </div>
        <div className="flex-1 h-7 relative rounded-sm overflow-hidden bg-muted/20">
          <div className={`h-full rounded-sm border flex items-center transition-all duration-300 ${barColor}`} style={{ width: `${Math.max(barWidth, 4)}%` }}>
            <span className={`text-[11px] font-bold px-2 truncate whitespace-nowrap ${textColor}`}>
              {isBase || isTotal ? `$${block.runningTotal.toLocaleString()}` : `${block.value >= 0 ? "+" : ""}$${block.value.toLocaleString()}`}
            </span>
          </div>
        </div>
        <div className="w-4 shrink-0">
          {isPositive && <TrendingUp className="w-3 h-3 text-emerald-500" />}
          {isNegative && <TrendingDown className="w-3 h-3 text-destructive" />}
          {(isBase || isTotal) && <Minus className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>
      {isExpanded && block.editable && block.editKey && onValueChange && (
        <div className="ml-6 mr-6 mt-1 mb-2 p-2 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-semibold text-muted-foreground shrink-0">
              {block.editType === "pct" ? "%" : block.editType === "multiplier" ? "×" : "$"}
            </Label>
            <Input type="number" value={block.currentEditValue ?? 0}
              onChange={e => onValueChange(block.editKey!, Number(e.target.value), block.editType || "flat")}
              className="h-7 text-sm w-28"
              step={block.editType === "multiplier" ? "0.01" : block.editType === "pct" ? "0.5" : "50"} autoFocus />
            <Slider
              value={[block.editType === "multiplier" ? (block.currentEditValue ?? 1) * 100 : block.currentEditValue ?? 0]}
              min={block.editType === "multiplier" ? 50 : block.editType === "pct" ? -30 : 0}
              max={block.editType === "multiplier" ? 130 : block.editType === "pct" ? 30 : 10000}
              step={block.editType === "multiplier" ? 1 : block.editType === "pct" ? 0.5 : 25}
              onValueChange={([v]) => onValueChange(block.editKey!, block.editType === "multiplier" ? v / 100 : v, block.editType || "flat")}
              className="flex-1" />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Condition Issue Row ──
const IssueRow = ({ label, value, isIssue }: { label: string; value: string; isIssue: boolean }) => (
  <div className="flex items-center justify-between py-1 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1">
      {isIssue ? <AlertTriangle className="w-3 h-3 text-amber-500" /> : <CheckCircle className="w-3 h-3 text-green-500" />}
      <span className={`text-xs font-medium ${isIssue ? "text-amber-600" : "text-green-600"}`}>{value}</span>
    </div>
  </div>
);

// ── Tire Depth Visual ──
const TireDepthDisplay = ({ label, depth }: { label: string; depth: number | null }) => {
  if (depth == null) return null;
  const color = depth >= 6 ? "text-green-600 bg-green-500/10" : depth >= 4 ? "text-amber-600 bg-amber-500/10" : "text-destructive bg-destructive/10";
  return (
    <div className={`rounded-lg p-2 text-center ${color}`}>
      <div className="text-[10px] font-medium opacity-70">{label}</div>
      <div className="text-lg font-bold">{depth}<span className="text-[10px]">/32"</span></div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
export default function AppraisalTool() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<Submission | null>(null);
  const [settings, setSettings] = useState<OfferSettings | null>(null);
  const [rules, setRules] = useState<OfferRule[]>([]);
  const [dealerPack, setDealerPack] = useState(0);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  // Editable overrides
  const [reconOverride, setReconOverride] = useState<number | null>(null);
  const [dealerPackOverride, setDealerPackOverride] = useState<number | null>(null);
  const [acvOverride, setAcvOverride] = useState<number | null>(null);
  const [conditionMultOverride, setConditionMultOverride] = useState<Record<string, number>>({});

  // Load data
  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      // Fetch submission by token
      const { data: subData } = await supabase
        .from("submissions")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (!subData) {
        toast({ title: "Not Found", description: "Submission not found.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setSub(subData as any);
      setAcvOverride(subData.acv_value ?? null);

      // Fetch offer settings
      const { data: settingsData } = await supabase
        .from("offer_settings")
        .select("*")
        .eq("dealership_id", "default")
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData as any);
        setDealerPack((settingsData as any).dealer_pack ?? 0);
        setReconOverride(settingsData.recon_cost);
      }

      // Fetch rules
      const { data: rulesData } = await supabase
        .from("offer_rules")
        .select("*")
        .eq("dealership_id", "default")
        .eq("is_active", true);

      if (rulesData) setRules(rulesData as any);
      setLoading(false);
    };
    load();
  }, [token]);

  // Reconstruct a BBVehicle from stored submission data for offer calc
  const bbVehicle: BBVehicle | null = useMemo(() => {
    if (!sub || !sub.bb_tradein_avg) return null;
    return {
      year: sub.vehicle_year || "",
      make: sub.vehicle_make || "",
      model: sub.vehicle_model || "",
      series: "",
      style: "",
      uvc: "",
      vin: sub.vin || "",
      price_includes: "",
      exterior_colors: [],
      class_name: sub.bb_class_name || "",
      drivetrain: sub.bb_drivetrain || "",
      engine: sub.bb_engine || "",
      transmission: sub.bb_transmission || "",
      fuel_type: sub.bb_fuel_type || "",
      msrp: Number(sub.bb_msrp || 0),
      wholesale: {
        avg: sub.bb_wholesale_avg || 0,
        clean: 0, rough: 0, xclean: 0,
      },
      tradein: {
        avg: sub.bb_tradein_avg || 0,
        clean: 0, rough: 0,
      },
      retail: {
        avg: sub.bb_retail_avg || 0,
        clean: 0, rough: 0, xclean: 0,
      },
      mileage_adj: sub.bb_mileage_adj || 0,
      regional_adj: sub.bb_regional_adj || 0,
      base_whole_avg: sub.bb_base_whole_avg || 0,
      add_deduct_list: Array.isArray(sub.bb_add_deducts) ? sub.bb_add_deducts : [],
    };
  }, [sub]);

  // Build form data from submission for offer calc
  const formData: FormData | null = useMemo(() => {
    if (!sub) return null;
    return {
      plate: "", state: sub.zip || "", vin: sub.vin || "",
      mileage: sub.mileage || "0",
      bbUvc: "", bbSelectedAddDeducts: [],
      exteriorColor: sub.exterior_color || "",
      drivetrain: sub.drivetrain || "",
      modifications: sub.modifications || "",
      overallCondition: sub.overall_condition || "good",
      exteriorDamage: (sub.exterior_damage || []).filter(d => d !== "none"),
      windshieldDamage: sub.windshield_damage || "",
      moonroof: sub.moonroof || "",
      interiorDamage: (sub.interior_damage || []).filter(d => d !== "none"),
      techIssues: (sub.tech_issues || []).filter(d => d !== "none"),
      engineIssues: (sub.engine_issues || []).filter(d => d !== "none"),
      mechanicalIssues: (sub.mechanical_issues || []).filter(d => d !== "none"),
      drivable: sub.drivable || "yes",
      accidents: sub.accidents || "0",
      smokedIn: sub.smoked_in || "no",
      tiresReplaced: sub.tires_replaced || "yes",
      numKeys: sub.num_keys || "2",
      name: sub.name || "", phone: sub.phone || "", email: sub.email || "",
      zip: sub.zip || "",
      loanStatus: "", loanCompany: "", loanBalance: "", loanPayment: "",
      nextStep: "", preferredLocationId: "", salespersonName: "",
    };
  }, [sub]);

  // Apply overrides to settings for calculation
  const activeSettings: OfferSettings | null = useMemo(() => {
    if (!settings) return null;
    return {
      ...settings,
      recon_cost: reconOverride ?? settings.recon_cost,
      condition_multipliers: {
        ...settings.condition_multipliers,
        ...conditionMultOverride,
      },
    };
  }, [settings, reconOverride, conditionMultOverride]);

  // Calculate offer
  const offerResult = useMemo(() => {
    if (!bbVehicle || !formData || !activeSettings) return null;
    return calculateOffer(bbVehicle, formData, [], activeSettings, rules);
  }, [bbVehicle, formData, activeSettings, rules]);

  // Effective values
  const currentOffer = sub?.offered_price || sub?.estimated_offer_high || 0;
  const acv = acvOverride ?? sub?.acv_value ?? 0;
  const effectiveRecon = reconOverride ?? settings?.recon_cost ?? 0;
  const effectivePack = dealerPackOverride ?? dealerPack;
  const retailAvg = sub?.bb_retail_avg || 0;
  const wholesaleAvg = sub?.bb_wholesale_avg || 0;
  const tradeinAvg = sub?.bb_tradein_avg || 0;

  // Profit HUD calculations
  const projectedProfit = retailAvg > 0 ? retailAvg - acv - effectiveRecon - effectivePack : 0;
  const profitMargin = retailAvg > 0 ? (projectedProfit / retailAvg) * 100 : 0;
  const spreadVsOffer = acv > 0 ? acv - currentOffer : 0;

  // Build waterfall blocks
  const waterfallBlocks: WaterfallBlock[] = useMemo(() => {
    if (!offerResult || !activeSettings) return [];
    const blocks: WaterfallBlock[] = [];
    let running = offerResult.baseValue;
    const cond = sub?.overall_condition || "good";
    const condMult = activeSettings.condition_multipliers?.[cond as keyof typeof activeSettings.condition_multipliers] ?? 1;

    blocks.push({ id: "base", label: "Base Value", value: running, runningTotal: running, type: "base", editable: false });

    const condAdj = Math.round(offerResult.baseValue * condMult) - offerResult.baseValue;
    running += condAdj;
    blocks.push({
      id: "condition", label: `Condition (${cond})`, value: condAdj, runningTotal: running,
      type: condAdj >= 0 ? "add" : "subtract", editable: true,
      editKey: "condition_multiplier", editType: "multiplier",
      currentEditValue: conditionMultOverride[cond] ?? condMult,
    });

    if (offerResult.totalDeductions > 0) {
      running -= offerResult.totalDeductions;
      blocks.push({ id: "deductions", label: "Deductions", value: -offerResult.totalDeductions, runningTotal: running, type: "subtract", editable: false });
    }

    if (effectiveRecon > 0) {
      running -= effectiveRecon;
      blocks.push({
        id: "recon", label: "Recon Cost", value: -effectiveRecon, runningTotal: running,
        type: "subtract", editable: true, editKey: "recon_cost", editType: "flat",
        currentEditValue: effectiveRecon,
      });
    }

    if (effectivePack > 0) {
      running -= effectivePack;
      blocks.push({
        id: "dealer_pack", label: "Dealer Pack", value: -effectivePack, runningTotal: running,
        type: "subtract", editable: true, editKey: "dealer_pack", editType: "flat",
        currentEditValue: effectivePack,
      });
    }

    if (sub?.tire_adjustment && sub.tire_adjustment !== 0) {
      running += Number(sub.tire_adjustment);
      blocks.push({
        id: "tire_adj", label: "Tire Adjustment", value: Number(sub.tire_adjustment), runningTotal: running,
        type: Number(sub.tire_adjustment) >= 0 ? "add" : "subtract", editable: false,
      });
    }

    blocks.push({ id: "final", label: "APPRAISED VALUE", value: running, runningTotal: running, type: "total", editable: false });
    return blocks;
  }, [offerResult, activeSettings, sub, effectiveRecon, effectivePack, conditionMultOverride]);

  const maxVal = Math.max(...waterfallBlocks.map(s => Math.max(Math.abs(s.runningTotal), Math.abs(s.value))), 1);

  const handleBlockValueChange = useCallback((editKey: string, value: number, editType: string) => {
    if (editKey === "recon_cost") setReconOverride(value);
    else if (editKey === "dealer_pack") setDealerPackOverride(value);
    else if (editKey === "condition_multiplier") {
      const cond = sub?.overall_condition || "good";
      setConditionMultOverride(prev => ({ ...prev, [cond]: value }));
    }
  }, [sub]);

  // Parse inspection data from internal notes
  const inspectionData = useMemo(() => {
    if (!sub?.internal_notes) return null;
    const match = sub.internal_notes.match(/\[INSPECTION[^\]]*\]([\s\S]*?)(?=\[|$)/);
    return match ? match[0] : null;
  }, [sub]);

  // Save ACV
  const handleSave = async () => {
    if (!sub) return;
    setSaving(true);
    const finalAcv = waterfallBlocks.find(b => b.id === "final")?.runningTotal ?? acv;
    const { error } = await supabase.from("submissions").update({
      acv_value: finalAcv,
    }).eq("id", sub.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSub(prev => prev ? { ...prev, acv_value: finalAcv } : prev);
      setAcvOverride(finalAcv);
      toast({ title: "ACV Saved", description: `Appraised value set to $${finalAcv.toLocaleString()}` });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <XCircle className="w-12 h-12 text-destructive" />
        <p className="text-lg text-muted-foreground">Submission not found</p>
        <Button onClick={() => navigate("/admin")}>Back to Dashboard</Button>
      </div>
    );
  }

  const hasInspection = !!(sub.tire_lf || sub.tire_rf || sub.tire_lr || sub.tire_rr || inspectionData);
  const hasTires = !!(sub.tire_lf && sub.tire_rf && sub.tire_lr && sub.tire_rr);
  const avgTireDepth = hasTires ? ((sub.tire_lf! + sub.tire_rf! + sub.tire_lr! + sub.tire_rr!) / 4).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-primary-foreground hover:bg-primary-foreground/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-wide">
                Appraisal Tool — {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}
              </h1>
              <p className="text-primary-foreground/70 text-sm">
                {sub.name} • {sub.vin || "No VIN"} • {sub.mileage ? `${Number(sub.mileage).toLocaleString()} mi` : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save ACV
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* ═══ PROFIT HUD ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Customer Offer</div>
            <div className="text-2xl font-bold text-card-foreground">${currentOffer.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center shadow-sm">
            <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">ACV / Appraised</div>
            <div className="text-2xl font-bold text-primary">
              ${(waterfallBlocks.find(b => b.id === "final")?.runningTotal ?? acv).toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Market (Retail Avg)</div>
            <div className="text-2xl font-bold text-card-foreground">${retailAvg.toLocaleString()}</div>
          </div>
          <div className={`rounded-xl border p-4 text-center shadow-sm ${projectedProfit >= 0 ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Projected Profit</div>
            <div className={`text-2xl font-bold ${projectedProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {projectedProfit >= 0 ? "+" : ""}${projectedProfit.toLocaleString()}
            </div>
          </div>
          <div className={`rounded-xl border p-4 text-center shadow-sm ${profitMargin >= 0 ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Margin %</div>
            <div className={`text-2xl font-bold ${profitMargin >= 0 ? "text-green-600" : "text-destructive"}`}>
              {profitMargin.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* ═══ TWO-COLUMN LAYOUT ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* ── LEFT: Waterfall + Adjustments ── */}
          <div className="space-y-5">
            {/* Vehicle Summary */}
            <div className="bg-muted/40 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Car className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-card-foreground">
                  {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}
                </span>
                {sub.bb_class_name && <Badge variant="secondary" className="text-[9px]">{sub.bb_class_name}</Badge>}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                <div><span className="text-muted-foreground">VIN:</span> <span className="font-medium text-card-foreground font-mono text-[10px]">{sub.vin || "—"}</span></div>
                <div><span className="text-muted-foreground">Mileage:</span> <span className="font-medium text-card-foreground">{sub.mileage ? `${Number(sub.mileage).toLocaleString()}` : "—"}</span></div>
                <div><span className="text-muted-foreground">Drivetrain:</span> <span className="font-medium text-card-foreground">{sub.bb_drivetrain || sub.drivetrain || "—"}</span></div>
                <div><span className="text-muted-foreground">Engine:</span> <span className="font-medium text-card-foreground">{sub.bb_engine || "—"}</span></div>
                <div><span className="text-muted-foreground">Trans:</span> <span className="font-medium text-card-foreground">{sub.bb_transmission || "—"}</span></div>
                <div><span className="text-muted-foreground">Color:</span> <span className="font-medium text-card-foreground">{sub.exterior_color || "—"}</span></div>
              </div>
            </div>

            {/* Price Waterfall */}
            <div className="rounded-xl border border-border p-4 bg-gradient-to-b from-muted/20 to-transparent">
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowDown className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">Appraisal Waterfall — Click to Adjust</span>
              </div>
              <div className="space-y-0.5">
                {waterfallBlocks.map(block => (
                  <WaterfallBlockRow key={block.id} block={block} maxVal={maxVal}
                    onValueChange={handleBlockValueChange}
                    isExpanded={expandedBlock === block.id}
                    onToggleExpand={() => setExpandedBlock(prev => prev === block.id ? null : block.id)} />
                ))}
              </div>
            </div>

            {/* Profit Spread Gauge */}
            {retailAvg > 0 && wholesaleAvg > 0 && (
              <div className="rounded-xl border border-border p-4">
                <ProfitSpreadGauge
                  offerHigh={waterfallBlocks.find(b => b.id === "final")?.runningTotal ?? acv}
                  wholesaleAvg={wholesaleAvg}
                  tradeinAvg={tradeinAvg}
                  retailAvg={retailAvg}
                  retailClean={0}
                  msrp={sub.bb_msrp || 0}
                />
              </div>
            )}

            {/* Quick ACV Entry */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">Manual ACV Override</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input type="number" value={acvOverride ?? ""} onChange={e => setAcvOverride(e.target.value ? Number(e.target.value) : null)}
                    placeholder="Enter final ACV" className="h-10 text-lg font-bold" />
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
              {sub.appraised_by && (
                <p className="text-[10px] text-muted-foreground mt-1">Last appraised by: {sub.appraised_by}</p>
              )}
            </div>
          </div>

          {/* ── RIGHT: Condition, Inspection, Market Context ── */}
          <div className="space-y-5">
            {/* Customer-Reported Condition */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-primary" />
                  Customer-Reported Condition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <IssueRow label="Overall" value={sub.overall_condition || "Not specified"} isIssue={sub.overall_condition === "fair" || sub.overall_condition === "rough"} />
                <IssueRow label="Accidents" value={sub.accidents || "None"} isIssue={!!sub.accidents && sub.accidents !== "0" && sub.accidents !== "none"} />
                <IssueRow label="Drivable" value={sub.drivable || "Yes"} isIssue={sub.drivable === "no"} />
                <IssueRow label="Smoked In" value={sub.smoked_in || "No"} isIssue={sub.smoked_in === "yes"} />
                <IssueRow label="Tires Replaced" value={sub.tires_replaced || "—"} isIssue={sub.tires_replaced === "no" || sub.tires_replaced === "0"} />
                <IssueRow label="Keys" value={sub.num_keys ? `${sub.num_keys} key(s)` : "—"} isIssue={sub.num_keys === "0" || sub.num_keys === "1"} />
                <IssueRow label="Windshield" value={sub.windshield_damage || "None"} isIssue={!!sub.windshield_damage && sub.windshield_damage !== "none" && sub.windshield_damage !== ""} />
                {(sub.exterior_damage?.filter(d => d !== "none").length || 0) > 0 && (
                  <IssueRow label="Exterior Damage" value={sub.exterior_damage!.filter(d => d !== "none").join(", ")} isIssue={true} />
                )}
                {(sub.interior_damage?.filter(d => d !== "none").length || 0) > 0 && (
                  <IssueRow label="Interior Damage" value={sub.interior_damage!.filter(d => d !== "none").join(", ")} isIssue={true} />
                )}
                {(sub.engine_issues?.filter(d => d !== "none").length || 0) > 0 && (
                  <IssueRow label="Engine Issues" value={sub.engine_issues!.filter(d => d !== "none").join(", ")} isIssue={true} />
                )}
                {(sub.mechanical_issues?.filter(d => d !== "none").length || 0) > 0 && (
                  <IssueRow label="Mechanical" value={sub.mechanical_issues!.filter(d => d !== "none").join(", ")} isIssue={true} />
                )}
                {(sub.tech_issues?.filter(d => d !== "none").length || 0) > 0 && (
                  <IssueRow label="Tech Issues" value={sub.tech_issues!.filter(d => d !== "none").join(", ")} isIssue={true} />
                )}
              </CardContent>
            </Card>

            {/* AI Damage Summary */}
            {sub.ai_damage_summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-primary" />
                    AI Damage Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={sub.ai_condition_score === "poor" || sub.ai_condition_score === "fair" ? "destructive" : "secondary"}>
                      {sub.ai_condition_score || "N/A"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{sub.ai_damage_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Inspection Data */}
            {hasInspection && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-primary" />
                    Inspection Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Tire Depths */}
                  {hasTires && (
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Tire Tread Depth</div>
                      <div className="grid grid-cols-4 gap-2">
                        <TireDepthDisplay label="LF" depth={sub.tire_lf} />
                        <TireDepthDisplay label="RF" depth={sub.tire_rf} />
                        <TireDepthDisplay label="LR" depth={sub.tire_lr} />
                        <TireDepthDisplay label="RR" depth={sub.tire_rr} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 px-1">
                        <span className="text-[10px] text-muted-foreground">Avg: {avgTireDepth}/32"</span>
                        {sub.tire_adjustment != null && sub.tire_adjustment !== 0 && (
                          <span className={`text-[10px] font-bold ${Number(sub.tire_adjustment) >= 0 ? "text-green-600" : "text-destructive"}`}>
                            Tire Adj: {Number(sub.tire_adjustment) >= 0 ? "+" : ""}${Number(sub.tire_adjustment).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inspection Notes */}
                  {inspectionData && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center justify-between w-full text-left text-xs text-muted-foreground hover:text-card-foreground">
                          <span className="font-semibold">Inspection Notes</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 mt-1 max-h-40 overflow-y-auto">
                          {inspectionData}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Market Values */}
            {(retailAvg > 0 || wholesaleAvg > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                    Black Book Values
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {sub.bb_msrp && Number(sub.bb_msrp) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">MSRP</span>
                      <span className="font-bold">${Number(sub.bb_msrp).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Retail Avg</span>
                    <span className="font-bold text-green-600">${retailAvg.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Trade-In Avg</span>
                    <span className="font-bold text-primary">${tradeinAvg.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Wholesale Avg</span>
                    <span className="font-bold text-blue-600">${wholesaleAvg.toLocaleString()}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Customer Offer</span>
                    <span className="font-bold">${currentOffer.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Spread (ACV vs Offer)</span>
                    <span className={`font-bold ${spreadVsOffer >= 0 ? "text-amber-600" : "text-green-600"}`}>
                      {spreadVsOffer >= 0 ? "+" : ""}${spreadVsOffer.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Costs Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  Cost Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Recon Cost</span>
                  <span className="font-bold text-destructive">−${effectiveRecon.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Dealer Pack</span>
                  <span className="font-bold text-destructive">−${effectivePack.toLocaleString()}</span>
                </div>
                {offerResult && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Condition Deductions</span>
                    <span className="font-bold text-destructive">−${offerResult.totalDeductions.toLocaleString()}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-card-foreground">Total Costs</span>
                  <span className="font-bold text-destructive">−${(effectiveRecon + effectivePack + (offerResult?.totalDeductions || 0)).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
