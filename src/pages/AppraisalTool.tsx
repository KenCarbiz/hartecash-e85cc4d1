import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Car, DollarSign, TrendingUp, TrendingDown, Minus, Target,
  Gauge, Wrench, ChevronDown, Save, AlertTriangle, CheckCircle, XCircle,
  Pencil, ArrowDown, Loader2, ClipboardCheck, BarChart3, ArrowRight,
  Calendar, Plus, Trash2, Shield, SlidersHorizontal, CheckSquare, Zap, Lock, Unlock,
} from "lucide-react";
import ProfitSpreadGauge from "@/components/admin/ProfitSpreadGauge";
import MarketContextPanel from "@/components/admin/MarketContextPanel";
import RetailMarketPanel from "@/components/admin/RetailMarketPanel";
import BrakePadDepthWidget from "@/components/inspection/BrakePadDepthWidget";
import { calculateOffer, type OfferSettings, type OfferRule, type OfferEstimate, calcHighMileagePenaltyPct, calcColorAdjustmentPct, DEFAULT_HIGH_MILEAGE_PENALTY, DEFAULT_COLOR_DESIRABILITY, DEFAULT_SEASONAL_ADJUSTMENT } from "@/lib/offerCalculator";
import type { FormData, BBVehicle, BBAddDeduct } from "@/components/sell-form/types";
import { formatGrade } from "@/lib/formatGrade";

// ── Types ──
interface Submission {
  id: string; token: string;
  vehicle_year: string | null; vehicle_make: string | null; vehicle_model: string | null;
  vin: string | null; mileage: string | null; exterior_color: string | null;
  overall_condition: string | null; offered_price: number | null;
  estimated_offer_high: number | null; estimated_offer_low: number | null;
  acv_value: number | null;
  bb_tradein_avg: number | null; bb_wholesale_avg: number | null; bb_retail_avg: number | null;
  bb_msrp: number | null; bb_mileage_adj: number | null; bb_regional_adj: number | null;
  bb_base_whole_avg: number | null; bb_add_deducts: any;
  bb_class_name: string | null; bb_drivetrain: string | null;
  bb_transmission: string | null; bb_fuel_type: string | null; bb_engine: string | null;
  bb_value_tiers: any;
  name: string | null; phone: string | null; email: string | null;
  progress_status: string;
  accidents: string | null; drivable: string | null; smoked_in: string | null;
  tires_replaced: string | null; num_keys: string | null;
  exterior_damage: string[] | null; interior_damage: string[] | null;
  windshield_damage: string | null; moonroof: string | null;
  tech_issues: string[] | null; engine_issues: string[] | null;
  mechanical_issues: string[] | null; modifications: string | null;
  drivetrain: string | null; internal_notes: string | null;
  tire_lf: number | null; tire_rf: number | null; tire_lr: number | null; tire_rr: number | null;
  tire_adjustment: number | null;
  brake_lf: number | null; brake_rf: number | null; brake_lr: number | null; brake_rr: number | null;
  ai_condition_score: string | null; ai_damage_summary: string | null;
  appraised_by: string | null; zip: string | null;
  inspector_grade: string | null;
  bb_selected_options: string[] | null;
  appraisal_finalized: boolean;
  appraisal_finalized_at: string | null;
  appraisal_finalized_by: string | null;
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
    label: "WHOLESALE",
    tiers: [
      { key: "wholesale_xclean", short: "X-Clean", tierKey: "xclean" },
      { key: "wholesale_clean", short: "Clean", tierKey: "clean" },
      { key: "wholesale_avg", short: "Avg", tierKey: "avg" },
      { key: "wholesale_rough", short: "Rough", tierKey: "rough" },
    ],
    dataKey: "wholesale" as const,
  },
  {
    label: "TRADE-IN",
    tiers: [
      { key: "tradein_clean", short: "Clean", tierKey: "clean" },
      { key: "tradein_avg", short: "Avg", tierKey: "avg" },
      { key: "tradein_rough", short: "Rough", tierKey: "rough" },
    ],
    dataKey: "tradein" as const,
  },
  {
    label: "RETAIL",
    tiers: [
      { key: "retail_xclean", short: "X-Clean", tierKey: "xclean" },
      { key: "retail_clean", short: "Clean", tierKey: "clean" },
      { key: "retail_avg", short: "Avg", tierKey: "avg" },
      { key: "retail_rough", short: "Rough", tierKey: "rough" },
    ],
    dataKey: "retail" as const,
  },
];

