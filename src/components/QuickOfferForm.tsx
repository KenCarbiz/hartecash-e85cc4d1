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
      // In demo_mode the edge function short-circuits and returns a
      // synthetic vehicle so the customer flow keeps working while the
      // upstream BB sandbox is offline. We pass dealership_id so the
      // function can resolve the per-tenant flag.
      const lookupBody: Record<string, unknown> = {
        lookup_type: identifierMode === "vin" ? "vin" : "plate",
        state: state || "CT",
        dealership_id: tenant.dealership_id,
        demo_mode: (config as any)?.demo_mode === true ? true : undefined,
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
      // Retry once on failure — transient network errors shouldn't
      // demote the customer from "firm offer" to "estimate range"
      // when the dealer's set up the auto-firm rule. Hard fail still
      // falls back to calculateOffer's defaults (estimate range, no
      // firm number) which is the same behavior as a dealer who
      // hasn't enabled auto-firm.
      let offerSettings: OfferSettings | null = null;
      let offerRules: OfferRule[] = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resolved = await resolveEffectiveSettings(tenant.dealership_id);
          offerSettings = resolved.settings;
          offerRules = resolved.rules;
          break;
        } catch (e) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          console.warn("resolveEffectiveSettings failed twice — using defaults:", e);
        }
      }

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

      // Auto-firm rule (Carvana wedge — see migration
      // 20260501000000_auto_firm_offer_pct). When the dealer has
      // configured `auto_firm_offer_pct`, set offered_price to that
      // percentage of the high estimate so the customer lands on the
      // offer page with a real number instead of a range. Skip when
      // the offer is subject to inspection (non-driveable / major
      // damage) — those need a manual look before a firm number, OR
      // when no estimate could be computed.
      const autoFirmPct = offerSettings
        ? ((offerSettings as unknown as { auto_firm_offer_pct?: number | null })
            .auto_firm_offer_pct ?? null)
        : null;
      let firmOfferedPrice =
        autoFirmPct != null && estimate?.high && !subjectToInspection
          ? Math.round(estimate.high * autoFirmPct)
          : null;

      // Demo-mode offer override. Black Book sandbox is offline; clamp
      // every customer-facing offer to site_config.demo_offer_amount
      // (default $23,599) so the cadence + acceptance flow can still be
      // demoed end-to-end. We override low/high too so the offer page
      // reads the same number from any field.
      const isDemoMode =
        (config as any)?.demo_mode === true || bbData?.demo_mode === true;
      const demoOfferAmount = Number((config as any)?.demo_offer_amount ?? 23599) || 23599;
      let demoEstimateLow: number | null = estimate?.low ?? null;
      let demoEstimateHigh: number | null = estimate?.high ?? null;
      if (isDemoMode) {
        firmOfferedPrice = demoOfferAmount;
        demoEstimateLow = demoOfferAmount;
        demoEstimateHigh = demoOfferAmount;
      }

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
        lead_source: isDemoMode ? `${leadSource}-demo` : leadSource,
        dealership_id: tenant.dealership_id,
        ...bbPayload,
        estimated_offer_low: demoEstimateLow,
        estimated_offer_high: demoEstimateHigh,
        // Firm offer when the dealer opted in via auto_firm_offer_pct;
        // otherwise null and the manager bumps before customer sees it.
        // In demo_mode this is forced to demo_offer_amount above.
        offered_price: firmOfferedPrice,
        is_hot_lead: isDemoMode ? false : (estimate?.isHotLead || false),
        offer_subject_to_inspection: isDemoMode ? false : subjectToInspection,
        // TCPA consent snapshot — captures the exact disclosure copy
        // and version the customer saw at submit time. Required for
        // FCC 2024 one-to-one defense if a TCPA claim is ever filed.
        tcpa_consent_at: new Date().toISOString(),
        tcpa_consent_version: (config as any)?.tcpa_disclosure_version || 1,
        tcpa_consent_text: (config as any)?.tcpa_disclosure || null,
      } as any);

      if (insertErr) throw insertErr;

      // No consent is logged here: this step collects only ZIP + intent, not
      // contact info, so a consent_log row would be empty and prove nothing.
      // Consent is recorded on the offer page when the customer enters their
      // name/phone/email (tied to this submission token).
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
        {(config as any)?.demo_mode === true && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider mb-1">
            Demo mode
          </div>
        )}
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

      {/*
        TCPA disclosure — per-tenant copy from site_config.tcpa_disclosure
        with a sane fallback so the form still works for tenants that
        haven't customized. Required by FCC 2024 one-to-one rule: the
        consent must be tied to THIS dealership, not a generic platform
        umbrella. Visible directly above/below the submit button so
        plaintiff firms can't argue the consumer didn't see it.
      */}
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        {(config as any)?.tcpa_disclosure
          || "By submitting this form, I consent to receive automated and prerecorded calls, texts, and emails from this dealership and its agents about my vehicle inquiry, including via autodialer. Consent is not a condition of any purchase. Standard message and data rates may apply. Reply STOP to opt out."}
      </p>
    </form>
  );
};

export default QuickOfferForm;
