import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingDown, TrendingUp, Minus, ArrowRight, Search, Loader2, Car, CheckSquare } from "lucide-react";
import { calculateOffer, type OfferSettings, type OfferRule, type OfferEstimate } from "@/lib/offerCalculator";
import type { FormData, BBVehicle, BBAddDeduct } from "@/components/sell-form/types";
import { supabase } from "@/integrations/supabase/client";
import OfferWaterfall from "./OfferWaterfall";
import { useToast } from "@/hooks/use-toast";

interface Props {
  settings: OfferSettings;
  savedSettings: OfferSettings | null;
  rules: OfferRule[];
}

const CONDITIONS = ["excellent", "good", "fair", "rough"] as const;

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

const OfferSimulator = ({ settings, savedSettings, rules }: Props) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("manual");

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
  const [liveCompareMode, setLiveCompareMode] = useState(false);

  // Manual mode calculations
  const { bbVehicle, formData } = useMemo(
    () => buildTestData(baseValue, year, make, model, mileage, condition, accidents, exteriorItems, mechanicalItems, drivable, smokedIn),
    [baseValue, year, make, model, mileage, condition, accidents, exteriorItems, mechanicalItems, drivable, smokedIn]
  );

  const result = useMemo(
    () => calculateOffer(bbVehicle, formData, [], settings, rules),
    [bbVehicle, formData, settings, rules]
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
    () => liveBbVehicle ? calculateOffer(liveBbVehicle, liveFormData, liveSelectedAddDeducts, settings, rules) : null,
    [liveBbVehicle, liveFormData, liveSelectedAddDeducts, settings, rules]
  );

  const liveSavedResult = useMemo(
    () => liveBbVehicle && savedSettings ? calculateOffer(liveBbVehicle, liveFormData, liveSelectedAddDeducts, savedSettings, rules) : null,
    [liveBbVehicle, liveFormData, liveSelectedAddDeducts, savedSettings, rules]
  );

  const hasUnsavedChanges = savedSettings && JSON.stringify(settings) !== JSON.stringify(savedSettings);

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
      // Auto-select detected equipment
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
    <div className="bg-card rounded-xl p-5 shadow-lg border border-border border-l-4 border-l-primary/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Offer Simulator</h3>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="manual" className="gap-1.5"><Calculator className="w-3.5 h-3.5" />Manual</TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5"><Search className="w-3.5 h-3.5" />Live VIN Lookup</TabsTrigger>
        </TabsList>

        {/* ── Manual Mode ── */}
        <TabsContent value="manual">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {compareMode
                ? "Comparing unsaved changes (right) against saved settings (left)."
                : "Enter a hypothetical vehicle to preview how your settings calculate an offer."}
            </p>
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor="compare-toggle" className="text-xs font-medium text-muted-foreground cursor-pointer">What-If</Label>
                <Switch id="compare-toggle" checked={compareMode} onCheckedChange={setCompareMode} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div>
              <Label className="text-xs font-semibold">Base BB Value ($)</Label>
              <Input type="number" value={baseValue} onChange={e => setBaseValue(Number(e.target.value))} step="500" className="h-9" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Year</Label>
              <Input type="number" value={year} onChange={e => setYear(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Mileage</Label>
              <Input type="number" value={mileage} onChange={e => setMileage(e.target.value)} step="5000" className="h-9" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Make</Label>
              <Input value={make} onChange={e => setMake(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Model</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Accidents</Label>
              <Select value={accidents} onValueChange={setAccidents}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Exterior Damage Items</Label>
              <Input type="number" min={0} max={10} value={exteriorItems} onChange={e => setExteriorItems(Number(e.target.value))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Mechanical Issues</Label>
              <Input type="number" min={0} max={10} value={mechanicalItems} onChange={e => setMechanicalItems(Number(e.target.value))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Smoked In?</Label>
              <Select value={smokedIn} onValueChange={setSmokedIn}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {compareMode && savedResult && result ? (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
              <ResultCard label="Saved Settings" result={savedResult} condition={condition} settings={savedSettings!} mileage={mileage} year={year} variant="muted" />
              <div className="hidden md:flex items-center justify-center pt-10">
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
              </div>
              <ResultCard label="Unsaved Changes" result={result} condition={condition} settings={settings} mileage={mileage} year={year} variant="primary" delta={result.high - savedResult.high} />
            </div>
          ) : result ? (
            <ResultCard label="Estimated Offer" result={result} condition={condition} settings={settings} mileage={mileage} year={year} variant="primary" />
          ) : (
            <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground text-center">
              Enter a base value above $0 to see a simulated offer.
            </div>
          )}
        </TabsContent>

        {/* ── Live VIN Lookup Mode ── */}
        <TabsContent value="live">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              Enter a real VIN and mileage to pull live Black Book data and calculate an offer with your current settings.
            </p>
            {hasUnsavedChanges && liveBbVehicle && (
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor="live-compare-toggle" className="text-xs font-medium text-muted-foreground cursor-pointer">What-If</Label>
                <Switch id="live-compare-toggle" checked={liveCompareMode} onCheckedChange={setLiveCompareMode} />
              </div>
            )}
          </div>

          {/* VIN + Mileage inputs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="flex-1">
              <Label className="text-xs font-semibold">VIN</Label>
              <Input
                value={liveVin}
                onChange={e => setLiveVin(e.target.value.toUpperCase())}
                placeholder="Enter 17-character VIN"
                maxLength={17}
                className="h-9 font-mono tracking-wider"
              />
            </div>
            <div className="w-32">
              <Label className="text-xs font-semibold">Mileage</Label>
              <Input
                type="number"
                value={liveMileage}
                onChange={e => setLiveMileage(e.target.value)}
                step="5000"
                className="h-9"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleVinLookup}
                disabled={liveLoading || liveVin.trim().length !== 17}
                className="h-9 gap-1.5"
              >
                {liveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {liveLoading ? "Looking up…" : "Look Up"}
              </Button>
            </div>
          </div>

          {/* Vehicle found card */}
          {liveBbVehicle && (
            <div className="space-y-4">
              {/* Vehicle summary */}
              <div className="bg-muted/40 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Car className="w-4 h-4 text-primary" />
                  <span className="font-bold text-sm text-card-foreground">
                    {liveBbVehicle.year} {liveBbVehicle.make} {liveBbVehicle.model} {liveBbVehicle.series}
                  </span>
                  {liveBbVehicle.class_name && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{liveBbVehicle.class_name}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Style:</span> <span className="font-medium">{liveBbVehicle.style || "—"}</span></div>
                  <div><span className="text-muted-foreground">Drivetrain:</span> <span className="font-medium">{liveBbVehicle.drivetrain || "—"}</span></div>
                  <div><span className="text-muted-foreground">Engine:</span> <span className="font-medium">{liveBbVehicle.engine || "—"}</span></div>
                  <div><span className="text-muted-foreground">Transmission:</span> <span className="font-medium">{liveBbVehicle.transmission || "—"}</span></div>
                  <div><span className="text-muted-foreground">MSRP:</span> <span className="font-medium">${Number(liveBbVehicle.msrp || 0).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Trade-In Avg:</span> <span className="font-medium">${Number(liveBbVehicle.tradein?.avg || 0).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Wholesale Avg:</span> <span className="font-medium">${Number(liveBbVehicle.wholesale?.avg || 0).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Retail Avg:</span> <span className="font-medium">${Number(liveBbVehicle.retail?.avg || 0).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Equipment add/deducts */}
              {liveBbVehicle.add_deduct_list?.length > 0 && (
                <div className="bg-muted/40 rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    <span className="font-bold text-sm text-card-foreground">Equipment (Add/Deducts)</span>
                    <span className="text-xs text-muted-foreground">
                      {liveSelectedAddDeducts.length} of {liveBbVehicle.add_deduct_list.length} selected
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {liveBbVehicle.add_deduct_list.map((ad: BBAddDeduct) => {
                      const isSelected = liveSelectedAddDeducts.includes(ad.uoc);
                      const dollarStr = ad.avg !== 0
                        ? ` (${ad.avg > 0 ? "+" : ""}$${Math.abs(ad.avg).toLocaleString()})`
                        : "";
                      return (
                        <label
                          key={ad.uoc}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                            isSelected ? "bg-primary/10 text-card-foreground" : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLiveAddDeduct(ad.uoc)}
                            className="rounded border-border"
                          />
                          <span className="truncate">{ad.name}{dollarStr}</span>
                          {ad.auto !== "N" && (
                            <span className="text-[10px] bg-green-500/10 text-green-600 px-1 rounded shrink-0">auto</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Condition inputs for live mode */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Condition</Label>
                  <Select value={liveCondition} onValueChange={setLiveCondition}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Accidents</Label>
                  <Select value={liveAccidents} onValueChange={setLiveAccidents}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
                  <Select value={liveDrivable} onValueChange={setLiveDrivable}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Smoked In?</Label>
                  <Select value={liveSmokedIn} onValueChange={setLiveSmokedIn}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Exterior Damage Items</Label>
                  <Input type="number" min={0} max={10} value={liveExteriorItems} onChange={e => setLiveExteriorItems(Number(e.target.value))} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Mechanical Issues</Label>
                  <Input type="number" min={0} max={10} value={liveMechanicalItems} onChange={e => setLiveMechanicalItems(Number(e.target.value))} className="h-9" />
                </div>
              </div>

              {/* Results */}
              {liveCompareMode && liveSavedResult && liveResult ? (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                  <ResultCard label="Saved Settings" result={liveSavedResult} condition={liveCondition} settings={savedSettings!} mileage={liveMileage} year={liveBbVehicle.year} variant="muted" equipmentTotal={calcEquipmentTotal(liveBbVehicle, liveSelectedAddDeducts)} />
                  <div className="hidden md:flex items-center justify-center pt-10">
                    <ArrowRight className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <ResultCard label="Unsaved Changes" result={liveResult} condition={liveCondition} settings={settings} mileage={liveMileage} year={liveBbVehicle.year} variant="primary" delta={liveResult.high - liveSavedResult.high} equipmentTotal={calcEquipmentTotal(liveBbVehicle, liveSelectedAddDeducts)} />
                </div>
              ) : liveResult ? (
                <ResultCard label="Live Offer Estimate" result={liveResult} condition={liveCondition} settings={settings} mileage={liveMileage} year={liveBbVehicle.year} variant="primary" equipmentTotal={calcEquipmentTotal(liveBbVehicle, liveSelectedAddDeducts)} />
              ) : null}
            </div>
          )}

          {!liveBbVehicle && !liveLoading && (
            <div className="bg-muted/40 rounded-lg p-6 text-sm text-muted-foreground text-center">
              Enter a VIN and mileage above, then click <strong>Look Up</strong> to pull live Black Book data.
            </div>
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
      <div className="text-xl font-bold text-primary">
        ${result.low.toLocaleString()} – ${result.high.toLocaleString()}
      </div>

      {/* Waterfall Chart */}
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
