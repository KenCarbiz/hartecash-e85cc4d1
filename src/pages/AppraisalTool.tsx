import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  Calendar, Plus, Trash2,
} from "lucide-react";
import ProfitSpreadGauge from "@/components/admin/ProfitSpreadGauge";
import MarketContextPanel from "@/components/admin/MarketContextPanel";
import RetailMarketPanel from "@/components/admin/RetailMarketPanel";
import { calculateOffer, type OfferSettings, type OfferRule, type OfferEstimate } from "@/lib/offerCalculator";
import type { FormData, BBVehicle, BBAddDeduct } from "@/components/sell-form/types";

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
  ai_condition_score: string | null; ai_damage_summary: string | null;
  appraised_by: string | null; zip: string | null;
}

const CONDITIONS = ["excellent", "good", "fair", "rough"] as const;

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

// ── Brake Pad Depth Visual ──
const BrakePadDisplay = ({ label, depth }: { label: string; depth: number | null }) => {
  if (depth == null) return null;
  const color = depth >= 6 ? "text-green-600 bg-green-500/10"
    : depth >= 4 ? "text-amber-600 bg-amber-500/10"
    : "text-destructive bg-destructive/10";
  const statusLabel = depth >= 6 ? "Good" : depth >= 4 ? "Fair" : "Replace";
  return (
    <div className={`rounded-lg p-2 text-center ${color}`}>
      <div className="text-[10px] font-medium opacity-70">{label}</div>
      <div className="text-lg font-bold">{depth}<span className="text-[10px]">/32"</span></div>
      <div className="text-[9px] font-semibold">{statusLabel}</div>
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

  // Editable overrides (mirror Offer Builder controls)
  const [localSettings, setLocalSettings] = useState<OfferSettings | null>(null);
  const [acvOverride, setAcvOverride] = useState<number | null>(null);
  const [bbValueBasis, setBbValueBasis] = useState("tradein_avg");
  

  // Editable condition fields (pre-filled from customer, overridable by appraiser)
  const [condition, setCondition] = useState("good");
  const [accidents, setAccidents] = useState("0");
  const [drivable, setDrivable] = useState("yes");
  const [smokedIn, setSmokedIn] = useState("no");
  const [exteriorItems, setExteriorItems] = useState(0);
  const [mechItems, setMechItems] = useState(0);

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
      setCondition(s.overall_condition || "good");
      setAccidents(s.accidents || "0");
      setDrivable(s.drivable || "yes");
      setSmokedIn(s.smoked_in || "no");
      setExteriorItems((s.exterior_damage || []).filter(d => d !== "none").length);
      setMechItems((s.mechanical_issues || []).filter(d => d !== "none").length);

      const { data: settingsData } = await supabase.from("offer_settings").select("*").eq("dealership_id", "default").maybeSingle();
      if (settingsData) {
        setSettings(settingsData as any);
        setLocalSettings(settingsData as any);
        setDealerPack((settingsData as any).dealer_pack ?? 0);
        setBbValueBasis(settingsData.bb_value_basis || "tradein_avg");
      }

      const { data: rulesData } = await supabase.from("offer_rules").select("*").eq("dealership_id", "default").eq("is_active", true);
      if (rulesData) setRules(rulesData as any);

      // Do a live BB lookup to get full tier data
      if (s.vin) {
        setBbLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke("bb-lookup", {
            body: { lookup_type: "vin", vin: s.vin, mileage: parseInt(s.mileage || "0") || 50000 },
          });
          if (!error && data?.vehicles?.length > 0) {
            const vehicle = data.vehicles[0] as BBVehicle;
            setLiveBbVehicle(vehicle);
            const autoSelected = (vehicle.add_deduct_list || []).filter((ad: BBAddDeduct) => ad.auto !== "N").map((ad: BBAddDeduct) => ad.uoc);
            setLiveSelectedAddDeducts(autoSelected);
          }
        } catch (e) { console.error("BB lookup for appraisal:", e); }
        setBbLoading(false);
      }

      setLoading(false);
    };
    load();
  }, [token]);

  const activeSettings = localSettings;

  // Build form data from editable condition fields
  const formData: FormData = useMemo(() => ({
    plate: "", state: sub?.zip || "", vin: sub?.vin || "", mileage: sub?.mileage || "0",
    bbUvc: "", bbSelectedAddDeducts: liveSelectedAddDeducts,
    exteriorColor: sub?.exterior_color || "", drivetrain: sub?.drivetrain || "",
    modifications: sub?.modifications || "",
    overallCondition: condition,
    exteriorDamage: Array.from({ length: exteriorItems }, (_, i) => `item_${i}`),
    windshieldDamage: sub?.windshield_damage || "", moonroof: sub?.moonroof || "",
    interiorDamage: (sub?.interior_damage || []).filter(d => d !== "none"),
    techIssues: (sub?.tech_issues || []).filter(d => d !== "none"),
    engineIssues: (sub?.engine_issues || []).filter(d => d !== "none"),
    mechanicalIssues: Array.from({ length: mechItems }, (_, i) => `item_${i}`),
    drivable, accidents, smokedIn,
    tiresReplaced: sub?.tires_replaced || "yes", numKeys: sub?.num_keys || "2",
    name: sub?.name || "", phone: sub?.phone || "", email: sub?.email || "", zip: sub?.zip || "",
    loanStatus: "", loanCompany: "", loanBalance: "", loanPayment: "",
    nextStep: "", preferredLocationId: "", salespersonName: "",
  }), [sub, condition, accidents, drivable, smokedIn, exteriorItems, mechItems, liveSelectedAddDeducts]);

  // Use live BB vehicle if available, else reconstruct from stored data
  const bbVehicle: BBVehicle | null = useMemo(() => {
    if (liveBbVehicle) return liveBbVehicle;
    if (!sub || !sub.bb_tradein_avg) return null;
    return {
      year: sub.vehicle_year || "", make: sub.vehicle_make || "", model: sub.vehicle_model || "",
      series: "", style: "", uvc: "", vin: sub.vin || "", price_includes: "",
      exterior_colors: [], class_name: sub.bb_class_name || "",
      drivetrain: sub.bb_drivetrain || "", engine: sub.bb_engine || "",
      transmission: sub.bb_transmission || "", fuel_type: sub.bb_fuel_type || "",
      msrp: Number(sub.bb_msrp || 0),
      wholesale: { avg: sub.bb_wholesale_avg || 0, clean: 0, rough: 0, xclean: 0 },
      tradein: { avg: sub.bb_tradein_avg || 0, clean: 0, rough: 0 },
      retail: { avg: sub.bb_retail_avg || 0, clean: 0, rough: 0, xclean: 0 },
      mileage_adj: sub.bb_mileage_adj || 0, regional_adj: sub.bb_regional_adj || 0,
      base_whole_avg: sub.bb_base_whole_avg || 0,
      add_deduct_list: Array.isArray(sub.bb_add_deducts) ? sub.bb_add_deducts : [],
    };
  }, [liveBbVehicle, sub]);

  const equipmentTotal = useMemo(() => {
    if (!bbVehicle) return 0;
    return (bbVehicle.add_deduct_list || [])
      .filter((ad: BBAddDeduct) => liveSelectedAddDeducts.includes(ad.uoc))
      .reduce((sum: number, ad: BBAddDeduct) => sum + (ad.avg || 0), 0);
  }, [bbVehicle, liveSelectedAddDeducts]);

  const offerResult = useMemo(() => {
    if (!bbVehicle || !activeSettings) return null;
    return calculateOffer(bbVehicle, formData, liveSelectedAddDeducts, activeSettings, rules);
  }, [bbVehicle, formData, liveSelectedAddDeducts, activeSettings, rules]);

  // Effective values
  const currentOffer = sub?.offered_price || sub?.estimated_offer_high || 0;
  const effectivePack = dealerPack;
  const retailAvg = Number(bbVehicle?.retail?.avg || sub?.bb_retail_avg || 0);
  const wholesaleAvg = Number(bbVehicle?.wholesale?.avg || sub?.bb_wholesale_avg || 0);
  const tradeinAvg = Number(bbVehicle?.tradein?.avg || sub?.bb_tradein_avg || 0);

  // Build waterfall blocks (matching Offer Builder)
  const waterfallBlocks: WaterfallBlock[] = useMemo(() => {
    if (!offerResult || !activeSettings || !bbVehicle) return [];
    const blocks: WaterfallBlock[] = [];
    let running = offerResult.baseValue;
    const condMult = activeSettings.condition_multipliers?.[condition as keyof typeof activeSettings.condition_multipliers] ?? 1;
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - Number(bbVehicle.year);
    const mileageNum = parseInt((sub?.mileage || "0").replace(/[^0-9]/g, "")) || 0;
    const matchedAge = (activeSettings.age_tiers || []).find((t: any) => vehicleAge >= t.min_years && vehicleAge <= t.max_years);
    const matchedMileage = (activeSettings.mileage_tiers || []).find((t: any) => mileageNum >= t.min_miles && mileageNum <= t.max_miles);

    // Base
    blocks.push({ id: "base", label: "Base Value", value: running, runningTotal: running, type: "base", editable: true, editKey: "bb_value_basis", editType: "flat" });

    // Condition
    const condAdj = Math.round(offerResult.baseValue * condMult) - offerResult.baseValue;
    running += condAdj;
    blocks.push({ id: "condition", label: `Condition (${condition})`, value: condAdj, runningTotal: running, type: condAdj >= 0 ? "add" : "subtract", editable: true, editKey: "condition_multiplier", editType: "multiplier", currentEditValue: condMult });

    // Equipment
    if (equipmentTotal !== 0) {
      running += equipmentTotal;
      blocks.push({ id: "equipment", label: "Equipment", value: equipmentTotal, runningTotal: running, type: equipmentTotal >= 0 ? "add" : "subtract", editable: false });
    }

    // Deductions
    if (offerResult.totalDeductions > 0) {
      running -= offerResult.totalDeductions;
      blocks.push({ id: "deductions", label: "Deductions", value: -offerResult.totalDeductions, runningTotal: running, type: "subtract", editable: false });
    }

    // Recon
    if (activeSettings.recon_cost > 0) {
      running -= activeSettings.recon_cost;
      blocks.push({ id: "recon", label: "Recon Cost", value: -activeSettings.recon_cost, runningTotal: running, type: "subtract", editable: true, editKey: "recon_cost", editType: "flat", currentEditValue: activeSettings.recon_cost });
    }

    // Dealer Pack
    if (effectivePack > 0) {
      running -= effectivePack;
      blocks.push({ id: "dealer_pack", label: "Dealer Pack", value: -effectivePack, runningTotal: running, type: "subtract", editable: false, editKey: "dealer_pack", editType: "flat", currentEditValue: effectivePack });
    }

    // Global %
    if (activeSettings.global_adjustment_pct !== 0) {
      const adj = Math.round(running * (activeSettings.global_adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "global", label: `Global (${activeSettings.global_adjustment_pct > 0 ? "+" : ""}${activeSettings.global_adjustment_pct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: true, editKey: "global_adjustment_pct", editType: "pct", currentEditValue: activeSettings.global_adjustment_pct });
    }

    // Regional
    if (activeSettings.regional_adjustment_pct !== 0) {
      const adj = Math.round(running * (activeSettings.regional_adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "regional", label: `Regional (${activeSettings.regional_adjustment_pct > 0 ? "+" : ""}${activeSettings.regional_adjustment_pct}%)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: true, editKey: "regional_adjustment_pct", editType: "pct", currentEditValue: activeSettings.regional_adjustment_pct });
    }

    // Age
    if (matchedAge) {
      const adj = Math.round(running * (matchedAge.adjustment_pct / 100));
      running += adj;
      blocks.push({ id: "age", label: `Age (${vehicleAge}yr)`, value: adj, runningTotal: running, type: adj >= 0 ? "add" : "subtract", editable: false });
    }

    // Mileage
    if (matchedMileage) {
      running += matchedMileage.adjustment_flat;
      blocks.push({ id: "mileage", label: `Mileage (${mileageNum.toLocaleString()}mi)`, value: matchedMileage.adjustment_flat, runningTotal: running, type: matchedMileage.adjustment_flat >= 0 ? "add" : "subtract", editable: false });
    }

    // Tire adjustment
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
  }, [offerResult, activeSettings, bbVehicle, condition, sub, effectivePack, equipmentTotal]);

  const maxVal = Math.max(...waterfallBlocks.map(s => Math.max(Math.abs(s.runningTotal), Math.abs(s.value), s.type === "base" ? s.value : 0)), 1);

  const finalValue = waterfallBlocks.find(b => b.id === "final")?.runningTotal ?? 0;
  const projectedProfit = retailAvg > 0 ? retailAvg - finalValue - effectivePack : 0;
  const profitMargin = retailAvg > 0 ? (projectedProfit / retailAvg) * 100 : 0;

  const handleBlockValueChange = useCallback((editKey: string, value: number, editType: string) => {
    if (editKey === "condition_multiplier") {
      updateLocalSetting("condition_multipliers", { excellent: 1, good: 1, fair: 1, rough: 1, ...(activeSettings?.condition_multipliers || {}), [condition]: value });
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

  // Save ACV
  const handleSave = async () => {
    if (!sub) return;
    setSaving(true);
    const { error } = await supabase.from("submissions").update({ acv_value: finalValue }).eq("id", sub.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSub(prev => prev ? { ...prev, acv_value: finalValue } : prev);
      setAcvOverride(finalValue);
      toast({ title: "ACV Saved", description: `Appraised value set to $${finalValue.toLocaleString()}` });
    }
    setSaving(false);
  };

  // Parse inspection data — return the full internal_notes if it contains an inspection header
  const inspectionData = useMemo(() => {
    if (!sub?.internal_notes) return null;
    if (!sub.internal_notes.includes("[INSPECTION")) return null;
    return sub.internal_notes;
  }, [sub]);

  // Parse brake pad depths from inspection notes
  const brakeDepths = useMemo(() => {
    if (!inspectionData) return null;
    const match = inspectionData.match(/Brakes\s*\((?:mm|\/32)\):\s*LF:(\d+|—)\s*RF:(\d+|—)\s*LR:(\d+|—)\s*RR:(\d+|—)/);
    if (!match) return null;
    const parse = (v: string) => v === "—" ? null : parseInt(v, 10);
    return { lf: parse(match[1]), rf: parse(match[2]), lr: parse(match[3]), rr: parse(match[4]) };
  }, [inspectionData]);

  const hasBrakes = !!(brakeDepths && (brakeDepths.lf != null || brakeDepths.rf != null || brakeDepths.lr != null || brakeDepths.rr != null));
  const avgBrakeDepth = hasBrakes
    ? ([brakeDepths!.lf, brakeDepths!.rf, brakeDepths!.lr, brakeDepths!.rr].filter(v => v != null) as number[])
        .reduce((a, b) => a + b, 0) / [brakeDepths!.lf, brakeDepths!.rf, brakeDepths!.lr, brakeDepths!.rr].filter(v => v != null).length
    : null;

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
        {/* ═══ HUD — Key Metrics Strip ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
          {[
            { label: "Customer Offer", value: `$${Math.floor(currentOffer).toLocaleString()}`, color: "text-card-foreground", bg: "bg-muted/50 border-border" },
            { label: "New Offer", value: `$${Math.floor(finalValue).toLocaleString()}`, color: "text-primary", bg: "bg-primary/10 border-primary/30" },
            { label: "Avg Market Value", value: retailAvg > 0 ? `$${Math.floor(retailAvg).toLocaleString()}` : "—", color: "text-card-foreground", bg: "bg-muted/50 border-border" },
            { label: "Recon Cost", value: `$${Math.floor(activeSettings?.recon_cost || 0).toLocaleString()}`, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
            { label: "Dealer Pack", value: `$${Math.floor(effectivePack).toLocaleString()}`, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
            { label: "Projected Profit", value: `${projectedProfit >= 0 ? "+" : ""}$${Math.floor(Math.abs(projectedProfit)).toLocaleString()}`, color: projectedProfit >= 0 ? "text-emerald-600" : "text-destructive", bg: projectedProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30" },
            { label: "Margin %", value: `${profitMargin.toFixed(1)}%`, color: profitMargin >= 0 ? "text-emerald-600" : "text-destructive", bg: profitMargin >= 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30" },
          ].map(metric => (
            <div key={metric.label} className={`rounded-xl border p-3 text-center ${metric.bg}`}>
              <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{metric.label}</div>
              <div className={`text-lg font-bold ${metric.color}`}>{metric.value}</div>
            </div>
          ))}
        </div>

        {/* Vehicle Summary Bar */}
        <div className="bg-muted/40 rounded-xl border border-border p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-card-foreground">
              {sub.vehicle_year} {(sub.vehicle_make || "").toUpperCase()} {(sub.vehicle_model || "").toUpperCase()} {liveBbVehicle?.series || ""}
            </span>
            {(liveBbVehicle?.class_name || sub.bb_class_name) && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{liveBbVehicle?.class_name || sub.bb_class_name}</span>
            )}
            {bbLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-xs">
            <div><span className="text-muted-foreground">Style:</span> <span className="font-medium text-card-foreground">{liveBbVehicle?.style || "—"}</span></div>
            <div><span className="text-muted-foreground">Drivetrain:</span> <span className="font-medium text-card-foreground font-bold">{liveBbVehicle?.drivetrain || sub.bb_drivetrain || "—"}</span></div>
            <div><span className="text-muted-foreground">Engine:</span> <span className="font-medium text-card-foreground">{liveBbVehicle?.engine || sub.bb_engine || "—"}</span></div>
            <div><span className="text-muted-foreground">Trans:</span> <span className="font-medium text-card-foreground">{liveBbVehicle?.transmission || sub.bb_transmission || "—"}</span></div>
            <div><span className="text-muted-foreground">MSRP:</span> <span className="font-medium text-card-foreground font-bold">${Number(liveBbVehicle?.msrp || sub.bb_msrp || 0).toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium text-card-foreground font-bold">{liveBbVehicle?.fuel_type || sub.bb_fuel_type || "—"}</span></div>
            <div><span className="text-muted-foreground">Color:</span> <span className="font-medium text-card-foreground">{sub.exterior_color || "—"}</span></div>
          </div>
        </div>

        {/* ═══ TWO-COLUMN LAYOUT ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* ── LEFT: BB Tiles, Condition, Waterfall, Fine-Tune ── */}
          <div className="space-y-4">
            {/* ① SELECT STARTING VALUE — BB Value Tiles */}
            {bbVehicle && (
              <div className="bg-gradient-to-r from-primary/5 to-transparent rounded-lg border border-primary/20 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">① Select Starting Value</span>
                </div>
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
            )}

            {/* ② VEHICLE CONDITION — Editable dropdowns pre-filled from customer */}
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Car className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">② Vehicle Condition</span>
                {hasInspection && (
                  <Badge variant="secondary" className="text-[8px] ml-auto">Inspection Data Applied</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <div>
                  <Label className="text-[10px] font-semibold">Condition</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-semibold">Accidents</Label>
                  <Select value={accidents} onValueChange={setAccidents}>
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
                  <Select value={drivable} onValueChange={setDrivable}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-semibold">Smoked?</Label>
                  <Select value={smokedIn} onValueChange={setSmokedIn}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-semibold">Ext. Damage</Label>
                  <Input type="number" min={0} max={10} value={exteriorItems} onChange={e => setExteriorItems(Number(e.target.value))} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] font-semibold">Mech. Issues</Label>
                  <Input type="number" min={0} max={10} value={mechItems} onChange={e => setMechItems(Number(e.target.value))} className="h-7 text-xs" />
                </div>
              </div>
            </div>

            {/* Equipment Add/Deducts */}
            {bbVehicle && bbVehicle.add_deduct_list?.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-[11px] text-card-foreground">Equipment ({liveSelectedAddDeducts.length}/{bbVehicle.add_deduct_list.length})</span>
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
                    {bbVehicle.add_deduct_list.map((ad: BBAddDeduct) => {
                      const isSelected = liveSelectedAddDeducts.includes(ad.uoc);
                      const dollarStr = ad.avg !== 0 ? ` (${ad.avg > 0 ? "+" : ""}$${Math.abs(ad.avg)})` : "";
                      return (
                        <label key={ad.uoc} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[10px] ${isSelected ? "bg-primary/10 text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleAddDeduct(ad.uoc)} className="rounded border-border w-3 h-3" />
                          <span className="truncate">{ad.name}{dollarStr}</span>
                          {ad.auto !== "N" && <span className="text-[8px] bg-emerald-500/10 text-emerald-600 px-1 rounded shrink-0">auto</span>}
                        </label>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ③ PRICE WATERFALL */}
            {offerResult && (
              <div className="rounded-lg border border-border p-3 bg-gradient-to-b from-muted/20 to-transparent">
                <div className="flex items-center gap-1.5 mb-3">
                  <ArrowDown className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">③ Price Waterfall — Click any bar to adjust</span>
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

            {/* Condition Multipliers Detail */}
            {offerResult && activeSettings && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-[11px] text-card-foreground">Condition Multipliers</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2">
                    {(["excellent", "good", "fair", "rough"] as const).map(grade => {
                      const mult = activeSettings.condition_multipliers[grade];
                      const isActive = grade === condition;
                      return (
                        <div key={grade} className={`space-y-1 rounded-md p-1.5 ${isActive ? "bg-primary/10 ring-1 ring-primary/20" : ""}`}>
                          <div className="flex items-center justify-between">
                            <Label className="capitalize text-[10px] font-semibold">{grade}</Label>
                            {isActive && <span className="text-[7px] bg-primary text-primary-foreground px-1 rounded">ACTIVE</span>}
                          </div>
                          <Input type="number" step="0.01" min="0" max="2" value={mult}
                            onChange={e => updateLocalSetting("condition_multipliers", { ...activeSettings.condition_multipliers, [grade]: Number(e.target.value) })}
                            className="w-full h-6 text-[10px]" />
                          <Slider value={[mult * 100]} min={50} max={130} step={1}
                            onValueChange={([v]) => updateLocalSetting("condition_multipliers", { ...activeSettings.condition_multipliers, [grade]: Math.round(v) / 100 })} />
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Age Tiers */}
            {offerResult && activeSettings && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-[11px] text-card-foreground">Age Tiers ({(activeSettings.age_tiers || []).length})</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 p-2">
                    {(activeSettings.age_tiers || []).map((tier: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1 text-[10px]">
                        <Input type="number" value={tier.min_years} onChange={e => { const u = [...(activeSettings.age_tiers || [])]; u[idx] = { ...u[idx], min_years: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-12 h-5 text-[10px]" />
                        <span>–</span>
                        <Input type="number" value={tier.max_years} onChange={e => { const u = [...(activeSettings.age_tiers || [])]; u[idx] = { ...u[idx], max_years: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-12 h-5 text-[10px]" />
                        <span>yr →</span>
                        <Input type="number" value={tier.adjustment_pct} onChange={e => { const u = [...(activeSettings.age_tiers || [])]; u[idx] = { ...u[idx], adjustment_pct: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-14 h-5 text-[10px]" step="0.5" />
                        <span>%</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Mileage Tiers */}
            {offerResult && activeSettings && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-[11px] text-card-foreground">Mileage Tiers ({(activeSettings.mileage_tiers || []).length})</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 p-2">
                    {(activeSettings.mileage_tiers || []).map((tier: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1 text-[10px]">
                        <Input type="number" value={tier.min_miles} onChange={e => { const u = [...(activeSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], min_miles: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="5000" />
                        <span>–</span>
                        <Input type="number" value={tier.max_miles} onChange={e => { const u = [...(activeSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], max_miles: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="5000" />
                        <span>mi →$</span>
                        <Input type="number" value={tier.adjustment_flat} onChange={e => { const u = [...(activeSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], adjustment_flat: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="100" />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Deduction Amounts */}
            {offerResult && activeSettings && (
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
                  <div className="p-2 text-[10px] text-muted-foreground">
                    Total deductions: <span className="font-bold text-destructive">−${(offerResult.totalDeductions || 0).toLocaleString()}</span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Manual ACV Override */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">Manual ACV Override</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">$</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={acvOverride != null ? acvOverride.toLocaleString("en-US") : ""}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setAcvOverride(raw ? Number(raw) : null);
                    }}
                    placeholder="Enter final ACV"
                    className="h-10 text-lg font-bold pl-8"
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
              {sub.appraised_by && <p className="text-[10px] text-muted-foreground mt-1">Last appraised by: {sub.appraised_by}</p>}
            </div>
          </div>

          {/* ── RIGHT: Final Offer, Profit, Inspection, Market ── */}
          <div className="space-y-4">
            {/* Final Offer Card */}
            {offerResult && (
              <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Final Offer Range</div>
                <div className="text-3xl font-bold text-primary">
                  ${offerResult.low.toLocaleString()} – ${offerResult.high.toLocaleString()}
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
                  retailClean={Number(bbVehicle.retail?.clean || 0)}
                  msrp={Number(bbVehicle.msrp || 0)}
                />
              </div>
            )}

            {/* Market Context */}
            {bbVehicle && offerResult && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <MarketContextPanel bbVehicle={bbVehicle} offerHigh={offerResult.high} />
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

            {/* Inspection Results */}
            {hasInspection && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-primary" />
                    Inspection Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                  {hasBrakes && brakeDepths && (
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Brake Pad Depth</div>
                      <div className="grid grid-cols-4 gap-2">
                        <BrakePadDisplay label="LF" depth={brakeDepths.lf} />
                        <BrakePadDisplay label="RF" depth={brakeDepths.rf} />
                        <BrakePadDisplay label="LR" depth={brakeDepths.lr} />
                        <BrakePadDisplay label="RR" depth={brakeDepths.rr} />
                      </div>
                      {avgBrakeDepth != null && (
                        <div className="mt-1.5 px-1">
                          <span className="text-[10px] text-muted-foreground">Avg: {avgBrakeDepth.toFixed(1)}/32"</span>
                        </div>
                      )}
                    </div>
                  )}
                  {inspectionData && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center justify-between w-full text-left text-xs text-muted-foreground hover:text-card-foreground">
                          <span className="font-semibold">Inspection Notes</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 mt-1 max-h-40 overflow-y-auto">{inspectionData}</pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            )}

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

            {/* Cost Summary */}
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
                  <span className="font-bold text-destructive">−${(activeSettings?.recon_cost || 0).toLocaleString()}</span>
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
                  <span className="font-semibold text-card-foreground">Projected Profit</span>
                  <span className={`font-bold ${projectedProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {projectedProfit >= 0 ? "+" : ""}${projectedProfit.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Margin %</span>
                  <span className={`font-bold ${profitMargin >= 0 ? "text-green-600" : "text-destructive"}`}>{profitMargin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">vs Retail Avg</span>
                  <span className="font-bold text-primary">${retailAvg > 0 ? `↕ ${(retailAvg - finalValue).toLocaleString()}` : "—"}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Customer Offer</span>
                  <span className="font-bold">${currentOffer.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