// ── Waterfall Block ──
interface WaterfallBlock {
  id: string; label: string; value: number; runningTotal: number;
  type: "base" | "add" | "subtract" | "total";
  editable: boolean; editKey?: string; editType?: "flat" | "pct" | "multiplier";
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
              min={block.editType === "multiplier" ? 50 : block.editType === "pct" ? -30 : -5000}
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

// Helper to calc equipment total
function calcEquipmentTotal(bbVehicle: BBVehicle, selectedAddDeducts: string[]): number {
  return (bbVehicle.add_deduct_list || [])
    .filter((ad: BBAddDeduct) => selectedAddDeducts.includes(ad.uoc))
    .reduce((sum: number, ad: BBAddDeduct) => sum + (ad.avg || 0), 0);
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
export default function AppraisalTool() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<Submission | null>(null);
  const [settings, setSettings] = useState<OfferSettings | null>(null);
  const [rules, setRules] = useState<OfferRule[]>([]);
  const [dealerPack, setDealerPack] = useState(0);
  const [hidePackFromAppraisal, setHidePackFromAppraisal] = useState(false);
  const [retailProfitBasis, setRetailProfitBasis] = useState("retail_avg");
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [depthPolicies, setDepthPolicies] = useState<{ id: string; name: string; policy_type: string; oem_brands: string[]; all_brands: boolean; max_vehicle_age_years: number | null; max_mileage: number | null; min_tire_depth: number; min_brake_depth: number }[]>([]);

  // Editable overrides
  const [localSettings, setLocalSettings] = useState<OfferSettings | null>(null);
  const [acvOverride, setAcvOverride] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [bbValueBasis, setBbValueBasis] = useState("tradein_avg");

  // Editable condition fields (pre-filled from customer, overridable by appraiser)
  const [condition, setCondition] = useState("good");
  const [accidents, setAccidents] = useState("0");
  const [drivable, setDrivable] = useState("yes");
  const [smokedIn, setSmokedIn] = useState("no");
  const [exteriorItems, setExteriorItems] = useState(0);
  const [interiorItems, setInteriorItems] = useState(0);
  const [mechItems, setMechItems] = useState(0);
  const [engineItems, setEngineItems] = useState(0);
  const [techItems, setTechItems] = useState(0);
  const [windshield, setWindshield] = useState("none");
  const [moonroof, setMoonroof] = useState("No moonroof");
  const [tiresReplaced, setTiresReplaced] = useState("4");
  const [numKeys, setNumKeys] = useState("2+");
  const [modifications, setModifications] = useState("none");

  // Live BB vehicle for full calc
  const [liveBbVehicle, setLiveBbVehicle] = useState<BBVehicle | null>(null);
  const [liveSelectedAddDeducts, setLiveSelectedAddDeducts] = useState<string[]>([]);
  const [bbLoading, setBbLoading] = useState(false);

  const updateLocalSetting = useCallback(<K extends keyof OfferSettings>(key: K, value: OfferSettings[K]) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : prev);
  }, []);

  // Load data
  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      const { data: subData } = await supabase.from("submissions").select("*").eq("token", token).maybeSingle();
      if (!subData) { toast({ title: "Not Found", description: "Submission not found.", variant: "destructive" }); setLoading(false); return; }
      const s = subData as any as Submission;
      setSub(s);
      setAcvOverride(s.acv_value ?? null);
      // Map customer condition to our 4-tier system
      const custCondition = s.inspector_grade || s.overall_condition || "good";
      setCondition(custCondition);
      // Map customer answers to local state
      const custAccidents = s.accidents || "No accidents";
      if (custAccidents.includes("1")) setAccidents("1");
      else if (custAccidents.includes("2") || custAccidents.includes("3")) setAccidents("2+");
      else setAccidents("0");

      const custDrivable = s.drivable || "Drivable";
      setDrivable(custDrivable.toLowerCase().includes("not") ? "no" : "yes");

      setSmokedIn((s.smoked_in || "No").toLowerCase().includes("yes") ? "yes" : "no");

      setExteriorItems((s.exterior_damage || []).filter(d => d !== "none" && d !== "No exterior damage").length);
      setInteriorItems((s.interior_damage || []).filter(d => d !== "none" && d !== "No interior damage").length);
      setMechItems((s.mechanical_issues || []).filter(d => d !== "none" && d !== "No mechanical issues").length);
      setEngineItems((s.engine_issues || []).filter(d => d !== "none" && d !== "No engine issues").length);
      setTechItems((s.tech_issues || []).filter(d => d !== "none" && d !== "No tech issues").length);

      // Windshield
      const wd = (s.windshield_damage || "").toLowerCase();
      if (wd.includes("major") || wd.includes("crack")) setWindshield("major_cracks");
      else if (wd.includes("minor") || wd.includes("chip") || wd.includes("pitting")) setWindshield("minor_chips");
      else setWindshield("none");

      // Moonroof
      const mr = (s.moonroof || "").toLowerCase();
      if (mr.includes("doesn't") || mr.includes("not working") || mr.includes("broken")) setMoonroof("Doesn't work");
      else if (mr.includes("works") || mr.includes("great")) setMoonroof("Works great");
      else setMoonroof("No moonroof");

      // Tires
      const tr = s.tires_replaced || "4";
      setTiresReplaced(tr);

      // Keys
      const nk = s.num_keys || "2+";
      setNumKeys(nk);

      // Modifications
      setModifications((s.modifications || "").trim() ? "yes" : "none");

      const { data: settingsData } = await supabase.from("offer_settings").select("*").eq("dealership_id", dealershipId).maybeSingle();
      if (settingsData) {
        setSettings(settingsData as any);
        setLocalSettings(settingsData as any);
        setDealerPack((settingsData as any).dealer_pack ?? 0);
        setHidePackFromAppraisal((settingsData as any).hide_pack_from_appraisal ?? false);
        setRetailProfitBasis((settingsData as any).retail_profit_basis || "retail_avg");
        setBbValueBasis(settingsData.bb_value_basis || "tradein_avg");
      }

      const { data: rulesData } = await supabase.from("offer_rules").select("*").eq("dealership_id", dealershipId).eq("is_active", true);
      if (rulesData) setRules(rulesData as any);

      const { data: policiesData } = await supabase.from("depth_policies").select("*").eq("dealership_id", dealershipId).eq("is_active", true).order("sort_order");
      if (policiesData) setDepthPolicies(policiesData as any);

      // BB lookup
      if (s.vin) {
        setBbLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke("bb-lookup", {
            body: { lookup_type: "vin", vin: s.vin, mileage: parseInt(s.mileage || "0") || 50000 },
          });
          if (!error && data?.vehicles?.length > 0) {
            const vehicle = data.vehicles[0] as BBVehicle;
            setLiveBbVehicle(vehicle);
            const customerSelections: string[] = s.bb_selected_options || [];
            if (customerSelections.length > 0) {
              setLiveSelectedAddDeducts(customerSelections);
            } else {
              const autoSelected = (vehicle.add_deduct_list || []).filter((ad: BBAddDeduct) => ad.auto !== "N").map((ad: BBAddDeduct) => ad.uoc);
              setLiveSelectedAddDeducts(autoSelected);
            }
          }
        } catch (e) { console.error("BB lookup for appraisal:", e); }
        setBbLoading(false);
      }

      setLoading(false);
    };
    load();
  }, [token]);

  const activeSettings = localSettings;

  // Map simulator values to match customer form values for offerCalculator
  const mappedWindshield = windshield === "minor_chips" ? "Minor chips or pitting" : windshield === "major_cracks" ? "Major cracks or chips" : "No windshield damage";
  const mappedDrivable = drivable === "no" ? "Not drivable" : "Drivable";
  const mappedAccidents = accidents === "0" ? "No accidents" : accidents === "1" ? "1 accident" : "2+ accidents";
  const mappedSmokedIn = smokedIn === "yes" ? "Yes" : "No";
  const mappedTires = tiresReplaced;
  const mappedKeys = numKeys === "2+" ? "2+" : numKeys;

  // Build form data from editable condition fields
  const formData: FormData = useMemo(() => ({
    plate: "", state: sub?.zip || "", vin: sub?.vin || "", mileage: sub?.mileage || "0",
    bbUvc: "", bbSelectedAddDeducts: liveSelectedAddDeducts,
    exteriorColor: sub?.exterior_color || "", drivetrain: sub?.drivetrain || "",
    modifications: modifications === "none" ? "" : modifications,
    overallCondition: condition,
    exteriorDamage: Array.from({ length: exteriorItems }, (_, i) => `item_${i}`),
    windshieldDamage: mappedWindshield, moonroof,
    interiorDamage: Array.from({ length: interiorItems }, (_, i) => `item_${i}`),
    techIssues: Array.from({ length: techItems }, (_, i) => `item_${i}`),
    engineIssues: Array.from({ length: engineItems }, (_, i) => `item_${i}`),
    mechanicalIssues: Array.from({ length: mechItems }, (_, i) => `item_${i}`),
    drivable: mappedDrivable, accidents: mappedAccidents, smokedIn: mappedSmokedIn,
    tiresReplaced: mappedTires, numKeys: mappedKeys,
    name: sub?.name || "", phone: sub?.phone || "", email: sub?.email || "", zip: sub?.zip || "",
    loanStatus: "", loanCompany: "", loanBalance: "", loanPayment: "",
    nextStep: "", preferredLocationId: "", salespersonName: "",
  }), [sub, condition, accidents, drivable, smokedIn, exteriorItems, interiorItems, mechItems, engineItems, techItems, windshield, moonroof, tiresReplaced, numKeys, modifications, liveSelectedAddDeducts, mappedWindshield, mappedDrivable, mappedAccidents, mappedSmokedIn, mappedTires, mappedKeys]);

  // Use live BB vehicle if available, else reconstruct from stored data
  const bbVehicle: BBVehicle | null = useMemo(() => {
    if (liveBbVehicle) return liveBbVehicle;
    if (!sub || !sub.bb_tradein_avg) return null;
    // Try to reconstruct from bb_value_tiers if available
    const tiers = sub.bb_value_tiers as any;
    return {
      year: sub.vehicle_year || "", make: sub.vehicle_make || "", model: sub.vehicle_model || "",
      series: "", style: "", uvc: "", vin: sub.vin || "", price_includes: "",
      exterior_colors: [], class_name: sub.bb_class_name || "",
      drivetrain: sub.bb_drivetrain || "", engine: sub.bb_engine || "",
      transmission: sub.bb_transmission || "", fuel_type: sub.bb_fuel_type || "",
      msrp: Number(sub.bb_msrp || 0),
      wholesale: tiers?.wholesale || { avg: sub.bb_wholesale_avg || 0, clean: 0, rough: 0, xclean: 0 },
      tradein: tiers?.tradein || { avg: sub.bb_tradein_avg || 0, clean: 0, rough: 0 },
      retail: tiers?.retail || { avg: sub.bb_retail_avg || 0, clean: 0, rough: 0, xclean: 0 },
      mileage_adj: sub.bb_mileage_adj || 0, regional_adj: sub.bb_regional_adj || 0,
      base_whole_avg: sub.bb_base_whole_avg || 0,
      add_deduct_list: Array.isArray(sub.bb_add_deducts) ? sub.bb_add_deducts : [],
    };
  }, [liveBbVehicle, sub]);

  const equipmentTotal = useMemo(() => {
    if (!bbVehicle) return 0;
    return calcEquipmentTotal(bbVehicle, liveSelectedAddDeducts);
  }, [bbVehicle, liveSelectedAddDeducts]);

  const offerResult = useMemo(() => {
    if (!bbVehicle || !activeSettings) return null;
    return calculateOffer(bbVehicle, formData, liveSelectedAddDeducts, activeSettings, rules);
  }, [bbVehicle, formData, liveSelectedAddDeducts, activeSettings, rules]);

  // Effective values
  const currentOffer = sub?.offered_price || sub?.estimated_offer_high || 0;
  const effectivePack = dealerPack;
  // Resolve retail value based on dealer's chosen retail_profit_basis
  const RETAIL_TIERS = ["retail_xclean", "retail_clean", "retail_avg", "retail_rough"] as const;
  const RETAIL_TIER_LABELS: Record<string, string> = { retail_xclean: "Retail X-Clean", retail_clean: "Retail Clean", retail_avg: "Retail Avg", retail_rough: "Retail Rough" };
  const resolveRetailValue = (basis: string) => {
    if (!bbVehicle) return sub?.bb_retail_avg ? Number(sub.bb_retail_avg) : 0;
    const tierMap: Record<string, number> = {
      retail_xclean: Number(bbVehicle.retail?.xclean || 0),
      retail_clean: Number(bbVehicle.retail?.clean || 0),
      retail_avg: Number(bbVehicle.retail?.avg || 0),
      retail_rough: Number(bbVehicle.retail?.rough || 0),
    };
    return tierMap[basis] || Number(bbVehicle.retail?.avg || sub?.bb_retail_avg || 0);
  };
  const retailAvg = resolveRetailValue(retailProfitBasis);
  const wholesaleAvg = Number(bbVehicle?.wholesale?.avg || sub?.bb_wholesale_avg || 0);
  const tradeinAvg = Number(bbVehicle?.tradein?.avg || sub?.bb_tradein_avg || 0);
  const cycleRetailBasis = () => {
    const idx = RETAIL_TIERS.indexOf(retailProfitBasis as any);
    const next = RETAIL_TIERS[(idx + 1) % RETAIL_TIERS.length];
    setRetailProfitBasis(next);
  };

  // Build waterfall blocks — matching OfferSimulator with all adjustments
  const waterfallBlocks: WaterfallBlock[] = useMemo(() => {
    if (!offerResult || !activeSettings || !bbVehicle) return [];
    const blocks: WaterfallBlock[] = [];
    let running = offerResult.baseValue;
    const condMult = activeSettings.condition_multipliers?.[condition as keyof typeof activeSettings.condition_multipliers] ?? 1;
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - Number(bbVehicle.year);
    const mileageNum = parseInt((sub?.mileage || "0").replace(/[^0-9]/g, "")) || 0;
    const matchedAge = (activeSettings.age_tiers || []).find((t: any) => vehicleAge >= t.min_years && vehicleAge <= t.max_years);

    // 1. Base
    blocks.push({ id: "base", label: "Base Value", value: running, runningTotal: running, type: "base", editable: true, editKey: "bb_value_basis", editType: "flat" });

    // 2. Condition
    const condAdj = Math.round(offerResult.baseValue * condMult) - offerResult.baseValue;
    running += condAdj;
    blocks.push({ id: "condition", label: `Condition (${CONDITION_LABELS[condition] || condition})`, value: condAdj, runningTotal: running, type: condAdj >= 0 ? "add" : "subtract", editable: true, editKey: "condition_multiplier", editType: "multiplier", currentEditValue: condMult });

    // 3. Equipment
    const condEquipMap = (activeSettings as any).condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true };
    const equipEnabled = condEquipMap[condition] ?? true;
    const effectiveEquip = equipEnabled ? equipmentTotal : 0;
    if (effectiveEquip !== 0) {
      running += effectiveEquip;
      blocks.push({ id: "equipment", label: "Equipment", value: effectiveEquip, runningTotal: running, type: effectiveEquip >= 0 ? "add" : "subtract", editable: false });
    }

    // 4. Deductions
    if (offerResult.totalDeductions > 0) {
      running -= offerResult.totalDeductions;
      blocks.push({ id: "deductions", label: "Deductions", value: -offerResult.totalDeductions, runningTotal: running, type: "subtract", editable: false });
    }

    // 5. Recon & Pack are NOT subtracted from customer offer — they are internal costs for profit analysis only

    // 6. Global %
    if (activeSettings.global_adjustment_pct !== 0) {
      const adj = Math.round(running * (activeSettings.global_adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "global", label: `Global (${activeSettings.global_adjustment_pct > 0 ? "+" : ""}${activeSettings.global_adjustment_pct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: true, editKey: "global_adjustment_pct", editType: "pct", currentEditValue: activeSettings.global_adjustment_pct });
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

    // 9. Low-Mileage Bonus
    const lmb = (activeSettings as any).low_mileage_bonus;
    if (lmb?.enabled && bbVehicle.year) {
      const age = Math.max(currentYear - Number(bbVehicle.year), 1);
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

    // 10. High-Mileage Penalty
    const hmp = (activeSettings as any).high_mileage_penalty || DEFAULT_HIGH_MILEAGE_PENALTY;
    if (hmp?.enabled && bbVehicle.year) {
      const age = Math.max(currentYear - Number(bbVehicle.year), 1);
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

    // 11. Seasonal
    const seasonal = (activeSettings as any).seasonal_adjustment || DEFAULT_SEASONAL_ADJUSTMENT;
    if (seasonal?.enabled && seasonal.adjustment_pct !== 0) {
      const adj = Math.round(running * (seasonal.adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "seasonal", label: `Seasonal (${seasonal.adjustment_pct > 0 ? "+" : ""}${seasonal.adjustment_pct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: false });
    }

    // 12. Color Desirability
    const colorConfig = (activeSettings as any).color_desirability || DEFAULT_COLOR_DESIRABILITY;
    if (colorConfig?.enabled) {
      const sampleColor = sub?.exterior_color || bbVehicle.exterior_colors?.[0]?.name || "";
      const colorPct = calcColorAdjustmentPct(sampleColor, colorConfig);
      if (colorPct !== 0) {
        const adj = Math.round(running * (colorPct / 100));
        running += adj;
        blocks.push({ id: "color", label: `Color (${sampleColor || "—"}) ${colorPct > 0 ? "+" : ""}${colorPct}%`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: false });
      }
    }

    // 13. Tire adjustment
    if (sub?.tire_adjustment && sub.tire_adjustment !== 0) {
      running += Number(sub.tire_adjustment);
      blocks.push({ id: "tire_adj", label: "Tire Adjustment", value: Number(sub.tire_adjustment), runningTotal: running, type: Number(sub.tire_adjustment) >= 0 ? "add" : "subtract", editable: false });
    }

    // Floor
    const clamped = Math.max(running, activeSettings.offer_floor || 500);
    if (clamped !== running) {
      blocks.push({ id: "floor", label: `Floor ($${(activeSettings.offer_floor || 500).toLocaleString()})`, value: clamped - running, runningTotal: clamped, type: "add", editable: false });
      running = clamped;
    }

    blocks.push({ id: "final", label: "FINAL OFFER", value: running, runningTotal: running, type: "total", editable: false });
    return blocks;
  }, [offerResult, activeSettings, bbVehicle, condition, sub, effectivePack, equipmentTotal, hidePackFromAppraisal]);

  const maxVal = Math.max(...waterfallBlocks.map(s => Math.max(Math.abs(s.runningTotal), Math.abs(s.value), s.type === "base" ? s.value : 0)), 1);

  const waterfallFinal = waterfallBlocks.find(b => b.id === "final")?.runningTotal ?? 0;
  const finalValue = acvOverride != null && acvOverride > 0 ? acvOverride : waterfallFinal;
  const reconCost = activeSettings?.recon_cost || 0;
  const projectedProfit = retailAvg > 0 ? retailAvg - finalValue - effectivePack - reconCost : 0;
  const profitMargin = retailAvg > 0 ? (projectedProfit / retailAvg) * 100 : 0;

  const handleBlockValueChange = useCallback((editKey: string, value: number, editType: string) => {
    if (editKey === "condition_multiplier") {
      updateLocalSetting("condition_multipliers", { excellent: 1, very_good: 1, good: 1, fair: 1, ...(activeSettings?.condition_multipliers || {}), [condition]: value });
    } else if (editKey === "recon_cost") {
      updateLocalSetting("recon_cost", value);
    } else if (editKey === "global_adjustment_pct") {
      updateLocalSetting("global_adjustment_pct", value);
    } else if (editKey === "regional_adjustment_pct") {
      updateLocalSetting("regional_adjustment_pct", value);
    } else if (editKey === "offer_floor") {
      updateLocalSetting("offer_floor", value);
    }
  }, [activeSettings, condition, updateLocalSetting]);

  const toggleAddDeduct = (uoc: string) => {
    setLiveSelectedAddDeducts(prev => prev.includes(uoc) ? prev.filter(u => u !== uoc) : [...prev, uoc]);
  };

   // Save Final Appraised Value
  const handleSave = async () => {
    if (!sub) return;
    if (sub.appraisal_finalized) {
      toast({ title: "Locked", description: "Appraisal is finalized. Unlock to make changes.", variant: "destructive" });
      return;
    }
    const saveVal = acvOverride != null && acvOverride > 0 ? acvOverride : finalValue;
    setSaving(true);
    const { error } = await supabase.from("submissions").update({ acv_value: saveVal }).eq("id", sub.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSub(prev => prev ? { ...prev, acv_value: saveVal } : prev);
      setAcvOverride(saveVal);
      setLastSavedAt(new Date());
      toast({ title: "Saved", description: `Appraisal value set to $${saveVal.toLocaleString()}` });
    }
    setSaving(false);
  };

  // Finalize / lock the appraisal
  const handleFinalize = async () => {
    if (!sub) return;
    const saveVal = acvOverride != null && acvOverride > 0 ? acvOverride : finalValue;
    setSaving(true);
    const { error } = await supabase.from("submissions").update({
      acv_value: saveVal,
      appraisal_finalized: true,
      appraisal_finalized_at: new Date().toISOString(),
      appraisal_finalized_by: sub.appraised_by || "Staff",
    } as any).eq("id", sub.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSub(prev => prev ? { ...prev, acv_value: saveVal, appraisal_finalized: true, appraisal_finalized_at: new Date().toISOString(), appraisal_finalized_by: sub.appraised_by || "Staff" } : prev);
      setAcvOverride(saveVal);
      toast({ title: "Appraisal Finalized", description: `Locked at $${saveVal.toLocaleString()}. Check request can now be generated.` });
    }
    setSaving(false);
  };

  // Unlock appraisal
  const handleUnlockAppraisal = async () => {
    if (!sub) return;
    setSaving(true);
    const { error } = await supabase.from("submissions").update({
      appraisal_finalized: false,
      appraisal_finalized_at: null,
      appraisal_finalized_by: null,
    } as any).eq("id", sub.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSub(prev => prev ? { ...prev, appraisal_finalized: false, appraisal_finalized_at: null, appraisal_finalized_by: null } : prev);
      toast({ title: "Unlocked", description: "Appraisal unlocked for editing." });
    }
    setSaving(false);
  };
  const inspectionData = useMemo(() => {
    if (!sub?.internal_notes) return null;
    if (!sub.internal_notes.includes("[INSPECTION")) return null;
    return sub.internal_notes;
  }, [sub]);

  const brakeDepths = useMemo(() => {
    if (sub?.brake_lf != null || sub?.brake_rf != null || sub?.brake_lr != null || sub?.brake_rr != null) {
      return { lf: sub.brake_lf, rf: sub.brake_rf, lr: sub.brake_lr, rr: sub.brake_rr };
    }
    return null;
  }, [sub]);

  const hasBrakes = !!(brakeDepths && (brakeDepths.lf != null || brakeDepths.rf != null || brakeDepths.lr != null || brakeDepths.rr != null));

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
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

  const hasTires = !!(sub.tire_lf && sub.tire_rf && sub.tire_lr && sub.tire_rr);
  const avgTireDepth = hasTires ? ((sub.tire_lf! + sub.tire_rf! + sub.tire_lr! + sub.tire_rr!) / 4).toFixed(1) : null;
  const hasInspection = !!(hasTires || hasBrakes || inspectionData);

  // Customer's original answers for comparison
  const customerAnswers = {
    condition: sub.overall_condition,
    accidents: sub.accidents,
    drivable: sub.drivable,
    smokedIn: sub.smoked_in,
    exteriorDamage: sub.exterior_damage,
    interiorDamage: sub.interior_damage,
    windshield: sub.windshield_damage,
    moonroof: sub.moonroof,
    tires: sub.tires_replaced,
    keys: sub.num_keys,
    modifications: sub.modifications,
    mechIssues: sub.mechanical_issues,
    engineIssues: sub.engine_issues,
    techIssues: sub.tech_issues,
  };

  // Deduction helpers
  const da = activeSettings?.deduction_amounts || {} as Record<string, number>;
  const dc = activeSettings?.deductions_config || {} as Record<string, boolean>;
  const getAmt = (key: string) => (da as any)[key] || 0;
  const isOn = (key: string) => (dc as any)[key] !== false;
  const accidentDeduct = accidents === "1" ? getAmt("accidents_1") : accidents === "2+" ? getAmt("accidents_2") : 0;
  const extDeduct = exteriorItems * getAmt("exterior_damage_per_item");
  const intDeduct = interiorItems * getAmt("interior_damage_per_item");
  const windDeduct = windshield === "major_cracks" ? getAmt("windshield_cracked") : windshield === "minor_chips" ? getAmt("windshield_chipped") : 0;
  const moonroofDeduct = moonroof === "Doesn't work" ? getAmt("moonroof_broken") : 0;
  const engDeduct = engineItems * getAmt("engine_issue_per_item");
  const mechDeduct = mechItems * getAmt("mechanical_issue_per_item");
  const techDeduct = techItems * getAmt("tech_issue_per_item");
  const drivDeduct = drivable === "no" ? getAmt("not_drivable") : 0;
  const smokeDeduct = smokedIn === "yes" ? getAmt("smoked_in") : 0;
  const tiresDeduct = (tiresReplaced === "None" || tiresReplaced === "1") ? getAmt("tires_not_replaced") : 0;
  const keyDeduct = numKeys === "1" ? getAmt("missing_keys_1") : numKeys === "0" ? getAmt("missing_keys_0") : 0;

  const DeductBadge = ({ amount }: { amount: number }) => amount > 0 ? (
    <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full ml-auto shrink-0">
      -${amount.toLocaleString()}
    </span>
  ) : (
    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full ml-auto shrink-0">
      No deduction
    </span>
  );

  const SourceTag = ({ customer, inspector }: { customer?: string | null; inspector?: boolean }) => {
    if (inspector) return <Badge variant="outline" className="text-[7px] px-1 py-0 border-primary/40 text-primary shrink-0">Inspector</Badge>;
    if (customer) return <Badge variant="outline" className="text-[7px] px-1 py-0 border-amber-400/50 text-amber-600 shrink-0">Customer</Badge>;
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-primary via-[hsl(210,100%,28%)] to-[hsl(215,90%,22%)] text-primary-foreground px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="border-l border-primary-foreground/15 pl-4">
              <h1 className="font-display text-xl tracking-wide">
                {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}
              </h1>
              <p className="text-primary-foreground/60 text-sm mt-0.5">
                {sub.name} · {sub.vin || "No VIN"} · {sub.mileage ? `${Number(sub.mileage).toLocaleString()} mi` : "—"}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground rounded-xl border border-primary-foreground/10 shadow-lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save Appraisal
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* ═══ HUD — Key Metrics Strip ═══ */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 ${hidePackFromAppraisal ? "lg:grid-cols-7" : "lg:grid-cols-8"} gap-2.5 mb-5`}>
          {(() => {
            const inventoryCost = finalValue + reconCost + effectivePack;
            const metrics = [
              { label: "Customer Offer", value: `$${Math.floor(currentOffer).toLocaleString()}`, color: "text-card-foreground", bg: "bg-card border-border/60 shadow-sm", sub: null },
              { label: "Appraisal Value", value: `$${Math.floor(finalValue).toLocaleString()}`, color: sub?.appraisal_finalized ? "text-emerald-700" : "text-primary", bg: sub?.appraisal_finalized ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/20" : "bg-primary/5 border-primary/25 shadow-sm shadow-primary/5", sub: sub?.appraisal_finalized ? `✓ Finalized ${sub.appraisal_finalized_at ? new Date(sub.appraisal_finalized_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}` : lastSavedAt ? `Updated ${lastSavedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : null },
            ];
            if (hidePackFromAppraisal) {
              metrics.push({ label: "Recon Cost", value: `$${Math.floor(reconCost + effectivePack).toLocaleString()}`, color: "text-destructive", bg: "bg-card border-border/60 shadow-sm", sub: null });
            } else {
              metrics.push({ label: "Recon Cost", value: `$${Math.floor(reconCost).toLocaleString()}`, color: "text-destructive", bg: "bg-card border-border/60 shadow-sm", sub: null });
              metrics.push({ label: "Dealer Pack", value: `$${Math.floor(effectivePack).toLocaleString()}`, color: "text-destructive", bg: "bg-card border-border/60 shadow-sm", sub: null });
            }
            metrics.push(
              { label: "Inventory Cost", value: `$${Math.floor(inventoryCost).toLocaleString()}`, color: "text-amber-600", bg: "bg-amber-500/5 border-amber-500/25 shadow-sm", sub: null },
              { label: "__RETAIL__", value: retailAvg > 0 ? `$${Math.floor(retailAvg).toLocaleString()}` : "—", color: "text-card-foreground", bg: "bg-card border-border/60 shadow-sm cursor-pointer hover:border-primary/50", sub: "Click to change tier" },
              { label: "Projected Profit", value: `${projectedProfit >= 0 ? "+" : ""}$${Math.floor(Math.abs(projectedProfit)).toLocaleString()}`, color: projectedProfit >= 0 ? "text-emerald-600" : "text-destructive", bg: projectedProfit >= 0 ? "bg-emerald-500/5 border-emerald-500/25 shadow-sm" : "bg-destructive/5 border-destructive/25 shadow-sm", sub: null },
              { label: "Margin %", value: `${profitMargin.toFixed(1)}%`, color: profitMargin >= 0 ? "text-emerald-600" : "text-destructive", bg: profitMargin >= 0 ? "bg-emerald-500/5 border-emerald-500/25 shadow-sm" : "bg-destructive/5 border-destructive/25 shadow-sm", sub: null },
            );
            return metrics;
          })().map(metric => (
            <div
              key={metric.label}
              className={`rounded-xl border p-3 text-center transition-all hover:shadow-md ${metric.bg}`}
              onClick={metric.label === "__RETAIL__" ? cycleRetailBasis : undefined}
              role={metric.label === "__RETAIL__" ? "button" : undefined}
            >
              <div className="text-[9px] uppercase tracking-[0.08em] font-bold text-muted-foreground mb-0.5">
                {metric.label === "__RETAIL__" ? (RETAIL_TIER_LABELS[retailProfitBasis] || "Retail Avg") : metric.label}
              </div>
              <div className={`text-lg font-black tracking-tight ${metric.color}`}>{metric.value}</div>
              {metric.sub && <div className={`mt-0.5 ${metric.label === "Appraisal Value" && sub?.appraisal_finalized ? "text-[10px] font-bold text-emerald-600" : "text-[8px] text-muted-foreground"}`}>{metric.sub}</div>}
            </div>
          ))}
        </div>

        {/* Vehicle Summary Bar */}
        <div className="bg-card rounded-xl border border-border/60 p-4 mb-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-2.5">
            <Car className="w-4 h-4 text-primary" />
            <span className="font-display text-sm text-card-foreground">
              {sub.vehicle_year} {(sub.vehicle_make || "").toUpperCase()} {(sub.vehicle_model || "").toUpperCase()} {liveBbVehicle?.series || ""}
            </span>
            {(liveBbVehicle?.class_name || sub.bb_class_name) && (
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{liveBbVehicle?.class_name || sub.bb_class_name}</span>
            )}
            {bbLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {/* Final Grade Callout */}
            <div className="ml-auto flex items-center gap-2">
              {sub.inspector_grade && (
                <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px]">
                  <Shield className="w-3 h-3 mr-1" /> Inspector: {formatGrade(sub.inspector_grade)}
                </Badge>
              )}
              {sub.overall_condition && (
                <Badge variant="outline" className="text-[10px] border-amber-400/50 text-amber-600">
                  Customer: {formatGrade(sub.overall_condition)}
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-xs">
            <div><span className="text-muted-foreground">Style:</span> <span className="font-medium text-card-foreground">{liveBbVehicle?.style || "—"}</span></div>
            <div><span className="text-muted-foreground">Drivetrain:</span> <span className="font-bold text-card-foreground">{liveBbVehicle?.drivetrain || sub.bb_drivetrain || "—"}</span></div>
            <div><span className="text-muted-foreground">Engine:</span> <span className="font-medium text-card-foreground">{liveBbVehicle?.engine || sub.bb_engine || "—"}</span></div>
            <div><span className="text-muted-foreground">Trans:</span> <span className="font-medium text-card-foreground">{liveBbVehicle?.transmission || sub.bb_transmission || "—"}</span></div>
            <div><span className="text-muted-foreground">MSRP:</span> <span className="font-bold text-card-foreground">${Number(liveBbVehicle?.msrp || sub.bb_msrp || 0).toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">Fuel:</span> <span className="font-bold text-card-foreground">{liveBbVehicle?.fuel_type || sub.bb_fuel_type || "—"}</span></div>
            <div><span className="text-muted-foreground">Color:</span> <span className="font-medium text-card-foreground">{sub.exterior_color || "—"}</span></div>
          </div>
        </div>

        {/* ══ CONDITION TIER BUBBLES ══ */}
        {bbVehicle && activeSettings && (
          <div className="bg-gradient-to-r from-primary/5 to-transparent rounded-lg border border-primary/20 p-3 mb-5">
            <div className="flex items-center gap-1.5 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">① Select Condition Tier</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {CONDITIONS.map(cond => {
                const basisMap = activeSettings.condition_basis_map || {};
                const selectedBasis = (basisMap as Record<string, string>)[cond] || "tradein_avg";
                const mult = activeSettings.condition_multipliers?.[cond] ?? 1.0;
                const isActive = cond === condition;
                const selectedValue = (() => {
                  const [cat, tier] = selectedBasis.split("_");
                  const tierKey = tier === "xclean" ? "xclean" : tier;
                  const data = bbVehicle[cat as "wholesale" | "tradein" | "retail"] as Record<string, number> | undefined;
                  return data?.[tierKey] || 0;
                })();
                const bubbleFormData = { ...formData, overallCondition: cond };
                const bubbleResult = calculateOffer(bbVehicle, bubbleFormData, liveSelectedAddDeducts, activeSettings, rules);

                return (
                  <button
                    key={cond}
                    onClick={() => setCondition(cond)}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md scale-[1.02]"
                        : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                    }`}
                  >
                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {CONDITION_LABELS[cond]}
                    </div>
                    <div className={`text-lg font-bold ${isActive ? "text-primary" : "text-card-foreground"}`}>
                      ${bubbleResult.high.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground mt-0.5">
                      Base: ${selectedValue.toLocaleString()} × {mult.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ TWO-COLUMN LAYOUT ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* ── LEFT: Config + Waterfall ── */}
          <div className="space-y-4">
            {/* Active Tier Configuration */}
            {activeSettings && bbVehicle && (() => {
              const cond = condition;
              const basisMap = activeSettings.condition_basis_map || {};
              const selectedBasis = (basisMap as Record<string, string>)[cond] || "tradein_avg";
              const condEquipMap = (activeSettings as any).condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true };
              const equipEnabled = condEquipMap[cond] ?? true;
              const mult = activeSettings.condition_multipliers?.[cond] ?? 1.0;

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
                          ...(activeSettings.condition_basis_map || {}),
                          [cond]: val,
                        } as any)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BB_VALUE_OPTIONS.map(opt => {
                            let dollarStr = "";
                            if (bbVehicle) {
                              const [cat, tier] = opt.value.split("_");
                              const tierKey = tier === "xclean" ? "xclean" : tier;
                              const data = bbVehicle[cat as "wholesale" | "tradein" | "retail"] as Record<string, number> | undefined;
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
                            const newMap = { ...(activeSettings as any).condition_equipment_map || { excellent: true, very_good: true, good: true, fair: true }, [cond]: checked };
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
                          ...activeSettings.condition_multipliers,
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

            {/* ② CUSTOMER CONDITION INPUTS — with inspector override indicators */}
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-3">
                <Car className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">② Vehicle Condition</span>
                {hasInspection && (
                  <Badge variant="secondary" className="text-[8px] ml-auto">Inspector Data Applied</Badge>
                )}
              </div>

              <div className="space-y-2">
                {/* Condition */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Condition</span>
                  <span className="text-xs font-bold text-primary">{CONDITION_LABELS[condition]}</span>
                  {sub.inspector_grade && sub.inspector_grade !== sub.overall_condition && (
                    <span className="text-[8px] text-muted-foreground">Customer: {formatGrade(sub.overall_condition)}</span>
                  )}
                  <SourceTag inspector={!!sub.inspector_grade} customer={sub.inspector_grade ? undefined : sub.overall_condition} />
                  <span className="text-[9px] text-muted-foreground ml-auto">Set above ①</span>
                </div>

                {/* Modifications */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Modifications</span>
                  <Select value={modifications} onValueChange={setModifications}>
                    <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Modifications</SelectItem>
                      <SelectItem value="yes">Has Modifications</SelectItem>
                    </SelectContent>
                  </Select>
                  <SourceTag customer={customerAnswers.modifications} />
                  <span className="text-[9px] text-muted-foreground ml-auto">Info only</span>
                </div>

                {/* Drivable */}
                {isOn("not_drivable") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Drivable?</span>
                    <Select value={drivable} onValueChange={setDrivable}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Drivable</SelectItem>
                        <SelectItem value="no">Not Drivable</SelectItem>
                      </SelectContent>
                    </Select>
                    <SourceTag customer={customerAnswers.drivable} />
                    <DeductBadge amount={drivDeduct} />
                  </div>
                )}

                {/* Exterior Damage */}
                {isOn("exterior_damage") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Exterior Damage</span>
                    <Select value={String(exteriorItems)} onValueChange={v => setExteriorItems(Number(v))}>
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
                    {exteriorItems > 0 && <span className="text-[9px] text-muted-foreground">{exteriorItems} × ${getAmt("exterior_damage_per_item").toLocaleString()}</span>}
                    <SourceTag customer={customerAnswers.exteriorDamage?.join(",")} />
                    <DeductBadge amount={extDeduct} />
                  </div>
                )}

                {/* Windshield */}
                {isOn("windshield_damage") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Windshield</span>
                    <Select value={windshield} onValueChange={setWindshield}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No damage</SelectItem>
                        <SelectItem value="minor_chips">Minor chips (-${getAmt("windshield_chipped").toLocaleString()})</SelectItem>
                        <SelectItem value="major_cracks">Major cracks (-${getAmt("windshield_cracked").toLocaleString()})</SelectItem>
                      </SelectContent>
                    </Select>
                    <SourceTag customer={customerAnswers.windshield} />
                    <DeductBadge amount={windDeduct} />
                  </div>
                )}

                {/* Moonroof */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Moonroof</span>
                  <Select value={moonroof} onValueChange={setMoonroof}>
                    <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Works great">Works great</SelectItem>
                      <SelectItem value="Doesn't work">Doesn't work (-${getAmt("moonroof_broken").toLocaleString()})</SelectItem>
                      <SelectItem value="No moonroof">No moonroof</SelectItem>
                    </SelectContent>
                  </Select>
                  <SourceTag customer={customerAnswers.moonroof} />
                  <DeductBadge amount={moonroofDeduct} />
                </div>

                {/* Interior Damage */}
                {isOn("interior_damage") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Interior Damage</span>
                    <Select value={String(interiorItems)} onValueChange={v => setInteriorItems(Number(v))}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        <SelectItem value="1">1 issue</SelectItem>
                        <SelectItem value="2">2 issues</SelectItem>
                        <SelectItem value="3">3 issues</SelectItem>
                        <SelectItem value="4">4 issues</SelectItem>
                      </SelectContent>
                    </Select>
                    {interiorItems > 0 && <span className="text-[9px] text-muted-foreground">{interiorItems} × ${getAmt("interior_damage_per_item").toLocaleString()}</span>}
                    <SourceTag customer={customerAnswers.interiorDamage?.join(",")} />
                    <DeductBadge amount={intDeduct} />
                  </div>
                )}

                {/* Tech Issues */}
                {isOn("tech_issues") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Tech Issues</span>
                    <Select value={String(techItems)} onValueChange={v => setTechItems(Number(v))}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        <SelectItem value="1">1 issue</SelectItem>
                        <SelectItem value="2">2 issues</SelectItem>
                        <SelectItem value="3">3 issues</SelectItem>
                        <SelectItem value="4">4 issues</SelectItem>
                      </SelectContent>
                    </Select>
                    {techItems > 0 && <span className="text-[9px] text-muted-foreground">{techItems} × ${getAmt("tech_issue_per_item").toLocaleString()}</span>}
                    <SourceTag customer={customerAnswers.techIssues?.join(",")} />
                    <DeductBadge amount={techDeduct} />
                  </div>
                )}

                {/* Engine Issues */}
                {isOn("engine_issues") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Engine Issues</span>
                    <Select value={String(engineItems)} onValueChange={v => setEngineItems(Number(v))}>
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
                    {engineItems > 0 && <span className="text-[9px] text-muted-foreground">{engineItems} × ${getAmt("engine_issue_per_item").toLocaleString()}</span>}
                    <SourceTag customer={customerAnswers.engineIssues?.join(",")} />
                    <DeductBadge amount={engDeduct} />
                  </div>
                )}

                {/* Mechanical Issues */}
                {isOn("mechanical_issues") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Mechanical Issues</span>
                    <Select value={String(mechItems)} onValueChange={v => setMechItems(Number(v))}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        <SelectItem value="1">1 issue</SelectItem>
                        <SelectItem value="2">2 issues</SelectItem>
                        <SelectItem value="3">3 issues</SelectItem>
                        <SelectItem value="4">4 issues</SelectItem>
                      </SelectContent>
                    </Select>
                    {mechItems > 0 && <span className="text-[9px] text-muted-foreground">{mechItems} × ${getAmt("mechanical_issue_per_item").toLocaleString()}</span>}
                    <SourceTag customer={customerAnswers.mechIssues?.join(",")} />
                    <DeductBadge amount={mechDeduct} />
                  </div>
                )}

                {/* Accidents */}
                {isOn("accidents") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Accidents</span>
                    <Select value={accidents} onValueChange={setAccidents}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No accidents</SelectItem>
                        <SelectItem value="1">1 accident (-${getAmt("accidents_1").toLocaleString()})</SelectItem>
                        <SelectItem value="2+">2+ accidents (-${getAmt("accidents_2").toLocaleString()})</SelectItem>
                      </SelectContent>
                    </Select>
                    <SourceTag customer={customerAnswers.accidents} />
                    <DeductBadge amount={accidentDeduct} />
                  </div>
                )}

                {/* Smoked In */}
                {isOn("smoked_in") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Smoked In?</span>
                    <Select value={smokedIn} onValueChange={setSmokedIn}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">Not Smoked In</SelectItem>
                        <SelectItem value="yes">Smoked In (-${getAmt("smoked_in").toLocaleString()})</SelectItem>
                      </SelectContent>
                    </Select>
                    <SourceTag customer={customerAnswers.smokedIn} />
                    <DeductBadge amount={smokeDeduct} />
                  </div>
                )}

                {/* Tires */}
                {isOn("tires_not_replaced") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Tires Replaced</span>
                    <Select value={tiresReplaced} onValueChange={setTiresReplaced}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 tires (no deduction)</SelectItem>
                        <SelectItem value="3">3 tires</SelectItem>
                        <SelectItem value="2">2 tires</SelectItem>
                        <SelectItem value="1">1 tire</SelectItem>
                        <SelectItem value="None">None (-${getAmt("tires_not_replaced").toLocaleString()})</SelectItem>
                      </SelectContent>
                    </Select>
                    <SourceTag customer={customerAnswers.tires} />
                    <DeductBadge amount={tiresDeduct} />
                  </div>
                )}

                {/* Keys */}
                {isOn("missing_keys") && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                    <span className="text-[10px] font-semibold text-muted-foreground w-32 shrink-0">Keys</span>
                    <Select value={numKeys} onValueChange={setNumKeys}>
                      <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2+">2+ keys (no deduction)</SelectItem>
                        <SelectItem value="1">1 key (-${getAmt("missing_keys_1").toLocaleString()})</SelectItem>
                      </SelectContent>
                    </Select>
                    <SourceTag customer={customerAnswers.keys} />
                    <DeductBadge amount={keyDeduct} />
                  </div>
                )}
              </div>
            </div>

            {/* ③ EQUIPMENT — Factory Options with Customer ✓ and VIN detected tags */}
            {bbVehicle && bbVehicle.add_deduct_list?.length > 0 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                    <div className="flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-[11px] text-card-foreground">③ Factory Equipment ({liveSelectedAddDeducts.length}/{bbVehicle.add_deduct_list.length})</span>
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
                    {bbVehicle.add_deduct_list.map((ad: BBAddDeduct) => {
                      const isSelected = liveSelectedAddDeducts.includes(ad.uoc);
                      const wasCustomerSelected = (sub.bb_selected_options || []).includes(ad.uoc);
                      const isAutoDetected = ad.auto !== "N";
                      const dollarStr = ad.avg !== 0 ? ` (${ad.avg > 0 ? "+" : ""}$${Math.abs(ad.avg)})` : "";
                      return (
                        <label key={ad.uoc} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[10px] ${isSelected ? "bg-primary/10 text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleAddDeduct(ad.uoc)} className="rounded border-border w-3 h-3" />
                          <span className="truncate">{ad.name}{dollarStr}</span>
                          {wasCustomerSelected && (
                            <span className="text-[8px] bg-primary/15 text-primary px-1 rounded shrink-0">Customer ✓</span>
                          )}
                          {isAutoDetected && !wasCustomerSelected && (
                            <span className="text-[8px] bg-muted text-muted-foreground px-1 rounded shrink-0">VIN detected</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {liveSelectedAddDeducts.length > 0 && (
                    <div className="mx-1 mb-1 px-2.5 py-1 text-[9px] text-muted-foreground border-t border-border">
                      <strong>{liveSelectedAddDeducts.length}</strong> option{liveSelectedAddDeducts.length !== 1 ? "s" : ""} selected → value impact: <strong className={equipmentTotal >= 0 ? "text-emerald-600" : "text-destructive"}>{equipmentTotal >= 0 ? "+" : ""}${equipmentTotal.toLocaleString()}</strong>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ② b — TIRE & BRAKE HEALTH AT-A-GLANCE */}
            {(sub.tire_lf != null || sub.brake_lf != null) && (() => {
              const tires = [
                { label: "LF", val: sub.tire_lf },
                { label: "RF", val: sub.tire_rf },
                { label: "LR", val: sub.tire_lr },
                { label: "RR", val: sub.tire_rr },
              ];
              const brakes = [
                { label: "LF", val: sub.brake_lf },
                { label: "RF", val: sub.brake_rf },
                { label: "LR", val: sub.brake_lr },
                { label: "RR", val: sub.brake_rr },
              ];
              const hasTiresLocal = tires.some(t => t.val != null);
              const hasBrakesLocal = brakes.some(b => b.val != null);
              if (!hasTiresLocal && !hasBrakesLocal) return null;

              const getStatus = (val: number | null) => {
                if (val == null) return { color: "text-muted-foreground", bg: "bg-muted", label: "—" };
                if (val <= 3) return { color: "text-red-600", bg: "bg-red-500/10 border-red-400/40", label: "Replace" };
                if (val <= 5) return { color: "text-amber-600", bg: "bg-amber-500/10 border-amber-400/40", label: "Fair" };
                return { color: "text-green-600", bg: "bg-green-500/10 border-green-400/40", label: "Good" };
              };

              const needsTires = hasTiresLocal && tires.some(t => t.val != null && t.val <= 3);
              const needsBrakes = hasBrakesLocal && brakes.some(b => b.val != null && b.val <= 3);

              return (
                <div className={`rounded-lg border-2 p-3 ${needsTires || needsBrakes ? "border-red-400/60 bg-red-500/5" : "border-border bg-card"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Gauge className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-card-foreground">Tire & Brake Health</span>
                    {(needsTires || needsBrakes) && (
                      <Badge variant="destructive" className="text-[9px] ml-auto animate-pulse">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {needsTires && needsBrakes ? "Tires & Brakes Need Replacement" : needsTires ? "Needs Tires" : "Needs Brakes"}
                      </Badge>
                    )}
                    {!needsTires && !needsBrakes && (
                      <Badge variant="secondary" className="text-[9px] ml-auto text-green-600 bg-green-500/10 border-green-400/40">
                        <CheckCircle className="w-3 h-3 mr-1" /> All Good
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {hasTiresLocal && (
                      <div>
                        <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1.5">Tire Tread (/32")</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {tires.map(t => {
                            const s = getStatus(t.val);
                            return (
                              <div key={t.label} className={`rounded-md border px-2 py-1.5 text-center ${s.bg}`}>
                                <p className="text-[9px] text-muted-foreground">{t.label}</p>
                                <p className={`text-base font-black ${s.color}`}>{t.val ?? "—"}</p>
                                <p className={`text-[8px] font-bold uppercase ${s.color}`}>{s.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {hasBrakesLocal && (
                      <div>
                        <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1.5">Brake Pads (/32")</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {brakes.map(b => {
                            const s = getStatus(b.val);
                            return (
                              <div key={b.label} className={`rounded-md border px-2 py-1.5 text-center ${s.bg}`}>
                                <p className="text-[9px] text-muted-foreground">{b.label}</p>
                                <p className={`text-base font-black ${s.color}`}>{b.val ?? "—"}</p>
                                <p className={`text-[8px] font-bold uppercase ${s.color}`}>{s.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {sub.tire_adjustment != null && sub.tire_adjustment !== 0 && (
                    <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Tire Value Adjustment</span>
                      <span className={`text-sm font-bold ${sub.tire_adjustment >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {sub.tire_adjustment >= 0 ? "+" : ""}${Math.abs(sub.tire_adjustment).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Depth Policy Compliance */}
                  {depthPolicies.length > 0 && (() => {
                    const vehicleYear = parseInt(sub.vehicle_year || "0");
                    const vehicleMileage = parseInt(sub.mileage || "0");
                    const vehicleMake = (sub.vehicle_make || "").trim();
                    const currentYear = new Date().getFullYear();
                    const vehicleAge = vehicleYear > 0 ? currentYear - vehicleYear : 999;
                    const minTire = tires.filter(t => t.val != null).map(t => t.val!);
                    const minBrake = brakes.filter(b => b.val != null).map(b => b.val!);
                    const lowestTire = minTire.length > 0 ? Math.min(...minTire) : null;
                    const lowestBrake = minBrake.length > 0 ? Math.min(...minBrake) : null;

                    const applicable = depthPolicies.filter(p => {
                      if (!p.all_brands && p.oem_brands.length > 0 && vehicleMake) {
                        if (!p.oem_brands.some(b => vehicleMake.toLowerCase().includes(b.toLowerCase()))) return false;
                      }
                      if (p.max_vehicle_age_years != null && vehicleAge > p.max_vehicle_age_years) return false;
                      if (p.max_mileage != null && vehicleMileage > p.max_mileage) return false;
                      return true;
                    });
                    if (applicable.length === 0) return null;

                    return (
                      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Certification Policy Check
                        </p>
                        {applicable.map(policy => {
                          const tireFail = lowestTire !== null && lowestTire < policy.min_tire_depth;
                          const brakeFail = lowestBrake !== null && lowestBrake < policy.min_brake_depth;
                          const pass = !tireFail && !brakeFail;
                          const typeLabel = policy.policy_type === "manufacturer_cpo" ? "MFR CPO" : policy.policy_type === "limited_cpo" ? "Limited CPO" : policy.policy_type === "internal_cert" ? "Internal Cert" : "Standard";
                          return (
                            <div key={policy.id} className={`rounded-md border px-2.5 py-1.5 flex items-center justify-between text-[10px] ${pass ? "bg-green-500/5 border-green-400/30" : "bg-red-500/5 border-red-400/30"}`}>
                              <div className="flex items-center gap-2">
                                {pass ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                                <span className="font-semibold text-card-foreground">{policy.name}</span>
                                <Badge variant="outline" className="text-[8px] h-4">{typeLabel}</Badge>
                              </div>
                              <div className="flex items-center gap-3 text-[9px]">
                                {tireFail && <span className="text-red-600 font-bold">Tires: {lowestTire}/32" &lt; {policy.min_tire_depth}/32"</span>}
                                {brakeFail && <span className="text-red-600 font-bold">Brakes: {lowestBrake}/32" &lt; {policy.min_brake_depth}/32"</span>}
                                {pass && <span className="text-green-600 font-bold">Meets Requirements</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* ④ PRICE WATERFALL */}
            {offerResult && (
              <div className="rounded-lg border-2 border-primary/20 p-3 bg-gradient-to-b from-muted/20 to-transparent">
                <div className="flex items-center gap-1.5 mb-3">
                  <ArrowDown className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">
                    ④ Price Waterfall — {CONDITION_LABELS[condition]}
                  </span>
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold ml-auto">
                    Click bars to adjust
                  </span>
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
            )}

            {/* BB Value Tiles */}
            {bbVehicle && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-[11px] text-card-foreground">Black Book Market Values</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-2">
                    {BB_CATEGORIES.map(cat => {
                      const data = bbVehicle[cat.dataKey] as Record<string, number> | undefined;
                      if (!data) return null;
                      return (
                        <div key={cat.label} className="mb-1.5">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">{cat.label}</span>
                          <div className="grid grid-cols-4 gap-1">
                            {cat.tiers.map(tier => {
                              const value = data[tier.tierKey] || 0;
                              const isSelected = bbValueBasis === tier.key;
                              if (value <= 0) return null;
                              return (
                                <button key={tier.key}
                                  onClick={() => { setBbValueBasis(tier.key); updateLocalSetting("bb_value_basis", tier.key); }}
                                  className={`rounded-md px-2 py-1.5 text-center transition-all border ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 shadow-sm"
                                      : "bg-muted/40 border-border hover:border-primary/40 hover:bg-primary/5 text-card-foreground"
                                  }`}>
                                  <div className="text-[9px] font-medium opacity-80">{tier.short}</div>
                                  <div className={`text-sm font-bold ${isSelected ? "" : "text-card-foreground"}`}>${value.toLocaleString()}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Final Appraised Value + Finalize */}
            <div className={`rounded-xl border-2 p-4 ${sub.appraisal_finalized ? "border-emerald-500/50 bg-emerald-500/5" : "border-primary/30 bg-primary/5"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">Final Appraised Value</span>
                </div>
                {sub.appraisal_finalized && (
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                    <Lock className="w-3 h-3 mr-1" /> Finalized
                  </Badge>
                )}
              </div>
              
              {sub.appraisal_finalized ? (
                <div>
                  <div className="text-2xl font-black text-primary mb-2">${finalValue.toLocaleString()}</div>
                  {sub.appraisal_finalized_by && (
                    <p className="text-[10px] text-muted-foreground">
                      Finalized by {sub.appraisal_finalized_by} on {sub.appraisal_finalized_at ? new Date(sub.appraisal_finalized_at).toLocaleDateString() : "—"}
                    </p>
                  )}
                  <Button onClick={handleUnlockAppraisal} disabled={saving} variant="outline" size="sm" className="mt-3">
                    <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock Appraisal
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">$</span>
                      <Input
                        type="text" inputMode="numeric"
                        value={acvOverride != null ? acvOverride.toLocaleString("en-US") : ""}
                        onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ""); setAcvOverride(raw ? Number(raw) : null); }}
                        placeholder="Enter final appraised value" className="h-10 text-lg font-bold pl-8"
                      />
                    </div>
                    <Button onClick={handleSave} disabled={saving} size="lg">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                      Save
                    </Button>
                  </div>
                  <Button onClick={handleFinalize} disabled={saving || (acvOverride == null && finalValue <= 0)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Lock className="w-4 h-4 mr-1.5" />}
                    Finalize Appraisal
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-2">Finalizing locks the appraisal and enables check request generation.</p>
                </>
              )}
              {!sub.appraisal_finalized && sub.appraised_by && <p className="text-[10px] text-muted-foreground mt-1">Last appraised by: {sub.appraised_by}</p>}
            </div>
          </div>

          {/* ── RIGHT: Final Offer, Profit, Inspection, Market ── */}
          <div className="space-y-4">
            {/* Final Offer Card */}
            {offerResult && (
              <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Final Appraised Value</div>
                <div className="text-3xl font-bold text-primary">
                  ${finalValue.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Customer was offered: ${currentOffer.toLocaleString()}
                </div>
                {offerResult.matchedRuleIds.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px]">{offerResult.matchedRuleIds.length} rule(s) applied</Badge>
                    {offerResult.isHotLead && <Badge variant="destructive" className="text-[10px]">🔥 Hot</Badge>}
                  </div>
                )}
              </div>
            )}

            {/* Profit Spread Gauge */}
            {bbVehicle && retailAvg > 0 && wholesaleAvg > 0 && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <ProfitSpreadGauge
                  offerHigh={finalValue}
                  wholesaleAvg={wholesaleAvg}
                  tradeinAvg={tradeinAvg}
                  retailAvg={retailAvg}
                  msrp={Number(bbVehicle.msrp || 0)}
                />
              </div>
            )}

            {/* TAC Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  Total Acquisition Cost
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Appraisal Value</span>
                  <span className="font-bold">${finalValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">+ Recon Cost</span>
                  <span className="font-bold text-destructive">${(activeSettings?.recon_cost || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">+ Dealer Pack</span>
                  <span className="font-bold text-destructive">${effectivePack.toLocaleString()}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-card-foreground">TAC</span>
                  <span className="font-bold text-card-foreground">${(finalValue + (activeSettings?.recon_cost || 0) + effectivePack).toLocaleString()}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-card-foreground">Projected Profit</span>
                  <span className={`font-bold ${projectedProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {projectedProfit >= 0 ? "+" : ""}${projectedProfit.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Margin %</span>
                  <span className={`font-bold ${profitMargin >= 0 ? "text-green-600" : "text-destructive"}`}>{profitMargin.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Market Context */}
            {bbVehicle && offerResult && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <MarketContextPanel bbVehicle={bbVehicle} offerHigh={finalValue} />
              </div>
            )}

            {/* Live Retail Market Data */}
            {sub.vin && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <RetailMarketPanel
                  vin={sub.vin}
                  uvc={bbVehicle?.uvc}
                  zipcode={sub.zip || undefined}
                  radiusMiles={(activeSettings as any)?.retail_search_radius || 100}
                  offerHigh={offerResult?.high || currentOffer}
                />
              </div>
            )}

            {/* Inspection At-a-Glance */}
            {hasInspection && (() => {
              const parsedSections: { name: string; items: { label: string; status: string }[] }[] = [];
              if (inspectionData) {
                const lines = inspectionData.split("\n").filter(Boolean);
                let currentSection: { name: string; items: { label: string; status: string }[] } | null = null;
                for (const line of lines) {
                  if (line.startsWith("【") || line.startsWith("[")) {
                    if (currentSection) parsedSections.push(currentSection);
                    currentSection = { name: line.replace(/[【】\[\]]/g, "").trim(), items: [] };
                  } else if (currentSection && (line.includes(":") || line.includes("→"))) {
                    const sep = line.includes("→") ? "→" : ":";
                    const [label, ...rest] = line.split(sep);
                    const status = rest.join(sep).trim();
                    if (label.trim()) currentSection.items.push({ label: label.trim().replace(/^[-•]\s*/, ""), status });
                  }
                }
                if (currentSection) parsedSections.push(currentSection);
              }

              const getStatusColor = (status: string) => {
                const s = status.toLowerCase();
                if (s.includes("fail") || s.includes("poor") || s.includes("replace") || s.includes("damage") || s.includes("issue")) return "bg-destructive/15 text-destructive border-destructive/30";
                if (s.includes("fair") || s.includes("warn") || s.includes("wear") || s.includes("minor")) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
                if (s.includes("pass") || s.includes("good") || s.includes("ok") || s.includes("excellent") || s.includes("normal") || s.includes("yes")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
                return "bg-muted text-muted-foreground border-border";
              };

              const failCount = parsedSections.reduce((acc, sec) => acc + sec.items.filter(i => getStatusColor(i.status).includes("destructive")).length, 0);
              const passCount = parsedSections.reduce((acc, sec) => acc + sec.items.filter(i => getStatusColor(i.status).includes("emerald")).length, 0);
              const totalChecks = parsedSections.reduce((acc, sec) => acc + sec.items.length, 0);

              return (
                <Card className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-primary" />
                      Inspection At-a-Glance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {totalChecks > 0 && (
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        {failCount > 0 && <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-destructive" /><span className="text-[10px] font-bold text-destructive">{failCount} Fail</span></div>}
                        {passCount > 0 && <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-emerald-600">{passCount} Pass</span></div>}
                        <span className="text-[9px] text-muted-foreground ml-auto">{totalChecks} checks</span>
                      </div>
                    )}
                    {parsedSections.map((sec, i) => (
                      <Collapsible key={i}>
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
                            <span className="text-[11px] font-semibold text-card-foreground">{sec.name}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="grid grid-cols-1 gap-0.5 pl-4 pr-1 pb-1">
                            {sec.items.map((item, j) => (
                              <div key={j} className="flex items-center justify-between py-0.5">
                                <span className="text-[10px] text-muted-foreground truncate mr-2">{item.label}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getStatusColor(item.status)}`}>{item.status}</span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}

                    {/* Detailed tire/brake widget */}
                    {(hasTires || hasBrakes) && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center justify-between w-full text-left text-[10px] text-muted-foreground hover:text-card-foreground px-1">
                            <span className="font-semibold">Detailed Tire & Brake Readings</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-1">
                            <BrakePadDepthWidget
                              showTires={hasTires}
                              showBrakes={hasBrakes}
                              tireDepths={{ leftFront: sub.tire_lf, rightFront: sub.tire_rf, leftRear: sub.tire_lr, rightRear: sub.tire_rr }}
                              brakeDepths={brakeDepths ? { leftFront: brakeDepths.lf, rightFront: brakeDepths.rf, leftRear: brakeDepths.lr, rightRear: brakeDepths.rr } : undefined}
                              readOnly compact
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* AI Damage */}
            {sub.ai_damage_summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-primary" />
                    AI Damage Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={sub.ai_condition_score === "poor" || sub.ai_condition_score === "fair" ? "destructive" : "secondary"}>
                    {sub.ai_condition_score || "N/A"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{sub.ai_damage_summary}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
