import { useState, useMemo, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Calculator, TrendingDown, TrendingUp, Minus, ArrowRight, Search, Loader2, Car, CheckSquare,
  SlidersHorizontal, Gauge, Zap, AlertTriangle, DollarSign, ChevronDown, Calendar, Plus, Trash2,
  Layers, ArrowDown, GripVertical, Pencil, X, Check,
} from "lucide-react";
import { calculateOffer, type OfferSettings, type OfferRule, type OfferEstimate } from "@/lib/offerCalculator";
import type { FormData, BBVehicle, BBAddDeduct } from "@/components/sell-form/types";
import { supabase } from "@/integrations/supabase/client";
import ProfitSpreadGauge from "./ProfitSpreadGauge";
import MarketContextPanel from "./MarketContextPanel";
import RetailMarketPanel from "./RetailMarketPanel";
import { useToast } from "@/hooks/use-toast";

interface Props {
  settings: OfferSettings;
  savedSettings: OfferSettings | null;
  rules: OfferRule[];
  inlineControls?: boolean;
  onSettingsChange?: (settings: OfferSettings) => void;
}

const CONDITIONS = ["excellent", "very_good", "good", "fair"] as const;
const CONDITION_LABELS: Record<string, string> = {
  excellent: "Excellent",
  very_good: "Very Good",
  good: "Good",
  fair: "Fair",
};

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

const BB_CATEGORIES = [
  {
    label: "Wholesale",
    tiers: [
      { key: "wholesale_xclean", short: "X-Clean", tierKey: "xclean" },
      { key: "wholesale_clean", short: "Clean", tierKey: "clean" },
      { key: "wholesale_avg", short: "Avg", tierKey: "avg" },
      { key: "wholesale_rough", short: "Rough", tierKey: "rough" },
    ],
    dataKey: "wholesale" as const,
  },
  {
    label: "Trade-In",
    tiers: [
      { key: "tradein_clean", short: "Clean", tierKey: "clean" },
      { key: "tradein_avg", short: "Avg", tierKey: "avg" },
      { key: "tradein_rough", short: "Rough", tierKey: "rough" },
    ],
    dataKey: "tradein" as const,
  },
  {
    label: "Retail",
    tiers: [
      { key: "retail_xclean", short: "X-Clean", tierKey: "xclean" },
      { key: "retail_clean", short: "Clean", tierKey: "clean" },
      { key: "retail_avg", short: "Avg", tierKey: "avg" },
      { key: "retail_rough", short: "Rough", tierKey: "rough" },
    ],
    dataKey: "retail" as const,
  },
];

const DEDUCTION_LABELS: Record<string, { label: string; amountKeys: string[] }> = {
  accidents: { label: "Accidents", amountKeys: ["accidents_1", "accidents_2", "accidents_3plus"] },
  exterior_damage: { label: "Exterior Damage", amountKeys: ["exterior_damage_per_item"] },
  interior_damage: { label: "Interior Damage", amountKeys: ["interior_damage_per_item"] },
  windshield_damage: { label: "Windshield", amountKeys: ["windshield_cracked", "windshield_chipped"] },
  engine_issues: { label: "Engine Issues", amountKeys: ["engine_issue_per_item"] },
  mechanical_issues: { label: "Mechanical", amountKeys: ["mechanical_issue_per_item"] },
  tech_issues: { label: "Tech Issues", amountKeys: ["tech_issue_per_item"] },
  not_drivable: { label: "Not Drivable", amountKeys: ["not_drivable"] },
  smoked_in: { label: "Smoked In", amountKeys: ["smoked_in"] },
  tires_not_replaced: { label: "Tires", amountKeys: ["tires_not_replaced"] },
  missing_keys: { label: "Keys", amountKeys: ["missing_keys_1", "missing_keys_0"] },
};

const AMOUNT_SHORT: Record<string, string> = {
  accidents_1: "1x", accidents_2: "2x", accidents_3plus: "3+",
  exterior_damage_per_item: "/ea", interior_damage_per_item: "/ea",
  windshield_cracked: "crack", windshield_chipped: "chip",
  engine_issue_per_item: "/ea", mechanical_issue_per_item: "/ea", tech_issue_per_item: "/ea",
  not_drivable: "flat", smoked_in: "flat", tires_not_replaced: "flat",
  missing_keys_1: "1key", missing_keys_0: "0key",
};

// ═══════════════════════════════════════════════════════════════
// INTERACTIVE WATERFALL BLOCK
// Each step in the pricing calculation is an editable block
// ═══════════════════════════════════════════════════════════════

interface WaterfallBlock {
  id: string;
  label: string;
  value: number;
  runningTotal: number;
  type: "base" | "add" | "subtract" | "total";
  editable: boolean;
  editKey?: string; // which setting key to modify
  editType?: "flat" | "pct" | "multiplier";
  currentEditValue?: number;
}

