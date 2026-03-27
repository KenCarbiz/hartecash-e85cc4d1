import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Calculator, TrendingDown, TrendingUp, Minus, ArrowRight, Search, Loader2, Car, CheckSquare,
  SlidersHorizontal, Gauge, Zap, AlertTriangle, DollarSign, ChevronDown, Calendar, Plus, Trash2,
} from "lucide-react";
import { calculateOffer, type OfferSettings, type OfferRule, type OfferEstimate } from "@/lib/offerCalculator";
import type { FormData, BBVehicle, BBAddDeduct } from "@/components/sell-form/types";
import { supabase } from "@/integrations/supabase/client";
import OfferWaterfall from "./OfferWaterfall";
import ProfitSpreadGauge from "./ProfitSpreadGauge";
import MarketContextPanel from "./MarketContextPanel";
import { useToast } from "@/hooks/use-toast";

interface Props {
  settings: OfferSettings;
  savedSettings: OfferSettings | null;
  rules: OfferRule[];
  /** When true, show inline controls to tweak settings in real-time */
  inlineControls?: boolean;
  /** Called when inline controls change a setting */
  onSettingsChange?: (settings: OfferSettings) => void;
}

const CONDITIONS = ["excellent", "good", "fair", "rough"] as const;

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

function buildTestData(baseValue: number, year: string, make: string, model: string, mileage: string, condition: string, accidents: string, exteriorItems: number, mechanicalItems: number, drivable: string, smokedIn: string) {
  const bbVehicle: BBVehicle = {
    uvc: "SIM", vin: "", year, make, model,
    series: "", style: "", class_name: "", msrp: 0, price_includes: "",
    drivetrain: "", transmission: "", engine: "", fuel_type: "",
    mileage_adj: 0, regional_adj: 0, base_whole_avg: baseValue,
    add_deduct_list: [],
    wholesale: { xclean: baseValue, clean: baseValue, avg: baseValue, rough: baseValue },
    tradein: { clean: baseValue, avg: baseValue, rough: baseValue },
    retail: { xclean: baseValue, clean: baseValue, avg: baseValue, rough: baseValue },
  };
  const formData: FormData = {
    plate: "", state: "", vin: "", mileage,
    bbUvc: "", bbSelectedAddDeducts: [],
    exteriorColor: "", drivetrain: "", modifications: "",
    overallCondition: condition,
    exteriorDamage: Array.from({ length: exteriorItems }, (_, i) => `item_${i}`),
    windshieldDamage: "", moonroof: "",
    interiorDamage: [], techIssues: [], engineIssues: [],
    mechanicalIssues: Array.from({ length: mechanicalItems }, (_, i) => `item_${i}`),
    drivable, accidents, smokedIn, tiresReplaced: "yes", numKeys: "2",
    name: "", phone: "", email: "", zip: "",
    loanStatus: "", loanCompany: "", loanBalance: "", loanPayment: "",
    nextStep: "", preferredLocationId: "", salespersonName: "",
  };
  return { bbVehicle, formData };
}

