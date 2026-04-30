import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, Shield, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateOffer, type OfferSettings, type OfferRule } from "@/lib/offerCalculator";
import { resolveEffectiveSettings } from "@/lib/resolvePricingModel";
import { buildSubmissionBBPayload } from "@/lib/submissionOffer";
import { initialFormData, type FormData, type BBVehicle } from "./sell-form/types";
import { logConsent } from "@/lib/consent";
import { track } from "@/lib/analytics";

const STATE_LIST = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

interface QuickOfferFormProps {
  leadSource?: string;
}

/**
 * One-screen offer entry — Carvana/CarMax style.
 *
 * Plate (or VIN) + ZIP + mileage + two yes/no condition Q's gets the
 * customer to a real offer page in seconds. Skips the trim-disambig
 * step (picks the first Black Book match) and assumes "good"
 * condition with no damage as a baseline. The full SellCarForm
 * remains available for the deeper flow when the dealer wants the
 * exhaustive condition capture; this is the conversion-tuned default.
 *
 * Flag: site_config.enable_quick_offer (default false). Landing
 * templates check this flag and render QuickOfferForm in place of
 * SellCarForm when on. Dealer admins toggle in Setup · Branding.
 */
const QuickOfferForm = ({ leadSource = "quick-offer" }: QuickOfferFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const { tenant } = useTenant();

  const [submitting, setSubmitting] = useState(false);
  const [identifierMode, setIdentifierMode] = useState<"plate" | "vin">("plate");
  const [plate, setPlate] = useState("");
  const [state, setState] = useState("CT");
  const [vin, setVin] = useState("");
  const [mileage, setMileage] = useState("");
  const [zip, setZip] = useState("");
  const [drivable, setDrivable] = useState<"" | "Yes" | "No">("");
  const [majorDamage, setMajorDamage] = useState<"" | "Yes" | "No">("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Minimal validation — keep the form fast.
    if (identifierMode === "plate" && !plate.trim()) {
      toast({ title: "Enter a license plate", variant: "destructive" });
      return;
    }
    if (identifierMode === "vin" && vin.trim().length < 9) {
      toast({ title: "VIN looks too short", variant: "destructive" });
      return;
    }
    if (!mileage.trim() || !zip.trim()) {
      toast({ title: "Mileage and ZIP are required", variant: "destructive" });
      return;
    }
    if (!drivable || !majorDamage) {
      toast({ title: "Answer both condition questions", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // ── 1. Black Book lookup. ──
      const lookupBody: Record<string, unknown> = {
        lookup_type: identifierMode === "vin" ? "vin" : "plate",
        state: state || "CT",
      };
      if (identifierMode === "vin") lookupBody.vin = vin.trim();
      else {
        lookupBody.plate = plate.trim();
        lookupBody.state = state.trim();
      }

      const { data: bbData, error: bbErr } = await supabase.functions.invoke("bb-lookup", {
        body: lookupBody,
      });

      if (bbErr || bbData?.error || !Array.isArray(bbData?.vehicles) || bbData.vehicles.length === 0) {
        toast({
          title: "Couldn't identify the vehicle",
          description: "Try VIN instead, or use the full form for manual entry.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // First match wins — no trim disambiguation step. The full form
      // is still available if the customer wants to be precise.
      const bbVehicle = bbData.vehicles[0] as BBVehicle;

      // ── 2. Build a FormData with sensible defaults. ──
      const formData: FormData = {
        ...initialFormData,
        plate: identifierMode === "plate" ? plate.trim() : "",
        state: state || "CT",
        vin: identifierMode === "vin" ? vin.trim() : (bbVehicle.vin || ""),
        mileage: mileage.replace(/[^0-9]/g, ""),
        zip: zip.trim(),
        bbUvc: bbVehicle.uvc || "",
        overallCondition: majorDamage === "Yes" ? "fair" : "good",
        drivable,
        // No deeper condition data — calculateOffer treats unset
        // arrays as "nothing reported" which is what we want for the
        // optimistic baseline.
      };

      // ── 3. Resolve dealer offer settings + compute estimate. ──
      let offerSettings: OfferSettings | null = null;
      let offerRules: OfferRule[] = [];
      try {
        const resolved = await resolveEffectiveSettings(tenant.dealership_id);
        offerSettings = resolved.settings;
        offerRules = resolved.rules;
      } catch { /* fall back to defaults inside calculateOffer */ }

      const estimate = calculateOffer(bbVehicle, formData, [], offerSettings, offerRules);
      const bbPayload = buildSubmissionBBPayload(bbVehicle);

      // ── 4. Insert submission, generate token, redirect. ──
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const generatedToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Submissions where the customer flagged non-driveable or major
      // damage are explicitly subject to inspection — the dealer's
      // appraiser will re-price after seeing the vehicle.
      const subjectToInspection = drivable === "No" || majorDamage === "Yes";

      const { error: insertErr } = await supabase.from("submissions").insert({
        token: generatedToken,
        plate: formData.plate || null,
        state: formData.state || null,
        vin: formData.vin || null,
        mileage: formData.mileage || null,
        vehicle_year: bbVehicle.year || null,
        vehicle_make: bbVehicle.make || null,
        vehicle_model: bbVehicle.model || null,
        zip: formData.zip || null,
        overall_condition: formData.overallCondition,
        drivable: formData.drivable,
        next_step: "contact",
        lead_source: leadSource,
        dealership_id: tenant.dealership_id,
        ...bbPayload,
        estimated_offer_low: estimate?.low || null,
        estimated_offer_high: estimate?.high || null,
        is_hot_lead: estimate?.isHotLead || false,
        offer_subject_to_inspection: subjectToInspection,
      } as any);

      if (insertErr) throw insertErr;

      // Track + log consent for compliance (the customer confirmed
      // their ZIP and intent by submitting; SMS/email come later when
      // they enter contact info on the offer page).
      logConsent({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        formSource: "quick_offer",
      });
      track("quick_offer_submitted", { dealership_id: tenant.dealership_id });

      navigate(`/offer/${generatedToken}`);
    } catch (e: any) {
      toast({
        title: "Couldn't generate your offer",
        description: e?.message || "Try again or use the full form.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card rounded-2xl shadow-xl border border-border/50 p-6 max-w-lg mx-auto space-y-4"
    >
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5" />
          60-second offer
        </div>
        <h2 className="font-display text-2xl font-bold text-card-foreground">
          {config.dealership_name ? `Sell to ${config.dealership_name}` : "Get Your Cash Offer"}
        </h2>
        <p className="text-xs text-muted-foreground">
          One screen. Real offer. No haggling.
        </p>
      </div>

      {/* Plate / VIN toggle */}
      <div className="grid grid-cols-2 gap-1.5 bg-muted/50 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setIdentifierMode("plate")}
          className={`py-2 rounded-lg text-sm font-bold transition-colors ${
            identifierMode === "plate"
              ? "bg-card text-card-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          License plate
        </button>
        <button
          type="button"
          onClick={() => setIdentifierMode("vin")}
          className={`py-2 rounded-lg text-sm font-bold transition-colors ${
            identifierMode === "vin"
              ? "bg-card text-card-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          VIN
        </button>
      </div>

      {identifierMode === "plate" ? (
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <div>
            <Label htmlFor="plate" className="text-xs">Plate</Label>
            <Input
              id="plate"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC1234"
              autoComplete="off"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="state" className="text-xs">State</Label>
            <select
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {STATE_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor="vin" className="text-xs">VIN</Label>
          <Input
            id="vin"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            placeholder="17-character VIN"
            maxLength={17}
            autoComplete="off"
            className="mt-1"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="mileage" className="text-xs">Mileage</Label>
          <Input
            id="mileage"
            value={mileage}
            onChange={(e) => setMileage(e.target.value.replace(/[^\d,]/g, ""))}
            placeholder="58,000"
            inputMode="numeric"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="zip" className="text-xs">ZIP</Label>
          <Input
            id="zip"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
            placeholder="06478"
            inputMode="numeric"
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Driveable?</Label>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {(["Yes", "No"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDrivable(v)}
                className={`py-2 rounded-md text-sm font-bold border-2 transition-colors ${
                  drivable === v
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Major damage?</Label>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {(["No", "Yes"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMajorDamage(v)}
                className={`py-2 rounded-md text-sm font-bold border-2 transition-colors ${
                  majorDamage === v
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-xl py-6 text-base gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating your offer…
          </>
        ) : (
          <>
            See My Offer
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </Button>

      <p className="text-[10px] text-muted-foreground/70 text-center flex items-center justify-center gap-1.5">
        <Shield className="w-3 h-3" />
        Your details are never sold. We only use them to make you an offer.
      </p>
    </form>
  );
};

export default QuickOfferForm;