const InteractiveWaterfallBlock = ({
  block,
  maxVal,
  onValueChange,
  isExpanded,
  onToggleExpand,
}: {
  block: WaterfallBlock;
  maxVal: number;
  onValueChange?: (editKey: string, value: number, editType: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) => {
  const barWidth = maxVal > 0 ? Math.abs(block.type === "total" || block.type === "base" ? block.runningTotal : block.value) / maxVal * 100 : 0;
  const isBase = block.type === "base";
  const isTotal = block.type === "total";
  const isPositive = block.type === "add";
  const isNegative = block.type === "subtract";

  const barColor = isBase
    ? "bg-primary/25 border-primary/40"
    : isTotal
    ? "bg-primary border-primary/60"
    : isPositive
    ? "bg-emerald-500/25 border-emerald-500/40"
    : "bg-destructive/25 border-destructive/40";

  const textColor = isTotal
    ? "text-primary-foreground"
    : isBase
    ? "text-primary"
    : isPositive
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-destructive";

  return (
    <div className="group">
      <button
        onClick={block.editable ? onToggleExpand : undefined}
        className={`flex items-center gap-2 w-full text-left transition-all rounded-md px-1 py-0.5 ${
          block.editable ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
        } ${isExpanded ? "bg-muted/50" : ""}`}
      >
        {/* Drag/edit indicator */}
        <div className="w-4 shrink-0 flex items-center justify-center">
          {block.editable ? (
            <Pencil className={`w-2.5 h-2.5 transition-opacity ${isExpanded ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"}`} />
          ) : null}
        </div>

        {/* Label */}
        <div className="w-28 shrink-0 text-right pr-1">
          <span className={`text-[11px] leading-tight ${isTotal ? "font-bold text-card-foreground" : "text-muted-foreground"}`}>
            {block.label}
          </span>
        </div>

        {/* Bar */}
        <div className="flex-1 h-7 relative rounded-sm overflow-hidden bg-muted/20">
          <div
            className={`h-full rounded-sm border flex items-center transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.max(barWidth, 4)}%` }}
          >
            <span className={`text-[11px] font-bold px-2 truncate whitespace-nowrap ${textColor}`}>
              {isBase || isTotal
                ? `$${block.runningTotal.toLocaleString()}`
                : `${block.value >= 0 ? "+" : ""}$${block.value.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Arrow icon */}
        <div className="w-4 shrink-0">
          {isPositive && <TrendingUp className="w-3 h-3 text-emerald-500" />}
          {isNegative && <TrendingDown className="w-3 h-3 text-destructive" />}
          {(isBase || isTotal) && <Minus className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded inline editor */}
      {isExpanded && block.editable && block.editKey && onValueChange && (
        <div className="ml-6 mr-6 mt-1 mb-2 p-2 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-semibold text-muted-foreground shrink-0">
              {block.editType === "pct" ? "%" : block.editType === "multiplier" ? "×" : "$"}
            </Label>
            <Input
              type="number"
              value={block.currentEditValue ?? 0}
              onChange={e => onValueChange(block.editKey!, Number(e.target.value), block.editType || "flat")}
              className="h-7 text-sm w-28"
              step={block.editType === "multiplier" ? "0.01" : block.editType === "pct" ? "0.5" : "50"}
              autoFocus
            />
            <Slider
              value={[block.editType === "multiplier"
                ? (block.currentEditValue ?? 1) * 100
                : block.currentEditValue ?? 0]}
              min={block.editType === "multiplier" ? 50 : block.editType === "pct" ? -30 : -5000}
              max={block.editType === "multiplier" ? 130 : block.editType === "pct" ? 30 : 5000}
              step={block.editType === "multiplier" ? 1 : block.editType === "pct" ? 0.5 : 25}
              onValueChange={([v]) => {
                const val = block.editType === "multiplier" ? v / 100 : v;
                onValueChange(block.editKey!, val, block.editType || "flat");
              }}
              className="flex-1"
            />
          </div>
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const OfferSimulator = ({ settings, savedSettings, rules, inlineControls = true, onSettingsChange }: Props) => {
  const { toast } = useToast();

  // Local settings copy for inline adjustments
  const [localSettings, setLocalSettings] = useState<OfferSettings>(settings);
  const activeSettings = inlineControls ? localSettings : settings;

  const updateLocalSetting = useCallback(<K extends keyof OfferSettings>(key: K, value: OfferSettings[K]) => {
    setLocalSettings(prev => {
      const next = { ...prev, [key]: value };
      onSettingsChange?.(next);
      return next;
    });
  }, [onSettingsChange]);

  // Live VIN mode state
  const [liveVin, setLiveVin] = useState("");
  const [liveMileage, setLiveMileage] = useState("50000");
  const [liveZip, setLiveZip] = useState("");
  const [liveCondition, setLiveCondition] = useState<string>("good");
  const [liveAccidents, setLiveAccidents] = useState("0");
  const [liveDrivable, setLiveDrivable] = useState("yes");
  const [liveSmokedIn, setLiveSmokedIn] = useState("no");
  const [liveExteriorItems, setLiveExteriorItems] = useState(0);
  const [liveMechanicalItems, setLiveMechanicalItems] = useState(0);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveBbVehicle, setLiveBbVehicle] = useState<BBVehicle | null>(null);
  const [liveSelectedAddDeducts, setLiveSelectedAddDeducts] = useState<string[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState<string | null>(null);

  // Sync when parent settings change
  const prevSettingsRef = useRef(settings);
  if (settings !== prevSettingsRef.current) {
    prevSettingsRef.current = settings;
    setLocalSettings(settings);
  }

  // Live form data
  const liveFormData: FormData = useMemo(() => ({
    plate: "", state: "", vin: liveVin, mileage: liveMileage,
    bbUvc: "", bbSelectedAddDeducts: liveSelectedAddDeducts,
    exteriorColor: "", drivetrain: "", modifications: "",
    overallCondition: liveCondition,
    exteriorDamage: Array.from({ length: liveExteriorItems }, (_, i) => `item_${i}`),
    windshieldDamage: "", moonroof: "",
    interiorDamage: [], techIssues: [], engineIssues: [],
    mechanicalIssues: Array.from({ length: liveMechanicalItems }, (_, i) => `item_${i}`),
    drivable: liveDrivable, accidents: liveAccidents, smokedIn: liveSmokedIn,
    tiresReplaced: "yes", numKeys: "2",
    name: "", phone: "", email: "", zip: "",
    loanStatus: "", loanCompany: "", loanBalance: "", loanPayment: "",
    nextStep: "", preferredLocationId: "", salespersonName: "",
  }), [liveVin, liveMileage, liveCondition, liveAccidents, liveDrivable, liveSmokedIn, liveExteriorItems, liveMechanicalItems, liveSelectedAddDeducts]);

  const liveResult = useMemo(
    () => liveBbVehicle ? calculateOffer(liveBbVehicle, liveFormData, liveSelectedAddDeducts, activeSettings, rules) : null,
    [liveBbVehicle, liveFormData, liveSelectedAddDeducts, activeSettings, rules]
  );

  const liveSavedResult = useMemo(
    () => (liveBbVehicle && savedSettings && compareMode) ? calculateOffer(liveBbVehicle, liveFormData, liveSelectedAddDeducts, savedSettings, rules) : null,
    [liveBbVehicle, liveFormData, liveSelectedAddDeducts, savedSettings, rules, compareMode]
  );

  const whatIfDelta = (liveResult && liveSavedResult) ? liveResult.high - liveSavedResult.high : 0;

  const equipmentTotal = liveBbVehicle ? calcEquipmentTotal(liveBbVehicle, liveSelectedAddDeducts) : 0;

  // Build interactive waterfall blocks
  const waterfallBlocks: WaterfallBlock[] = useMemo(() => {
    if (!liveResult || !liveBbVehicle) return [];
    const blocks: WaterfallBlock[] = [];
    let running = liveResult.baseValue;
    const condMult = activeSettings.condition_multipliers?.[liveCondition as keyof typeof activeSettings.condition_multipliers] ?? 1;
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - Number(liveBbVehicle.year);
    const mileageNum = parseInt(liveMileage.replace(/[^0-9]/g, "")) || 0;
    const matchedAge = (activeSettings.age_tiers || []).find(t => vehicleAge >= t.min_years && vehicleAge <= t.max_years);
    const matchedMileage = (activeSettings.mileage_tiers || []).find(t => mileageNum >= t.min_miles && mileageNum <= t.max_miles);

    // 1. Base
    blocks.push({ id: "base", label: "Base Value", value: running, runningTotal: running, type: "base", editable: true, editKey: "bb_value_basis", editType: "flat" });

    // 2. Condition
    const condAdj = Math.round(liveResult.baseValue * condMult) - liveResult.baseValue;
    if (condAdj !== 0) {
      running += condAdj;
      blocks.push({ id: "condition", label: `Condition (${liveCondition})`, value: condAdj, runningTotal: running, type: condAdj >= 0 ? "add" : "subtract", editable: true, editKey: "condition_multiplier", editType: "multiplier", currentEditValue: condMult });
    } else {
      blocks.push({ id: "condition", label: `Condition (${liveCondition})`, value: 0, runningTotal: running, type: "add", editable: true, editKey: "condition_multiplier", editType: "multiplier", currentEditValue: condMult });
    }

    // 3. Equipment
    if (equipmentTotal !== 0) {
      running += equipmentTotal;
      blocks.push({ id: "equipment", label: "Equipment", value: equipmentTotal, runningTotal: running, type: equipmentTotal >= 0 ? "add" : "subtract", editable: false });
    }

    // 4. Deductions
    if (liveResult.totalDeductions > 0) {
      running -= liveResult.totalDeductions;
      blocks.push({ id: "deductions", label: "Deductions", value: -liveResult.totalDeductions, runningTotal: running, type: "subtract", editable: true, editKey: "deductions_detail" });
    }

    // 5. Recon
    if (activeSettings.recon_cost > 0) {
      running -= activeSettings.recon_cost;
      blocks.push({ id: "recon", label: "Recon Cost", value: -activeSettings.recon_cost, runningTotal: running, type: "subtract", editable: true, editKey: "recon_cost", editType: "flat", currentEditValue: activeSettings.recon_cost });
    }

    // 6. Global %
    if (activeSettings.global_adjustment_pct !== 0) {
      const adj = Math.round(running * (activeSettings.global_adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "global", label: `Global (${activeSettings.global_adjustment_pct > 0 ? "+" : ""}${activeSettings.global_adjustment_pct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: true, editKey: "global_adjustment_pct", editType: "pct", currentEditValue: activeSettings.global_adjustment_pct });
    } else {
      blocks.push({ id: "global", label: "Global %", value: 0, runningTotal: running, type: "add", editable: true, editKey: "global_adjustment_pct", editType: "pct", currentEditValue: 0 });
    }

    // 7. Regional
    if (activeSettings.regional_adjustment_pct !== 0) {
      const adj = Math.round(running * (activeSettings.regional_adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "regional", label: `Regional (${activeSettings.regional_adjustment_pct > 0 ? "+" : ""}${activeSettings.regional_adjustment_pct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: true, editKey: "regional_adjustment_pct", editType: "pct", currentEditValue: activeSettings.regional_adjustment_pct });
    }

    // 8. Age
    if (matchedAge) {
      const adj = Math.round(running * (matchedAge.adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "age", label: `Age (${vehicleAge}yr)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: false });
    }

    // 9. Mileage
    if (matchedMileage) {
      running += matchedMileage.adjustment_flat;
      blocks.push({ id: "mileage", label: `Mileage (${mileageNum.toLocaleString()}mi)`, value: matchedMileage.adjustment_flat, runningTotal: running, type: matchedMileage.adjustment_flat >= 0 ? "add" : "subtract", editable: false });
    }

    // 9b. Low-Mileage Bonus
    const lmb = (activeSettings as any).low_mileage_bonus;
    if (lmb?.enabled && liveBbVehicle.year) {
      const age = Math.max(currentYear - Number(liveBbVehicle.year), 1);
      const milesPerYear = mileageNum / age;
      if (milesPerYear < lmb.avg_miles_per_year && milesPerYear >= (lmb.min_miles_per_year || 4000)) {
        const pctBelow = ((lmb.avg_miles_per_year - milesPerYear) / lmb.avg_miles_per_year) * 100;
        const steps = Math.floor(pctBelow / (lmb.step_size_pct || 20));
        const bonusPct = Math.min(steps * (lmb.bonus_pct_per_step || 2), lmb.max_bonus_pct || 8);
        if (bonusPct > 0) {
          const adj = Math.round(running * (bonusPct / 100));
          running += adj;
          blocks.push({ id: "low_mileage", label: `Low Mileage Bonus (+${bonusPct}%)`, value: adj, runningTotal: running, type: "add", editable: false });
        }
      }
    }

    // 10. Floor/Ceiling
    const clamped = Math.max(running, activeSettings.offer_floor || 500);
    if (clamped !== running) {
      blocks.push({ id: "floor", label: `Floor ($${(activeSettings.offer_floor || 500).toLocaleString()})`, value: clamped - running, runningTotal: clamped, type: "add", editable: true, editKey: "offer_floor", editType: "flat", currentEditValue: activeSettings.offer_floor });
      running = clamped;
    }

    // Final
    blocks.push({ id: "final", label: "FINAL OFFER", value: liveResult.high, runningTotal: liveResult.high, type: "total", editable: false });

    return blocks;
  }, [liveResult, liveBbVehicle, activeSettings, liveCondition, liveMileage, equipmentTotal]);

  const maxVal = Math.max(...waterfallBlocks.map(s => Math.max(Math.abs(s.runningTotal), Math.abs(s.value), s.type === "base" ? s.value : 0)), 1);

  // Handle waterfall block value changes
  const handleBlockValueChange = useCallback((editKey: string, value: number, editType: string) => {
    if (editKey === "condition_multiplier") {
      updateLocalSetting("condition_multipliers", { ...localSettings.condition_multipliers, [liveCondition]: value });
    } else if (editKey === "recon_cost") {
      updateLocalSetting("recon_cost", value);
    } else if (editKey === "global_adjustment_pct") {
      updateLocalSetting("global_adjustment_pct", value);
    } else if (editKey === "regional_adjustment_pct") {
      updateLocalSetting("regional_adjustment_pct", value);
    } else if (editKey === "offer_floor") {
      updateLocalSetting("offer_floor", value);
    }
  }, [localSettings, liveCondition, updateLocalSetting]);

  const handleVinLookup = async () => {
    const cleanVin = liveVin.trim().toUpperCase();
    if (cleanVin.length !== 17) {
      toast({ title: "Invalid VIN", description: "Please enter a valid 17-character VIN.", variant: "destructive" });
      return;
    }
    setLiveLoading(true);
    setLiveBbVehicle(null);
    try {
      const { data, error } = await supabase.functions.invoke("bb-lookup", {
        body: { lookup_type: "vin", vin: cleanVin, mileage: parseInt(liveMileage.replace(/[^0-9]/g, "")) || 50000 },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Lookup Error", description: data.error, variant: "destructive" }); return; }
      const vehicles = data?.vehicles || [];
      if (vehicles.length === 0) { toast({ title: "No Results", description: "No vehicles found for that VIN.", variant: "destructive" }); return; }
      const vehicle = vehicles[0] as BBVehicle;
      setLiveBbVehicle(vehicle);
      const autoSelected = (vehicle.add_deduct_list || [])
        .filter((ad: BBAddDeduct) => ad.auto !== "N")
        .map((ad: BBAddDeduct) => ad.uoc);
      setLiveSelectedAddDeducts(autoSelected);
      toast({ title: "Vehicle Found", description: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.series || ""}`.trim() });
    } catch (err) {
      console.error("VIN lookup error:", err);
      toast({ title: "Lookup Failed", description: "Could not reach the valuation service.", variant: "destructive" });
    } finally {
      setLiveLoading(false);
    }
  };

  const toggleLiveAddDeduct = (uoc: string) => {
    setLiveSelectedAddDeducts(prev =>
      prev.includes(uoc) ? prev.filter(u => u !== uoc) : [...prev, uoc]
    );
  };

  return (
    <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
      {/* ── VIN + Mileage Input ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <Label className="text-xs font-semibold">VIN</Label>
          <Input value={liveVin} onChange={e => setLiveVin(e.target.value.toUpperCase())} placeholder="Enter 17-character VIN" maxLength={17} className="h-9 font-mono tracking-wider" />
        </div>
        <div className="w-32">
          <Label className="text-xs font-semibold">Mileage</Label>
          <Input type="number" value={liveMileage} onChange={e => setLiveMileage(e.target.value)} step="5000" className="h-9" />
        </div>
        <div className="w-24">
          <Label className="text-xs font-semibold">ZIP Code</Label>
          <Input value={liveZip} onChange={e => setLiveZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="06001" maxLength={5} className="h-9" />
        </div>
        <div className="flex items-end">
          <Button onClick={handleVinLookup} disabled={liveLoading || liveVin.trim().length !== 17} className="h-9 gap-1.5">
            {liveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {liveLoading ? "Looking up…" : "Look Up"}
          </Button>
        </div>
      </div>

      {!liveBbVehicle && !liveLoading && (
        <div className="bg-muted/40 rounded-lg p-8 text-sm text-muted-foreground text-center">
          <Car className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Enter a VIN and mileage, then click <strong>Look Up</strong> to start building your offer logic.
        </div>
      )}

      {liveBbVehicle && (
        <>
          {/* Vehicle Summary */}
          <div className="bg-muted/40 rounded-lg border border-border p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Car className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm text-card-foreground">
                {liveBbVehicle.year} {liveBbVehicle.make} {liveBbVehicle.model} {liveBbVehicle.series}
              </span>
              {liveBbVehicle.class_name && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{liveBbVehicle.class_name}</span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
              <div><span className="text-muted-foreground">Style:</span> <span className="font-medium text-card-foreground">{liveBbVehicle.style || "—"}</span></div>
              <div><span className="text-muted-foreground">Drivetrain:</span> <span className="font-medium text-card-foreground">{liveBbVehicle.drivetrain || "—"}</span></div>
              <div><span className="text-muted-foreground">Engine:</span> <span className="font-medium text-card-foreground">{liveBbVehicle.engine || "—"}</span></div>
              <div><span className="text-muted-foreground">Trans:</span> <span className="font-medium text-card-foreground">{liveBbVehicle.transmission || "—"}</span></div>
              <div><span className="text-muted-foreground">MSRP:</span> <span className="font-medium text-card-foreground">${Number(liveBbVehicle.msrp || 0).toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium text-card-foreground">{liveBbVehicle.fuel_type || "—"}</span></div>
            </div>
          </div>

          {/* ══ CONDITION TIER BUBBLES — click to configure ══ */}
          <div className="bg-gradient-to-r from-primary/5 to-transparent rounded-lg border border-primary/20 p-3">
            <div className="flex items-center gap-1.5 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">① Select Condition Tier to Configure</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {CONDITIONS.map(cond => {
                const basisMap = localSettings.condition_basis_map || {};
                const selectedBasis = (basisMap as Record<string, string>)[cond] || "tradein_avg";
                const mult = localSettings.condition_multipliers?.[cond] ?? 1.0;
                const isActive = cond === liveCondition;
                const selectedValue = liveBbVehicle ? (() => {
                  const [cat, tier] = selectedBasis.split("_");
                  const tierKey = tier === "xclean" ? "xclean" : tier;
                  const data = liveBbVehicle[cat as "wholesale" | "tradein" | "retail"] as Record<string, number> | undefined;
                  return data?.[tierKey] || 0;
                })() : 0;
                const bubbleFormData = { ...liveFormData, overallCondition: cond };
                const bubbleResult = liveBbVehicle ? calculateOffer(liveBbVehicle, bubbleFormData, liveSelectedAddDeducts, activeSettings, rules) : null;

                return (
                  <button
                    key={cond}
                    onClick={() => setLiveCondition(cond)}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md scale-[1.02]"
                        : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                    }`}
                  >
                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {CONDITION_LABELS[cond]}
                    </div>
                    {bubbleResult ? (
                      <div className={`text-lg font-bold ${isActive ? "text-primary" : "text-card-foreground"}`}>
                        ${bubbleResult.high.toLocaleString()}
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-muted-foreground">—</div>
                    )}
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      Base: ${selectedValue.toLocaleString()} × {mult.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ══ TWO-COLUMN LAYOUT ══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

            {/* ── LEFT: Active Tier Config + Waterfall ── */}
            <div className="space-y-4">
              {/* Active Tier Configuration */}
              {(() => {
                const cond = liveCondition;
                const basisMap = localSettings.condition_basis_map || {};
                const selectedBasis = (basisMap as Record<string, string>)[cond] || "tradein_avg";
                const condEquipMap = (localSettings as any).condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true };
                const equipEnabled = condEquipMap[cond] ?? true;
                const mult = localSettings.condition_multipliers?.[cond] ?? 1.0;

                return (
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-card-foreground">
                          Configuring: <span className="text-primary">{CONDITION_LABELS[cond]}</span>
                        </span>
                      </div>
                      <span className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold uppercase">Active Tier</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[10px] font-semibold text-muted-foreground">Base Value Source</Label>
                        <Select
                          value={selectedBasis}
                          onValueChange={(val) => updateLocalSetting("condition_basis_map", {
                            excellent: "retail_xclean", very_good: "tradein_clean", good: "tradein_avg", fair: "wholesale_rough",
                            ...(localSettings.condition_basis_map || {}),
                            [cond]: val,
                          } as any)}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BB_VALUE_OPTIONS.map(opt => {
                              let dollarStr = "";
                              if (liveBbVehicle) {
                                const [cat, tier] = opt.value.split("_");
                                const tierKey = tier === "xclean" ? "xclean" : tier;
                                const data = liveBbVehicle[cat as "wholesale" | "tradein" | "retail"] as Record<string, number> | undefined;
                                const val = data?.[tierKey] || 0;
                                if (val > 0) dollarStr = ` — $${val.toLocaleString()}`;
                              }
                              return <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}{dollarStr}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col justify-between">
                        <Label className="text-[10px] font-semibold text-muted-foreground">Include Equipment</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Switch
                            checked={equipEnabled}
                            onCheckedChange={(checked) => {
                              const newMap = { ...(localSettings as any).condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true }, [cond]: checked };
                              updateLocalSetting("condition_equipment_map" as any, newMap);
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground">{equipEnabled ? "Yes" : "No"}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[10px] font-semibold text-muted-foreground">Value Multiplier</Label>
                          <span className="text-xs font-bold text-primary">{mult.toFixed(2)}×</span>
                        </div>
                        <Slider
                          value={[mult * 100]}
                          min={70} max={110} step={1}
                          onValueChange={([v]) => updateLocalSetting("condition_multipliers", {
                            ...localSettings.condition_multipliers,
                            [cond]: Math.round(v) / 100,
                          })}
                        />
                        <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
                          <span>0.70×</span><span>1.00×</span><span>1.10×</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Vehicle Condition Inputs */}
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Car className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">② Vehicle Condition</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  <div>
                    <Label className="text-[10px] font-semibold">Accidents</Label>
                    <Select value={liveAccidents} onValueChange={setLiveAccidents}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3+">3+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold">Drivable?</Label>
                    <Select value={liveDrivable} onValueChange={setLiveDrivable}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold">Smoked?</Label>
                    <Select value={liveSmokedIn} onValueChange={setLiveSmokedIn}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold">Ext. Damage</Label>
                    <Input type="number" min={0} max={10} value={liveExteriorItems} onChange={e => setLiveExteriorItems(Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold">Mech. Issues</Label>
                    <Input type="number" min={0} max={10} value={liveMechanicalItems} onChange={e => setLiveMechanicalItems(Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                </div>
              </div>

              {/* Equipment */}
              {liveBbVehicle.add_deduct_list?.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                      <div className="flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-[11px] text-card-foreground">Equipment ({liveSelectedAddDeducts.length}/{liveBbVehicle.add_deduct_list.length})</span>
                        {equipmentTotal !== 0 && (
                          <Badge variant="secondary" className={`text-[9px] ${equipmentTotal > 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {equipmentTotal > 0 ? "+" : ""}${equipmentTotal.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-0.5 max-h-36 overflow-y-auto px-1 py-2">
                      {liveBbVehicle.add_deduct_list.map((ad: BBAddDeduct) => {
                        const isSelected = liveSelectedAddDeducts.includes(ad.uoc);
                        const dollarStr = ad.avg !== 0 ? ` (${ad.avg > 0 ? "+" : ""}$${Math.abs(ad.avg)})` : "";
                        return (
                          <label key={ad.uoc} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[10px] ${isSelected ? "bg-primary/10 text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleLiveAddDeduct(ad.uoc)} className="rounded border-border w-3 h-3" />
                            <span className="truncate">{ad.name}{dollarStr}</span>
                            {ad.auto !== "N" && <span className="text-[8px] bg-emerald-500/10 text-emerald-600 px-1 rounded shrink-0">auto</span>}
                          </label>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Interactive Waterfall — Always visible, updates per tier */}
              {liveResult && (
                <div className="rounded-lg border-2 border-primary/20 p-3 bg-gradient-to-b from-muted/20 to-transparent">
                  <div className="flex items-center gap-1.5 mb-3">
                    <ArrowDown className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">
                      Price Waterfall — {CONDITION_LABELS[liveCondition]}
                    </span>
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold ml-auto">
                      Click bars to adjust
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {waterfallBlocks.map(block => (
                      <InteractiveWaterfallBlock
                        key={block.id}
                        block={block}
                        maxVal={maxVal}
                        onValueChange={handleBlockValueChange}
                        isExpanded={expandedBlock === block.id}
                        onToggleExpand={() => setExpandedBlock(prev => prev === block.id ? null : block.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Controls */}
              {inlineControls && liveResult && (
                <div className="space-y-2">
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span className="font-semibold text-[11px] text-card-foreground">Age Tiers ({(localSettings.age_tiers || []).length})</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 p-2">
                        {(localSettings.age_tiers || []).map((tier, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-[10px]">
                            <Input type="number" value={tier.min_years} onChange={e => { const u = [...(localSettings.age_tiers || [])]; u[idx] = { ...u[idx], min_years: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-12 h-5 text-[10px]" />
                            <span>–</span>
                            <Input type="number" value={tier.max_years} onChange={e => { const u = [...(localSettings.age_tiers || [])]; u[idx] = { ...u[idx], max_years: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-12 h-5 text-[10px]" />
                            <span>yr →</span>
                            <Input type="number" value={tier.adjustment_pct} onChange={e => { const u = [...(localSettings.age_tiers || [])]; u[idx] = { ...u[idx], adjustment_pct: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-14 h-5 text-[10px]" step="0.5" />
                            <span>%</span>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => updateLocalSetting("age_tiers", (localSettings.age_tiers || []).filter((_, i) => i !== idx))}><Trash2 className="w-2.5 h-2.5" /></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="h-5 text-[9px] gap-0.5 px-2" onClick={() => {
                          const tiers = localSettings.age_tiers || [];
                          const last = tiers.length > 0 ? tiers[tiers.length - 1].max_years + 1 : 5;
                          updateLocalSetting("age_tiers", [...tiers, { min_years: last, max_years: last + 4, adjustment_pct: -3 }]);
                        }}><Plus className="w-2.5 h-2.5" /> Add</Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                        <div className="flex items-center gap-1.5">
                          <Gauge className="w-3.5 h-3.5 text-primary" />
                          <span className="font-semibold text-[11px] text-card-foreground">Mileage Tiers ({(localSettings.mileage_tiers || []).length})</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 p-2">
                        {(localSettings.mileage_tiers || []).map((tier, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-[10px]">
                            <Input type="number" value={tier.min_miles} onChange={e => { const u = [...(localSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], min_miles: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="5000" />
                            <span>–</span>
                            <Input type="number" value={tier.max_miles} onChange={e => { const u = [...(localSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], max_miles: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="5000" />
                            <span>mi →$</span>
                            <Input type="number" value={tier.adjustment_flat} onChange={e => { const u = [...(localSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], adjustment_flat: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="100" />
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => updateLocalSetting("mileage_tiers", (localSettings.mileage_tiers || []).filter((_, i) => i !== idx))}><Trash2 className="w-2.5 h-2.5" /></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="h-5 text-[9px] gap-0.5 px-2" onClick={() => {
                          const tiers = localSettings.mileage_tiers || [];
                          const last = tiers.length > 0 ? tiers[tiers.length - 1].max_miles + 1 : 80000;
                          updateLocalSetting("mileage_tiers", [...tiers, { min_miles: last, max_miles: last + 20000, adjustment_flat: -500 }]);
                        }}><Plus className="w-2.5 h-2.5" /> Add</Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-semibold text-[11px] text-card-foreground">Deduction Amounts</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 p-2">
                        {Object.entries(DEDUCTION_LABELS).map(([key, config]) => {
                          const enabled = (localSettings.deductions_config as any)?.[key] ?? true;
                          return (
                            <div key={key} className={`rounded border px-2 py-1 ${enabled ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 opacity-50"}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-card-foreground">{config.label}</span>
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={() => updateLocalSetting("deductions_config", { ...localSettings.deductions_config, [key]: !enabled })}
                                  className="scale-75"
                                />
                              </div>
                              {enabled && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {config.amountKeys.map(amtKey => (
                                    <div key={amtKey} className="flex items-center gap-0.5">
                                      <span className="text-[8px] text-muted-foreground">{AMOUNT_SHORT[amtKey]}:</span>
                                      <Input
                                        type="number"
                                        value={(localSettings.deduction_amounts as any)?.[amtKey] ?? 0}
                                        onChange={e => updateLocalSetting("deduction_amounts", { ...localSettings.deduction_amounts, [amtKey]: Number(e.target.value) })}
                                        className="w-14 h-5 text-[9px]" step="25"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>

            {/* ── RIGHT: Results + Profit + Market ── */}
            <div className="space-y-4">
              {liveResult && (
                <>
                  {/* Final Offer Card */}
                  <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Customer Offer</div>
                    <div className="text-3xl font-bold text-primary">
                      ${liveResult.high.toLocaleString()}
                    </div>
                    {compareMode && liveSavedResult && whatIfDelta !== 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">vs. saved:</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${whatIfDelta > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                          {whatIfDelta > 0 ? "+" : ""}${whatIfDelta.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {liveResult.matchedRuleIds.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <Badge variant="secondary" className="text-[10px]">{liveResult.matchedRuleIds.length} rule(s) applied</Badge>
                        {liveResult.isHotLead && <Badge variant="destructive" className="text-[10px]">🔥 Hot</Badge>}
                      </div>
                    )}
                  </div>

                  {/* What-If Toggle */}
                  {savedSettings && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold text-card-foreground">What-If Comparison</span>
                      </div>
                      <Switch checked={compareMode} onCheckedChange={setCompareMode} className="scale-90" />
                    </div>
                  )}

                  {compareMode && liveSavedResult && (
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Saved Logic Offer</div>
                      <div className="text-lg font-bold text-muted-foreground">
                        ${liveSavedResult.high.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* Profit Gauge */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <ProfitSpreadGauge
                      offerHigh={liveResult.high}
                      wholesaleAvg={Number(liveBbVehicle.wholesale?.avg || 0)}
                      tradeinAvg={Number(liveBbVehicle.tradein?.avg || 0)}
                      retailAvg={Number(liveBbVehicle.retail?.avg || 0)}
                      retailClean={Number(liveBbVehicle.retail?.clean || 0)}
                      msrp={Number(liveBbVehicle.msrp || 0)}
                    />
                  </div>

                  {/* Market Context */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <MarketContextPanel bbVehicle={liveBbVehicle} offerHigh={liveResult.high} />
                  </div>

                  {/* Live Retail Market Data */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <RetailMarketPanel
                      vin={liveVin}
                      uvc={liveBbVehicle.uvc}
                      zipcode={liveZip}
                      radiusMiles={(activeSettings as any).retail_search_radius || 100}
                      offerHigh={liveResult.high}
                    />
                  </div>
                </>
              )}

              {!liveResult && (
                <div className="bg-muted/40 rounded-lg p-6 text-sm text-muted-foreground text-center">
                  Set vehicle condition to see the offer calculation.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function calcEquipmentTotal(bbVehicle: BBVehicle, selectedUocs: string[]): number {
  return (bbVehicle.add_deduct_list || [])
    .filter(ad => selectedUocs.includes(ad.uoc))
    .reduce((sum, ad) => sum + (ad.avg || 0), 0);
}

export default OfferSimulator;
