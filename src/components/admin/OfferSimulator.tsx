import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { calculateOffer, type OfferSettings, type OfferRule } from "@/lib/offerCalculator";
import type { FormData, BBVehicle } from "@/components/sell-form/types";

interface Props {
  settings: OfferSettings;
  rules: OfferRule[];
}

const CONDITIONS = ["excellent", "good", "fair", "rough"] as const;

const OfferSimulator = ({ settings, rules }: Props) => {
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

  const result = useMemo(() => {
    // Build a minimal BBVehicle with the base value placed at every tier
    const bbVehicle: BBVehicle = {
      uvc: "SIM", vin: "", year, make, model,
      series: "", style: "", class_name: "", msrp: 0, price_includes: "",
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
      nextStep: "",
    };

    return calculateOffer(bbVehicle, formData, [], settings, rules);
  }, [baseValue, year, make, model, mileage, condition, accidents, exteriorItems, mechanicalItems, drivable, smokedIn, settings, rules]);

  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - Number(year);

  // Find matching age tier
  const matchedAgeTier = (settings.age_tiers || []).find(
    t => vehicleAge >= t.min_years && vehicleAge <= t.max_years
  );

  // Find matching mileage tier
  const mileageNum = parseInt(mileage.replace(/[^0-9]/g, "")) || 0;
  const matchedMileageTier = (settings.mileage_tiers || []).find(
    t => mileageNum >= t.min_miles && mileageNum <= t.max_miles
  );

  return (
    <div className="bg-card rounded-xl p-5 shadow-lg border border-border border-l-4 border-l-primary/50">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-card-foreground">Offer Simulator</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Enter a hypothetical vehicle to preview how your current settings calculate an offer — changes apply in real-time before saving.
      </p>

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

      {/* Result */}
      {result ? (
        <div className="bg-muted/40 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-card-foreground">Estimated Offer Range</span>
            <span className="text-xl font-bold text-primary">
              ${result.low.toLocaleString()} – ${result.high.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Stat label="Base Value" value={`$${result.baseValue.toLocaleString()}`} />
            <Stat label={`Condition (${condition})`} value={`×${settings.condition_multipliers?.[condition as keyof typeof settings.condition_multipliers] ?? 1}`} icon={settings.condition_multipliers?.[condition as keyof typeof settings.condition_multipliers] >= 1 ? "up" : "down"} />
            <Stat label="Deductions" value={`−$${result.totalDeductions.toLocaleString()}`} icon="down" />
            <Stat label="Recon Cost" value={`−$${result.reconCost.toLocaleString()}`} icon="down" />
          </div>

          {(matchedAgeTier || matchedMileageTier || result.matchedRuleIds.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {matchedAgeTier && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  Age: {vehicleAge}yr → {matchedAgeTier.adjustment_pct > 0 ? "+" : ""}{matchedAgeTier.adjustment_pct}%
                </span>
              )}
              {matchedMileageTier && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  Mileage: {mileageNum.toLocaleString()}mi → {matchedMileageTier.adjustment_flat > 0 ? "+" : ""}${matchedMileageTier.adjustment_flat.toLocaleString()}
                </span>
              )}
              {result.matchedRuleIds.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                  {result.matchedRuleIds.length} rule(s) matched
                </span>
              )}
              {result.isHotLead && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                  🔥 Hot Lead
                </span>
              )}
            </div>
          )}

          {settings.global_adjustment_pct !== 0 && (
            <p className="text-xs text-muted-foreground">Global adjustment: {settings.global_adjustment_pct > 0 ? "+" : ""}{settings.global_adjustment_pct}%</p>
          )}
        </div>
      ) : (
        <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground text-center">
          Enter a base value above $0 to see a simulated offer.
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, icon }: { label: string; value: string; icon?: "up" | "down" | "neutral" }) => (
  <div className="flex flex-col">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold text-card-foreground flex items-center gap-1">
      {icon === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
      {icon === "down" && <TrendingDown className="w-3 h-3 text-destructive" />}
      {icon === "neutral" && <Minus className="w-3 h-3 text-muted-foreground" />}
      {value}
    </span>
  </div>
);

export default OfferSimulator;
