import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
import { calculateOffer, type OfferSettings, type OfferRule, type OfferEstimate, calcHighMileagePenaltyPct, calcColorAdjustmentPct, DEFAULT_HIGH_MILEAGE_PENALTY, DEFAULT_COLOR_DESIRABILITY, DEFAULT_SEASONAL_ADJUSTMENT, DEFAULT_DEDUCTION_MODES } from "@/lib/offerCalculator";
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

  // Default ZIP to dealership's first location zip
  useEffect(() => {
    if (liveZip) return;
    supabase.from("dealership_locations").select("zip_codes").eq("is_active", true).order("sort_order").limit(1)
      .then(({ data }) => {
        const zips = data?.[0]?.zip_codes;
        if (Array.isArray(zips) && zips.length > 0) setLiveZip(zips[0]);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [liveCondition, setLiveCondition] = useState<string>("good");
  const [liveAccidents, setLiveAccidents] = useState("0");
  const [liveDrivable, setLiveDrivable] = useState("yes");
  const [liveSmokedIn, setLiveSmokedIn] = useState("no");
  const [liveExteriorItems, setLiveExteriorItems] = useState(0);
  const [liveInteriorItems, setLiveInteriorItems] = useState(0);
  const [liveMechanicalItems, setLiveMechanicalItems] = useState(0);
  const [liveEngineItems, setLiveEngineItems] = useState(0);
  const [liveTechItems, setLiveTechItems] = useState(0);
  const [liveWindshield, setLiveWindshield] = useState("none");
  const [liveMoonroof, setLiveMoonroof] = useState("No moonroof");
  const [liveTiresReplaced, setLiveTiresReplaced] = useState("4");
  const [liveNumKeys, setLiveNumKeys] = useState("2+");
  const [liveModifications, setLiveModifications] = useState("none");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveBbVehicle, setLiveBbVehicle] = useState<BBVehicle | null>(null);
  const [liveSelectedAddDeducts, setLiveSelectedAddDeducts] = useState<string[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState<string | null>(null);

  // Sync when parent settings change
  const prevSettingsRef = useRef(settings);
  useEffect(() => {
    if (settings !== prevSettingsRef.current) {
      prevSettingsRef.current = settings;
      setLocalSettings(settings);
    }
  }, [settings]);

  // Live form data
  // Map simulator values to match exact customer form values for offerCalculator
  const mappedWindshield = liveWindshield === "minor_chips" ? "Minor chips or pitting" : liveWindshield === "major_cracks" ? "Major cracks or chips" : "No windshield damage";
  const mappedDrivable = liveDrivable === "no" ? "Not drivable" : "Drivable";
  const mappedAccidents = liveAccidents === "0" ? "No accidents" : liveAccidents === "1" ? "1 accident" : "2+ accidents";
  const mappedSmokedIn = liveSmokedIn === "yes" ? "Yes" : "No";
  const mappedTires = liveTiresReplaced;
  const mappedKeys = liveNumKeys === "2+" ? "2+" : liveNumKeys;

  const liveFormData: FormData = useMemo(() => ({
    plate: "", state: "", vin: liveVin, mileage: liveMileage,
    bbUvc: "", bbSelectedAddDeducts: liveSelectedAddDeducts,
    exteriorColor: "", drivetrain: "", modifications: liveModifications === "none" ? "" : liveModifications,
    overallCondition: liveCondition,
    exteriorDamage: Array.from({ length: liveExteriorItems }, (_, i) => `item_${i}`),
    windshieldDamage: mappedWindshield, moonroof: liveMoonroof,
    interiorDamage: Array.from({ length: liveInteriorItems }, (_, i) => `item_${i}`),
    techIssues: Array.from({ length: liveTechItems }, (_, i) => `item_${i}`),
    engineIssues: Array.from({ length: liveEngineItems }, (_, i) => `item_${i}`),
    mechanicalIssues: Array.from({ length: liveMechanicalItems }, (_, i) => `item_${i}`),
    drivable: mappedDrivable, accidents: mappedAccidents, smokedIn: mappedSmokedIn,
    tiresReplaced: mappedTires,
    numKeys: mappedKeys,
    name: "", phone: "", email: "", zip: "",
    loanStatus: "", loanCompany: "", loanBalance: "", loanPayment: "",
    nextStep: "", preferredLocationId: "", salespersonName: "", manualYear: "", manualMake: "", manualModel: "",
  }), [liveVin, liveMileage, liveCondition, liveExteriorItems, liveInteriorItems, liveMechanicalItems, liveEngineItems, liveTechItems, liveWindshield, liveMoonroof, liveTiresReplaced, liveNumKeys, liveModifications, liveSelectedAddDeducts, mappedWindshield, mappedDrivable, mappedAccidents, mappedSmokedIn, mappedTires, mappedKeys]);

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

    // 9c. High-Mileage Penalty
    const hmp = (activeSettings as any).high_mileage_penalty || DEFAULT_HIGH_MILEAGE_PENALTY;
    if (hmp?.enabled && liveBbVehicle.year) {
      const age = Math.max(currentYear - Number(liveBbVehicle.year), 1);
      const milesPerYear = mileageNum / age;
      if (milesPerYear > hmp.avg_miles_per_year && milesPerYear <= (hmp.max_miles_per_year || 25000)) {
        const pctAbove = ((milesPerYear - hmp.avg_miles_per_year) / hmp.avg_miles_per_year) * 100;
        const steps = Math.floor(pctAbove / (hmp.step_size_pct || 20));
        const penaltyPct = Math.min(steps * (hmp.penalty_pct_per_step || 2), hmp.max_penalty_pct || 10);
        if (penaltyPct > 0) {
          const adj = -Math.round(running * (penaltyPct / 100));
          running += adj;
          blocks.push({ id: "high_mileage", label: `High Mileage Penalty (-${penaltyPct}%)`, value: adj, runningTotal: running, type: "subtract", editable: false });
        }
      }
    }

    // 9d. Seasonal Adjustment
    const seasonal = (activeSettings as any).seasonal_adjustment || DEFAULT_SEASONAL_ADJUSTMENT;
    if (seasonal?.enabled && seasonal.adjustment_pct !== 0) {
      const adj = Math.round(running * (seasonal.adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "seasonal", label: `Seasonal (${seasonal.adjustment_pct > 0 ? "+" : ""}${seasonal.adjustment_pct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: false });
    }

    // 9e. Color Desirability
    const colorConfig = (activeSettings as any).color_desirability || DEFAULT_COLOR_DESIRABILITY;
    if (colorConfig?.enabled) {
      // Use the vehicle's first exterior color as a proxy
      const sampleColor = liveBbVehicle.exterior_colors?.[0]?.name || "";
      const colorPct = calcColorAdjustmentPct(sampleColor, colorConfig);
      if (colorPct !== 0) {
        const adj = Math.round(running * (colorPct / 100));
        running += adj;
        blocks.push({ id: "color", label: `Color (${sampleColor || "—"}) ${colorPct > 0 ? "+" : ""}${colorPct}%`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: false });
      }
    }
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

              {/* Vehicle Condition Inputs — Customer Answers */}
              {(() => {
                const da = activeSettings.deduction_amounts || {} as Record<string, number>;
                const dc = activeSettings.deductions_config || {} as Record<string, boolean>;
                const getAmt = (key: string) => (da as any)[key] || 0;
                const isOn = (key: string) => (dc as any)[key] !== false;

                // Calculate live deduction for each row — matching exact customer form values
                const accidentDeduct = mappedAccidents === "1 accident" ? getAmt("accidents_1") : mappedAccidents === "2+ accidents" ? getAmt("accidents_2") : 0;
                const extDeduct = liveExteriorItems * getAmt("exterior_damage_per_item");
                const intDeduct = liveInteriorItems * getAmt("interior_damage_per_item");
                const windDeduct = liveWindshield === "major_cracks" ? getAmt("windshield_cracked") : liveWindshield === "minor_chips" ? getAmt("windshield_chipped") : 0;
                const moonroofDeduct = liveMoonroof === "Doesn't work" ? getAmt("moonroof_broken") : 0;
                const engDeduct = liveEngineItems * getAmt("engine_issue_per_item");
                const mechDeduct = liveMechanicalItems * getAmt("mechanical_issue_per_item");
                const techDeduct = liveTechItems * getAmt("tech_issue_per_item");
                const drivDeduct = liveDrivable === "no" ? getAmt("not_drivable") : 0;
                const smokeDeduct = liveSmokedIn === "yes" ? getAmt("smoked_in") : 0;
                const tiresDeduct = (liveTiresReplaced === "None" || liveTiresReplaced === "1") ? getAmt("tires_not_replaced") : 0;
                const keyDeduct = liveNumKeys === "1" ? getAmt("missing_keys_1") : liveNumKeys === "0" ? getAmt("missing_keys_0") : 0;

                const DeductBadge = ({ amount }: { amount: number }) => amount > 0 ? (
                  <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full ml-auto shrink-0">
                    -${amount.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full ml-auto shrink-0">
                    No deduction
                  </span>
                );

                return (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Car className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">② Customer Condition Inputs</span>
                    </div>
                    <div className="space-y-2">
                      {/* Row: Condition Tier */}
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                        <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Condition</span>
                        <span className="text-xs font-bold text-primary">{CONDITION_LABELS[liveCondition]}</span>
                        <span className="text-[9px] text-muted-foreground ml-auto">Set above ①</span>
                      </div>

                      {/* Row: Modifications */}
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                        <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Modifications</span>
                        <Select value={liveModifications} onValueChange={setLiveModifications}>
                          <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Modifications</SelectItem>
                            <SelectItem value="yes">Has Modifications</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[9px] text-muted-foreground ml-auto">Info only</span>
                      </div>

                      {/* Row: Drivable */}
                      {isOn("not_drivable") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Drivable?</span>
                          <Select value={liveDrivable} onValueChange={setLiveDrivable}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Drivable</SelectItem>
                              <SelectItem value="no">Not Drivable</SelectItem>
                            </SelectContent>
                          </Select>
                          <DeductBadge amount={drivDeduct} />
                        </div>
                      )}

                      {/* Row: Exterior Damage (up to 5 issues) */}
                      {isOn("exterior_damage") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Exterior Damage</span>
                          <Select value={String(liveExteriorItems)} onValueChange={v => setLiveExteriorItems(Number(v))}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">None</SelectItem>
                              <SelectItem value="1">1 issue</SelectItem>
                              <SelectItem value="2">2 issues</SelectItem>
                              <SelectItem value="3">3 issues</SelectItem>
                              <SelectItem value="4">4 issues</SelectItem>
                              <SelectItem value="5">5 issues</SelectItem>
                            </SelectContent>
                          </Select>
                          {liveExteriorItems > 0 && <span className="text-[9px] text-muted-foreground">{liveExteriorItems} × ${getAmt("exterior_damage_per_item").toLocaleString()}</span>}
                          <DeductBadge amount={extDeduct} />
                        </div>
                      )}

                      {/* Row: Windshield — matches customer form exactly */}
                      {isOn("windshield_damage") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Windshield</span>
                          <Select value={liveWindshield} onValueChange={setLiveWindshield}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No damage</SelectItem>
                              <SelectItem value="minor_chips">Minor chips or pitting (-${getAmt("windshield_chipped").toLocaleString()})</SelectItem>
                              <SelectItem value="major_cracks">Major cracks or chips (-${getAmt("windshield_cracked").toLocaleString()})</SelectItem>
                            </SelectContent>
                          </Select>
                          <DeductBadge amount={windDeduct} />
                        </div>
                      )}

                      {/* Row: Moonroof — customer input: Works great / Doesn't work / No moonroof */}
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                        <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Moonroof</span>
                        <Select value={liveMoonroof} onValueChange={setLiveMoonroof}>
                          <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Works great">Works great</SelectItem>
                            <SelectItem value="Doesn't work">Doesn't work</SelectItem>
                            <SelectItem value="No moonroof">No moonroof</SelectItem>
                          </SelectContent>
                        </Select>
                        <DeductBadge amount={moonroofDeduct} />
                      </div>

                      {/* Row: Interior Damage (up to 4 issues) */}
                      {isOn("interior_damage") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Interior Damage</span>
                          <Select value={String(liveInteriorItems)} onValueChange={v => setLiveInteriorItems(Number(v))}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">None</SelectItem>
                              <SelectItem value="1">1 issue</SelectItem>
                              <SelectItem value="2">2 issues</SelectItem>
                              <SelectItem value="3">3 issues</SelectItem>
                              <SelectItem value="4">4 issues</SelectItem>
                            </SelectContent>
                          </Select>
                          {liveInteriorItems > 0 && <span className="text-[9px] text-muted-foreground">{liveInteriorItems} × ${getAmt("interior_damage_per_item").toLocaleString()}</span>}
                          <DeductBadge amount={intDeduct} />
                        </div>
                      )}

                      {/* Row: Tech Issues (up to 4 issues) */}
                      {isOn("tech_issues") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Tech Issues</span>
                          <Select value={String(liveTechItems)} onValueChange={v => setLiveTechItems(Number(v))}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">None</SelectItem>
                              <SelectItem value="1">1 issue</SelectItem>
                              <SelectItem value="2">2 issues</SelectItem>
                              <SelectItem value="3">3 issues</SelectItem>
                              <SelectItem value="4">4 issues</SelectItem>
                            </SelectContent>
                          </Select>
                          {liveTechItems > 0 && <span className="text-[9px] text-muted-foreground">{liveTechItems} × ${getAmt("tech_issue_per_item").toLocaleString()}</span>}
                          <DeductBadge amount={techDeduct} />
                        </div>
                      )}

                      {/* Row: Engine Issues (up to 5 issues) */}
                      {isOn("engine_issues") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Engine Issues</span>
                          <Select value={String(liveEngineItems)} onValueChange={v => setLiveEngineItems(Number(v))}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">None</SelectItem>
                              <SelectItem value="1">1 issue</SelectItem>
                              <SelectItem value="2">2 issues</SelectItem>
                              <SelectItem value="3">3 issues</SelectItem>
                              <SelectItem value="4">4 issues</SelectItem>
                              <SelectItem value="5">5 issues</SelectItem>
                            </SelectContent>
                          </Select>
                          {liveEngineItems > 0 && <span className="text-[9px] text-muted-foreground">{liveEngineItems} × ${getAmt("engine_issue_per_item").toLocaleString()}</span>}
                          <DeductBadge amount={engDeduct} />
                        </div>
                      )}

                      {/* Row: Mechanical & Electrical Issues (up to 4 issues) */}
                      {isOn("mechanical_issues") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Mechanical Issues</span>
                          <Select value={String(liveMechanicalItems)} onValueChange={v => setLiveMechanicalItems(Number(v))}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">None</SelectItem>
                              <SelectItem value="1">1 issue</SelectItem>
                              <SelectItem value="2">2 issues</SelectItem>
                              <SelectItem value="3">3 issues</SelectItem>
                              <SelectItem value="4">4 issues</SelectItem>
                            </SelectContent>
                          </Select>
                          {liveMechanicalItems > 0 && <span className="text-[9px] text-muted-foreground">{liveMechanicalItems} × ${getAmt("mechanical_issue_per_item").toLocaleString()}</span>}
                          <DeductBadge amount={mechDeduct} />
                        </div>
                      )}

                      {/* Row: Accidents — matches customer form: No accidents / 1 accident / 2+ accidents */}
                      {isOn("accidents") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Accidents</span>
                          <Select value={liveAccidents} onValueChange={setLiveAccidents}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">No accidents</SelectItem>
                              <SelectItem value="1">1 accident (-${getAmt("accidents_1").toLocaleString()})</SelectItem>
                              <SelectItem value="2+">2+ accidents (-${getAmt("accidents_2").toLocaleString()})</SelectItem>
                            </SelectContent>
                          </Select>
                          <DeductBadge amount={accidentDeduct} />
                        </div>
                      )}

                      {/* Row: Smoked In */}
                      {isOn("smoked_in") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Smoked In?</span>
                          <Select value={liveSmokedIn} onValueChange={setLiveSmokedIn}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">Not Smoked In</SelectItem>
                              <SelectItem value="yes">Smoked In (-${getAmt("smoked_in").toLocaleString()})</SelectItem>
                            </SelectContent>
                          </Select>
                          <DeductBadge amount={smokeDeduct} />
                        </div>
                      )}

                      {/* Row: Tires — matches customer form: None / 1 / 2 / 3 / 4 */}
                      {isOn("tires_not_replaced") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Tires Replaced</span>
                          <Select value={liveTiresReplaced} onValueChange={setLiveTiresReplaced}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="4">4 tires (no deduction)</SelectItem>
                              <SelectItem value="3">3 tires</SelectItem>
                              <SelectItem value="2">2 tires</SelectItem>
                              <SelectItem value="1">1 tire</SelectItem>
                              <SelectItem value="None">None (-${getAmt("tires_not_replaced").toLocaleString()})</SelectItem>
                            </SelectContent>
                          </Select>
                          <DeductBadge amount={tiresDeduct} />
                        </div>
                      )}

                      {/* Row: Keys — 2+ no deduction, 1 key deduction */}
                      {isOn("missing_keys") && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Keys</span>
                          <Select value={liveNumKeys} onValueChange={setLiveNumKeys}>
                            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2+">2+ keys (no deduction)</SelectItem>
                              <SelectItem value="1">1 key (-${getAmt("missing_keys_1").toLocaleString()})</SelectItem>
                            </SelectContent>
                          </Select>
                          <DeductBadge amount={keyDeduct} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Equipment — Factory Options (Customer-Selected) */}
              {liveBbVehicle.add_deduct_list?.length > 0 && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                      <div className="flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-[11px] text-card-foreground">③ Factory Equipment — Customer Selected ({liveSelectedAddDeducts.length}/{liveBbVehicle.add_deduct_list.length})</span>
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
                    {/* Inspector verification reminder */}
                    <div className="mx-1 mt-2 mb-1 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        Inspector: Verify all customer-selected equipment is present on the vehicle during in-person inspection.
                      </span>
                    </div>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto px-1 py-2">
                      {liveBbVehicle.add_deduct_list.map((ad: BBAddDeduct) => {
                        const isSelected = liveSelectedAddDeducts.includes(ad.uoc);
                        const isAutoDetected = ad.auto !== "N";
                        const dollarStr = ad.avg !== 0 ? ` (${ad.avg > 0 ? "+" : ""}$${Math.abs(ad.avg)})` : "";
                        return (
                          <label key={ad.uoc} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[10px] ${isSelected ? "bg-primary/10 text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleLiveAddDeduct(ad.uoc)} className="rounded border-border w-3 h-3" />
                            <span className="truncate">{ad.name}{dollarStr}</span>
                            {isSelected && (
                              <span className="text-[8px] bg-primary/15 text-primary px-1 rounded shrink-0">Customer ✓</span>
                            )}
                            {isAutoDetected && !isSelected && (
                              <span className="text-[8px] bg-muted text-muted-foreground px-1 rounded shrink-0">VIN detected</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {liveSelectedAddDeducts.length > 0 && (
                      <div className="mx-1 mb-1 px-2.5 py-1 text-[9px] text-muted-foreground border-t border-border">
                        <strong>{liveSelectedAddDeducts.length}</strong> option{liveSelectedAddDeducts.length !== 1 ? "s" : ""} selected by customer → value impact: <strong className={equipmentTotal >= 0 ? "text-emerald-600" : "text-destructive"}>{equipmentTotal >= 0 ? "+" : ""}${equipmentTotal.toLocaleString()}</strong>
                      </div>
                    )}
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


                  {/* Low-Mileage Bonus */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="font-semibold text-[11px] text-card-foreground">Low-Mileage Bonus</span>
                          {(localSettings as any).low_mileage_bonus?.enabled && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0">ON</Badge>
                          )}
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Enable low-mileage bonus</span>
                          <Switch
                            checked={(localSettings as any).low_mileage_bonus?.enabled ?? false}
                            onCheckedChange={(checked) => updateLocalSetting("low_mileage_bonus" as any, { ...(localSettings as any).low_mileage_bonus || {}, enabled: checked })}
                            className="scale-75"
                          />
                        </div>
                        {(localSettings as any).low_mileage_bonus?.enabled && (
                          <div className="space-y-1.5 border-t border-border pt-2">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Avg mi/year:</span>
                              <Input type="number" value={(localSettings as any).low_mileage_bonus?.avg_miles_per_year ?? 12000}
                                onChange={e => updateLocalSetting("low_mileage_bonus" as any, { ...(localSettings as any).low_mileage_bonus, avg_miles_per_year: Number(e.target.value) })}
                                className="w-20 h-5 text-[10px]" step="1000" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Bonus % per step:</span>
                              <Input type="number" value={(localSettings as any).low_mileage_bonus?.bonus_pct_per_step ?? 2}
                                onChange={e => updateLocalSetting("low_mileage_bonus" as any, { ...(localSettings as any).low_mileage_bonus, bonus_pct_per_step: Number(e.target.value) })}
                                className="w-14 h-5 text-[10px]" step="0.5" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Step size (% below):</span>
                              <Input type="number" value={(localSettings as any).low_mileage_bonus?.step_size_pct ?? 20}
                                onChange={e => updateLocalSetting("low_mileage_bonus" as any, { ...(localSettings as any).low_mileage_bonus, step_size_pct: Number(e.target.value) })}
                                className="w-14 h-5 text-[10px]" step="5" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Max bonus %:</span>
                              <Input type="number" value={(localSettings as any).low_mileage_bonus?.max_bonus_pct ?? 8}
                                onChange={e => updateLocalSetting("low_mileage_bonus" as any, { ...(localSettings as any).low_mileage_bonus, max_bonus_pct: Number(e.target.value) })}
                                className="w-14 h-5 text-[10px]" step="1" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Min mi/year floor:</span>
                              <Input type="number" value={(localSettings as any).low_mileage_bonus?.min_miles_per_year ?? 4000}
                                onChange={e => updateLocalSetting("low_mileage_bonus" as any, { ...(localSettings as any).low_mileage_bonus, min_miles_per_year: Number(e.target.value) })}
                                className="w-20 h-5 text-[10px]" step="500" />
                            </div>
                            <p className="text-[8px] text-muted-foreground leading-tight mt-1">
                              Vehicles averaging below the benchmark get a bonus. E.g., 40% below avg → 2 steps × 2% = +4% bonus. Floor prevents rewarding garaged/unused vehicles.
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* High-Mileage Penalty */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                        <div className="flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                          <span className="font-semibold text-[11px] text-card-foreground">High-Mileage Penalty</span>
                          {(localSettings as any).high_mileage_penalty?.enabled && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0">ON</Badge>
                          )}
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Enable high-mileage penalty</span>
                          <Switch
                            checked={(localSettings as any).high_mileage_penalty?.enabled ?? false}
                            onCheckedChange={(checked) => updateLocalSetting("high_mileage_penalty" as any, { ...(localSettings as any).high_mileage_penalty || DEFAULT_HIGH_MILEAGE_PENALTY, enabled: checked })}
                            className="scale-75"
                          />
                        </div>
                        {(localSettings as any).high_mileage_penalty?.enabled && (
                          <div className="space-y-1.5 border-t border-border pt-2">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Avg mi/year:</span>
                              <Input type="number" value={(localSettings as any).high_mileage_penalty?.avg_miles_per_year ?? 12000}
                                onChange={e => updateLocalSetting("high_mileage_penalty" as any, { ...(localSettings as any).high_mileage_penalty, avg_miles_per_year: Number(e.target.value) })}
                                className="w-20 h-5 text-[10px]" step="1000" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Penalty % per step:</span>
                              <Input type="number" value={(localSettings as any).high_mileage_penalty?.penalty_pct_per_step ?? 2}
                                onChange={e => updateLocalSetting("high_mileage_penalty" as any, { ...(localSettings as any).high_mileage_penalty, penalty_pct_per_step: Number(e.target.value) })}
                                className="w-14 h-5 text-[10px]" step="0.5" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Step size (% above):</span>
                              <Input type="number" value={(localSettings as any).high_mileage_penalty?.step_size_pct ?? 20}
                                onChange={e => updateLocalSetting("high_mileage_penalty" as any, { ...(localSettings as any).high_mileage_penalty, step_size_pct: Number(e.target.value) })}
                                className="w-14 h-5 text-[10px]" step="5" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Max penalty %:</span>
                              <Input type="number" value={(localSettings as any).high_mileage_penalty?.max_penalty_pct ?? 10}
                                onChange={e => updateLocalSetting("high_mileage_penalty" as any, { ...(localSettings as any).high_mileage_penalty, max_penalty_pct: Number(e.target.value) })}
                                className="w-14 h-5 text-[10px]" step="1" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Max mi/year cap:</span>
                              <Input type="number" value={(localSettings as any).high_mileage_penalty?.max_miles_per_year ?? 25000}
                                onChange={e => updateLocalSetting("high_mileage_penalty" as any, { ...(localSettings as any).high_mileage_penalty, max_miles_per_year: Number(e.target.value) })}
                                className="w-20 h-5 text-[10px]" step="1000" />
                            </div>
                            <p className="text-[8px] text-muted-foreground leading-tight mt-1">
                              Vehicles averaging above the benchmark get a penalty. E.g., 40% above avg → 2 steps × 2% = -4% penalty. Cap prevents penalizing commercial/fleet vehicles.
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Color Desirability */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-primary" />
                          <span className="font-semibold text-[11px] text-card-foreground">Color Desirability</span>
                          {(localSettings as any).color_desirability?.enabled && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0">ON</Badge>
                          )}
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Enable color adjustments</span>
                          <Switch
                            checked={(localSettings as any).color_desirability?.enabled ?? false}
                            onCheckedChange={(checked) => updateLocalSetting("color_desirability" as any, { ...(localSettings as any).color_desirability || DEFAULT_COLOR_DESIRABILITY, enabled: checked })}
                            className="scale-75"
                          />
                        </div>
                        {(localSettings as any).color_desirability?.enabled && (
                          <div className="grid grid-cols-2 gap-1 border-t border-border pt-2">
                            {Object.entries(((localSettings as any).color_desirability?.adjustments || DEFAULT_COLOR_DESIRABILITY.adjustments) as Record<string, number>).map(([color, pct]) => (
                              <div key={color} className="flex items-center gap-1 text-[10px]">
                                <span className="text-muted-foreground w-14 capitalize">{color}:</span>
                                <Input type="number" value={pct}
                                  onChange={e => {
                                    const adj = { ...((localSettings as any).color_desirability?.adjustments || DEFAULT_COLOR_DESIRABILITY.adjustments), [color]: Number(e.target.value) };
                                    updateLocalSetting("color_desirability" as any, { ...(localSettings as any).color_desirability, adjustments: adj });
                                  }}
                                  className="w-14 h-5 text-[9px]" step="0.5" />
                                <span className="text-[8px] text-muted-foreground">%</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[8px] text-muted-foreground leading-tight">
                          Adjust offer % based on exterior color demand. Positive = premium, negative = penalty.
                        </p>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Seasonal / Market Timing */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span className="font-semibold text-[11px] text-card-foreground">Seasonal / Market Timing</span>
                          {(localSettings as any).seasonal_adjustment?.enabled && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0">ON</Badge>
                          )}
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Enable seasonal adjustment</span>
                          <Switch
                            checked={(localSettings as any).seasonal_adjustment?.enabled ?? false}
                            onCheckedChange={(checked) => updateLocalSetting("seasonal_adjustment" as any, { ...(localSettings as any).seasonal_adjustment || DEFAULT_SEASONAL_ADJUSTMENT, enabled: checked })}
                            className="scale-75"
                          />
                        </div>
                        {(localSettings as any).seasonal_adjustment?.enabled && (
                          <div className="space-y-1.5 border-t border-border pt-2">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground w-28">Adjustment %:</span>
                              <Input type="number" value={(localSettings as any).seasonal_adjustment?.adjustment_pct ?? 0}
                                onChange={e => updateLocalSetting("seasonal_adjustment" as any, { ...(localSettings as any).seasonal_adjustment, adjustment_pct: Number(e.target.value) })}
                                className="w-16 h-5 text-[10px]" step="0.5" />
                            </div>
                            <p className="text-[8px] text-muted-foreground leading-tight">
                              Apply a temporary market timing adjustment. Use positive % in high-demand seasons, negative in slow periods.
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Deduction Modes (Flat vs %) */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-primary" />
                          <span className="font-semibold text-[11px] text-card-foreground">Deduction Modes</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 p-2">
                        <p className="text-[8px] text-muted-foreground leading-tight mb-2">
                          Choose whether accident and non-drivable deductions use flat dollar amounts or a percentage of the base value.
                          When set to %, the deduction amount fields represent percentages instead of dollars.
                        </p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground w-24">Accidents:</span>
                          <Select value={((localSettings as any).deduction_modes?.accidents) || "flat"} onValueChange={(v) => updateLocalSetting("deduction_modes" as any, { ...((localSettings as any).deduction_modes || DEFAULT_DEDUCTION_MODES), accidents: v })}>
                            <SelectTrigger className="h-5 w-24 text-[9px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="flat" className="text-[10px]">Flat ($)</SelectItem>
                              <SelectItem value="pct" className="text-[10px]">Percent (%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground w-24">Not Drivable:</span>
                          <Select value={((localSettings as any).deduction_modes?.not_drivable) || "flat"} onValueChange={(v) => updateLocalSetting("deduction_modes" as any, { ...((localSettings as any).deduction_modes || DEFAULT_DEDUCTION_MODES), not_drivable: v })}>
                            <SelectTrigger className="h-5 w-24 text-[9px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="flat" className="text-[10px]">Flat ($)</SelectItem>
                              <SelectItem value="pct" className="text-[10px]">Percent (%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
                          const modes = (localSettings as any).deduction_modes || DEFAULT_DEDUCTION_MODES;
                          const isPctMode = (key === "accidents" && modes.accidents === "pct") || (key === "not_drivable" && modes.not_drivable === "pct");
                          return (
                            <div key={key} className={`rounded border px-2 py-1 ${enabled ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 opacity-50"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-semibold text-card-foreground">{config.label}</span>
                                  {isPctMode && <Badge variant="outline" className="text-[7px] px-1 py-0">% mode</Badge>}
                                </div>
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
                                        className="w-14 h-5 text-[9px]" step={isPctMode ? "0.5" : "25"}
                                      />
                                      <span className="text-[7px] text-muted-foreground">{isPctMode ? "%" : "$"}</span>
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
                      retailAvg={(() => {
                        const basis = (settings as any).retail_profit_basis || "retail_avg";
                        const tierMap: Record<string, number> = {
                          retail_xclean: Number(liveBbVehicle.retail?.xclean || 0),
                          retail_clean: Number(liveBbVehicle.retail?.clean || 0),
                          retail_avg: Number(liveBbVehicle.retail?.avg || 0),
                          retail_rough: Number(liveBbVehicle.retail?.rough || 0),
                        };
                        return tierMap[basis] || Number(liveBbVehicle.retail?.avg || 0);
                      })()}
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