// ── Compact collapsible section ──
const InlineSection = ({ icon, title, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="font-semibold text-[11px] text-card-foreground">{title}</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-1 py-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const OfferSimulator = ({ settings, savedSettings, rules, inlineControls = true, onSettingsChange }: Props) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("live");

  // Local settings copy for inline adjustments
  const [localSettings, setLocalSettings] = useState<OfferSettings>(settings);

  // Sync when parent settings change
  const activeSettings = inlineControls ? localSettings : settings;

  const updateLocalSetting = <K extends keyof OfferSettings>(key: K, value: OfferSettings[K]) => {
    const next = { ...localSettings, [key]: value };
    setLocalSettings(next);
    onSettingsChange?.(next);
  };

  // Manual mode state
  const [baseValue, setBaseValue] = useState(18000);
  const [year, setYear] = useState("2018");
  const [mileage, setMileage] = useState("85000");
  const [condition, setCondition] = useState<string>("good");
  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("Camry");
  const [accidents, setAccidents] = useState("0");
  const [exteriorItems, setExteriorItems] = useState(0);
  const [mechanicalItems, setMechanicalItems] = useState(0);
  const [drivable, setDrivable] = useState("yes");
  const [smokedIn, setSmokedIn] = useState("no");
  const [compareMode, setCompareMode] = useState(false);

  // Live VIN mode state
  const [liveVin, setLiveVin] = useState("");
  const [liveMileage, setLiveMileage] = useState("50000");
  const [liveCondition, setLiveCondition] = useState<string>("good");
  const [liveAccidents, setLiveAccidents] = useState("0");
  const [liveDrivable, setLiveDrivable] = useState("yes");
  const [liveSmokedIn, setLiveSmokedIn] = useState("no");
  const [liveExteriorItems, setLiveExteriorItems] = useState(0);
  const [liveMechanicalItems, setLiveMechanicalItems] = useState(0);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveBbVehicle, setLiveBbVehicle] = useState<BBVehicle | null>(null);
  const [liveSelectedAddDeducts, setLiveSelectedAddDeducts] = useState<string[]>([]);

  // Manual mode calculations
  const { bbVehicle, formData } = useMemo(
    () => buildTestData(baseValue, year, make, model, mileage, condition, accidents, exteriorItems, mechanicalItems, drivable, smokedIn),
    [baseValue, year, make, model, mileage, condition, accidents, exteriorItems, mechanicalItems, drivable, smokedIn]
  );

  const result = useMemo(
    () => calculateOffer(bbVehicle, formData, [], activeSettings, rules),
    [bbVehicle, formData, activeSettings, rules]
  );

  const savedResult = useMemo(
    () => savedSettings ? calculateOffer(bbVehicle, formData, [], savedSettings, rules) : null,
    [bbVehicle, formData, savedSettings, rules]
  );

  // Live mode calculations
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

  // What-If: calculate with saved settings for comparison
  const liveSavedResult = useMemo(
    () => (liveBbVehicle && savedSettings && compareMode) ? calculateOffer(liveBbVehicle, liveFormData, liveSelectedAddDeducts, savedSettings, rules) : null,
    [liveBbVehicle, liveFormData, liveSelectedAddDeducts, savedSettings, rules, compareMode]
  );

  const whatIfDelta = (liveResult && liveSavedResult) ? liveResult.high - liveSavedResult.high : 0;

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
      if (data?.error) {
        toast({ title: "Lookup Error", description: data.error, variant: "destructive" });
        return;
      }
      const vehicles = data?.vehicles || [];
      if (vehicles.length === 0) {
        toast({ title: "No Results", description: "No vehicles found for that VIN.", variant: "destructive" });
        return;
      }
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

  // Determine which result/bbVehicle to show in the unified panel
  const activeResult = tab === "live" ? liveResult : result;
  const activeBbVehicle = tab === "live" ? liveBbVehicle : bbVehicle;
  const activeCondition = tab === "live" ? liveCondition : condition;
  const activeMileage = tab === "live" ? liveMileage : mileage;
  const activeYear = tab === "live" ? (liveBbVehicle?.year || "") : year;

  return (
    <div className="bg-card rounded-xl p-5 shadow-lg border border-border border-l-4 border-l-primary/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Pricing Workbench</h3>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="live" className="gap-1.5"><Search className="w-3.5 h-3.5" />Live VIN Lookup</TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5"><Calculator className="w-3.5 h-3.5" />Manual</TabsTrigger>
        </TabsList>

        {/* ── Live VIN Tab ── */}
        <TabsContent value="live">
          {/* VIN + Mileage inputs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <Label className="text-xs font-semibold">VIN</Label>
              <Input value={liveVin} onChange={e => setLiveVin(e.target.value.toUpperCase())} placeholder="Enter 17-character VIN" maxLength={17} className="h-9 font-mono tracking-wider" />
            </div>
            <div className="w-32">
              <Label className="text-xs font-semibold">Mileage</Label>
              <Input type="number" value={liveMileage} onChange={e => setLiveMileage(e.target.value)} step="5000" className="h-9" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleVinLookup} disabled={liveLoading || liveVin.trim().length !== 17} className="h-9 gap-1.5">
                {liveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {liveLoading ? "Looking up…" : "Look Up"}
              </Button>
            </div>
          </div>

          {liveBbVehicle && (
            <>
              {/* Vehicle summary */}
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
                  <div><span className="text-muted-foreground">Style:</span> <span className="font-medium">{liveBbVehicle.style || "—"}</span></div>
                  <div><span className="text-muted-foreground">Drivetrain:</span> <span className="font-medium">{liveBbVehicle.drivetrain || "—"}</span></div>
                  <div><span className="text-muted-foreground">Engine:</span> <span className="font-medium">{liveBbVehicle.engine || "—"}</span></div>
                  <div><span className="text-muted-foreground">Trans:</span> <span className="font-medium">{liveBbVehicle.transmission || "—"}</span></div>
                  <div><span className="text-muted-foreground">MSRP:</span> <span className="font-medium">${Number(liveBbVehicle.msrp || 0).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium">{liveBbVehicle.fuel_type || "—"}</span></div>
                </div>
              </div>

              {/* ═══ UNIFIED SPLIT LAYOUT ═══ */}
              <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
                {/* ── LEFT: Controls Panel ── */}
                <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
                  {/* Vehicle condition inputs */}
                  <InlineSection icon={<Car className="w-3.5 h-3.5 text-primary" />} title="Vehicle Condition" defaultOpen>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] font-semibold">Condition</Label>
                        <Select value={liveCondition} onValueChange={setLiveCondition}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize text-xs">{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
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
                  </InlineSection>

                  {/* Equipment */}
                  {liveBbVehicle.add_deduct_list?.length > 0 && (
                    <InlineSection icon={<CheckSquare className="w-3.5 h-3.5 text-primary" />} title={`Equipment (${liveSelectedAddDeducts.length}/${liveBbVehicle.add_deduct_list.length})`}>
                      <div className="space-y-0.5 max-h-36 overflow-y-auto">
                        {liveBbVehicle.add_deduct_list.map((ad: BBAddDeduct) => {
                          const isSelected = liveSelectedAddDeducts.includes(ad.uoc);
                          const dollarStr = ad.avg !== 0 ? ` (${ad.avg > 0 ? "+" : ""}$${Math.abs(ad.avg)})` : "";
                          return (
                            <label key={ad.uoc} className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[10px] ${isSelected ? "bg-primary/10 text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleLiveAddDeduct(ad.uoc)} className="rounded border-border w-3 h-3" />
                              <span className="truncate">{ad.name}{dollarStr}</span>
                              {ad.auto !== "N" && <span className="text-[8px] bg-green-500/10 text-green-600 px-1 rounded shrink-0">auto</span>}
                            </label>
                          );
                        })}
                      </div>
                    </InlineSection>
                  )}

                  {/* ── Inline Pricing Controls ── */}
                  {inlineControls && (
                    <>
                      <InlineSection icon={<SlidersHorizontal className="w-3.5 h-3.5 text-primary" />} title="Valuation Basis" defaultOpen>
                        <Select value={localSettings.bb_value_basis} onValueChange={v => updateLocalSetting("bb_value_basis", v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BB_VALUE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </InlineSection>

                      <InlineSection icon={<Gauge className="w-3.5 h-3.5 text-primary" />} title="Condition Multipliers">
                        <div className="grid grid-cols-2 gap-2">
                          {(["excellent", "good", "fair", "rough"] as const).map(grade => (
                            <div key={grade} className="space-y-1">
                              <Label className="capitalize text-[10px] font-semibold">{grade}</Label>
                              <Input
                                type="number" step="0.01" min="0" max="2"
                                value={localSettings.condition_multipliers[grade]}
                                onChange={e => updateLocalSetting("condition_multipliers", { ...localSettings.condition_multipliers, [grade]: Number(e.target.value) })}
                                className="w-full h-6 text-[10px]"
                              />
                              <Slider
                                value={[localSettings.condition_multipliers[grade] * 100]}
                                min={50} max={130} step={1}
                                onValueChange={([v]) => updateLocalSetting("condition_multipliers", { ...localSettings.condition_multipliers, [grade]: Math.round(v) / 100 })}
                              />
                            </div>
                          ))}
                        </div>
                      </InlineSection>

                      <InlineSection icon={<Zap className="w-3.5 h-3.5 text-accent" />} title="Global Controls" defaultOpen>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] font-semibold">Global %</Label>
                            <Input type="number" value={localSettings.global_adjustment_pct} onChange={e => updateLocalSetting("global_adjustment_pct", Number(e.target.value))} className="h-6 text-[10px]" step="0.5" />
                          </div>
                          <div>
                            <Label className="text-[10px] font-semibold">Regional %</Label>
                            <Input type="number" value={localSettings.regional_adjustment_pct} onChange={e => updateLocalSetting("regional_adjustment_pct", Number(e.target.value))} className="h-6 text-[10px]" step="0.5" />
                          </div>
                          <div>
                            <Label className="text-[10px] font-semibold">Recon Cost</Label>
                            <Input type="number" value={localSettings.recon_cost} onChange={e => updateLocalSetting("recon_cost", Number(e.target.value))} className="h-6 text-[10px]" step="50" />
                          </div>
                          <div>
                            <Label className="text-[10px] font-semibold">Floor</Label>
                            <Input type="number" value={localSettings.offer_floor} onChange={e => updateLocalSetting("offer_floor", Number(e.target.value))} className="h-6 text-[10px]" step="100" />
                          </div>
                        </div>
                      </InlineSection>

                      <InlineSection icon={<Calendar className="w-3.5 h-3.5 text-primary" />} title={`Age Tiers (${(localSettings.age_tiers || []).length})`}>
                        <div className="space-y-1">
                          {(localSettings.age_tiers || []).map((tier, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-[10px]">
                              <Input type="number" value={tier.min_years} onChange={e => { const u = [...(localSettings.age_tiers || [])]; u[idx] = { ...u[idx], min_years: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-12 h-5 text-[10px]" />
                              <span>-</span>
                              <Input type="number" value={tier.max_years} onChange={e => { const u = [...(localSettings.age_tiers || [])]; u[idx] = { ...u[idx], max_years: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-12 h-5 text-[10px]" />
                              <span>yr →</span>
                              <Input type="number" value={tier.adjustment_pct} onChange={e => { const u = [...(localSettings.age_tiers || [])]; u[idx] = { ...u[idx], adjustment_pct: Number(e.target.value) }; updateLocalSetting("age_tiers", u); }} className="w-14 h-5 text-[10px]" step="0.5" />
                              <span>%</span>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => updateLocalSetting("age_tiers", (localSettings.age_tiers || []).filter((_, i) => i !== idx))}>
                                <Trash2 className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" className="h-5 text-[9px] gap-0.5 px-2" onClick={() => {
                            const tiers = localSettings.age_tiers || [];
                            const last = tiers.length > 0 ? tiers[tiers.length - 1].max_years + 1 : 5;
                            updateLocalSetting("age_tiers", [...tiers, { min_years: last, max_years: last + 4, adjustment_pct: -3 }]);
                          }}>
                            <Plus className="w-2.5 h-2.5" /> Add
                          </Button>
                        </div>
                      </InlineSection>

                      <InlineSection icon={<Gauge className="w-3.5 h-3.5 text-primary" />} title={`Mileage Tiers (${(localSettings.mileage_tiers || []).length})`}>
                        <div className="space-y-1">
                          {(localSettings.mileage_tiers || []).map((tier, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-[10px]">
                              <Input type="number" value={tier.min_miles} onChange={e => { const u = [...(localSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], min_miles: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="5000" />
                              <span>-</span>
                              <Input type="number" value={tier.max_miles} onChange={e => { const u = [...(localSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], max_miles: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="5000" />
                              <span>mi →$</span>
                              <Input type="number" value={tier.adjustment_flat} onChange={e => { const u = [...(localSettings.mileage_tiers || [])]; u[idx] = { ...u[idx], adjustment_flat: Number(e.target.value) }; updateLocalSetting("mileage_tiers", u); }} className="w-16 h-5 text-[10px]" step="100" />
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => updateLocalSetting("mileage_tiers", (localSettings.mileage_tiers || []).filter((_, i) => i !== idx))}>
                                <Trash2 className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" className="h-5 text-[9px] gap-0.5 px-2" onClick={() => {
                            const tiers = localSettings.mileage_tiers || [];
                            const last = tiers.length > 0 ? tiers[tiers.length - 1].max_miles + 1 : 80000;
                            updateLocalSetting("mileage_tiers", [...tiers, { min_miles: last, max_miles: last + 20000, adjustment_flat: -500 }]);
                          }}>
                            <Plus className="w-2.5 h-2.5" /> Add
                          </Button>
                        </div>
                      </InlineSection>

                      <InlineSection icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />} title="Deductions">
                        <div className="space-y-1">
                          {Object.entries(DEDUCTION_LABELS).map(([key, config]) => {
                            const enabled = (localSettings.deductions_config as any)?.[key] ?? true;
                            return (
                              <div key={key} className={`rounded border px-2 py-1 ${enabled ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 opacity-50"}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold">{config.label}</span>
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
                      </InlineSection>
                    </>
                  )}
                </div>

                {/* ── RIGHT: Results Panel ── */}
                <div className="space-y-4">
                  {liveResult && (
                    <>
                      {/* Offer result */}
                      <ResultCard
                        label="Live Offer Estimate"
                        result={liveResult}
                        condition={liveCondition}
                        settings={activeSettings}
                        mileage={liveMileage}
                        year={liveBbVehicle.year}
                        variant="primary"
                        equipmentTotal={calcEquipmentTotal(liveBbVehicle, liveSelectedAddDeducts)}
                      />

                      {/* Profit Spread Gauge */}
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
                    </>
                  )}

                  {!liveResult && (
                    <div className="bg-muted/40 rounded-lg p-6 text-sm text-muted-foreground text-center">
                      Adjust vehicle condition on the left to calculate an offer.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {!liveBbVehicle && !liveLoading && (
            <div className="bg-muted/40 rounded-lg p-8 text-sm text-muted-foreground text-center">
              <Car className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Enter a VIN and mileage above, then click <strong>Look Up</strong> to pull live valuation data and start tuning your pricing model.
            </div>
          )}
        </TabsContent>

        {/* ── Manual Mode ── */}
        <TabsContent value="manual">
          <p className="text-sm text-muted-foreground mb-3">
            Enter a hypothetical vehicle to preview how your settings calculate an offer.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-xs font-semibold">Base BB Value ($)</Label>
              <Input type="number" value={baseValue} onChange={e => setBaseValue(Number(e.target.value))} step="500" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Year</Label>
              <Input type="number" value={year} onChange={e => setYear(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Mileage</Label>
              <Input type="number" value={mileage} onChange={e => setMileage(e.target.value)} step="5000" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Make</Label>
              <Input value={make} onChange={e => setMake(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Model</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Accidents</Label>
              <Select value={accidents} onValueChange={setAccidents}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3+">3+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Drivable?</Label>
              <Select value={drivable} onValueChange={setDrivable}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {result && (
            <ResultCard
              label="Estimated Offer"
              result={result}
              condition={condition}
              settings={activeSettings}
              mileage={mileage}
              year={year}
              variant="primary"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

function calcEquipmentTotal(bbVehicle: BBVehicle, selectedUocs: string[]): number {
  return (bbVehicle.add_deduct_list || [])
    .filter(ad => selectedUocs.includes(ad.uoc))
    .reduce((sum, ad) => sum + (ad.avg || 0), 0);
}

// ── Result Card ──
const ResultCard = ({
  label, result, condition, settings, mileage, year, variant, delta, equipmentTotal,
}: {
  label: string;
  result: OfferEstimate;
  condition: string;
  settings: OfferSettings;
  mileage: string;
  year: string;
  variant: "primary" | "muted";
  delta?: number;
  equipmentTotal?: number;
}) => {
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - Number(year);
  const mileageNum = parseInt(mileage.replace(/[^0-9]/g, "")) || 0;

  const matchedAgeTier = (settings.age_tiers || []).find(
    t => vehicleAge >= t.min_years && vehicleAge <= t.max_years
  );
  const matchedMileageTier = (settings.mileage_tiers || []).find(
    t => mileageNum >= t.min_miles && mileageNum <= t.max_miles
  );

  const condMult = settings.condition_multipliers?.[condition as keyof typeof settings.condition_multipliers] ?? 1;
  const borderClass = variant === "primary" ? "border-primary/30" : "border-border";

  return (
    <div className={`rounded-lg border ${borderClass} bg-muted/40 p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${delta > 0 ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
            {delta > 0 ? "+" : ""}${delta.toLocaleString()}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-primary">
        ${result.low.toLocaleString()} – ${result.high.toLocaleString()}
      </div>

      <OfferWaterfall
        baseValue={result.baseValue}
        conditionMultiplier={condMult}
        deductions={result.totalDeductions}
        reconCost={result.reconCost}
        equipmentTotal={equipmentTotal || 0}
        ageTierAdjustment={matchedAgeTier?.adjustment_pct || 0}
        mileageTierAdjustment={matchedMileageTier?.adjustment_flat || 0}
        regionalPct={settings.regional_adjustment_pct || 0}
        globalPct={settings.global_adjustment_pct || 0}
        rulesAdjustment={result.matchedRuleIds.length}
        finalHigh={result.high}
        floor={settings.offer_floor || 500}
        ceiling={settings.offer_ceiling}
      />

      {(matchedAgeTier || matchedMileageTier || result.matchedRuleIds.length > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {matchedAgeTier && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Age {vehicleAge}yr: {matchedAgeTier.adjustment_pct > 0 ? "+" : ""}{matchedAgeTier.adjustment_pct}%
            </span>
          )}
          {matchedMileageTier && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {mileageNum.toLocaleString()}mi: {matchedMileageTier.adjustment_flat > 0 ? "+" : ""}${matchedMileageTier.adjustment_flat.toLocaleString()}
            </span>
          )}
          {result.matchedRuleIds.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
              {result.matchedRuleIds.length} rule(s)
            </span>
          )}
          {result.isHotLead && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
              🔥 Hot
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default OfferSimulator;
