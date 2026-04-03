import { useState, useRef, useEffect, useCallback } from "react";
import { Shield, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CalculatingOffer from "@/components/CalculatingOffer";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logConsent } from "@/lib/consent";
import { calculateOffer, type OfferEstimate, type OfferSettings, type OfferRule } from "@/lib/offerCalculator";
import { resolveStoreAssignment } from "@/lib/storeAssignment";
import { initialFormData } from "./sell-form/types";
import { useFormConfig } from "@/hooks/useFormConfig";
import { useTenant } from "@/contexts/TenantContext";
import type { FormData, VehicleInfo, BBVehicle } from "./sell-form/types";
import StepVehicleInfo from "./sell-form/StepVehicleInfo";
import StepVehicleBuild from "./sell-form/StepVehicleBuild";
import StepSelectTrim from "./sell-form/StepSelectTrim";
import StepCondition from "./sell-form/StepCondition";
import StepHistory from "./sell-form/StepHistory";
import StepFinalize from "./sell-form/StepFinalize";
import { motion, AnimatePresence } from "framer-motion";

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

interface SellCarFormProps {
  leadSource?: string;
  variant?: "default" | "split";
}

const SellCarForm = ({ leadSource = "inventory", variant = "default" }: SellCarFormProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [showCalculating, setShowCalculating] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const partialIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const { formConfig } = useFormConfig();
  const { tenant } = useTenant();

  // Black Book state
  const [bbVehicles, setBbVehicles] = useState<BBVehicle[]>([]);
  const [bbSelectedVehicle, setBbSelectedVehicle] = useState<BBVehicle | null>(null);
  const [bbLoading, setBbLoading] = useState(false);
  const [selectedAddDeducts, setSelectedAddDeducts] = useState<string[]>([]);
  const [showTrimStep, setShowTrimStep] = useState(false);

  // ── Abandoned form auto-save ──
  // Save a partial submission when the user has contact info but leaves
  const savePartialRef = useRef<() => void>();
  savePartialRef.current = () => {
    if (submittedRef.current) return;
    if (!config.track_abandoned_leads) return;
    const hasContact = formData.email.trim().length > 3 && formData.email.includes("@");
    if (!hasContact) return;

    const payload = {
      progress_status: "partial",
      name: formData.name || null,
      phone: formData.phone || null,
      email: formData.email || null,
      zip: formData.zip || null,
      plate: formData.plate || null,
      state: formData.state || null,
      vin: formData.vin || null,
      mileage: formData.mileage || null,
      vehicle_year: vehicleInfo?.year || null,
      vehicle_make: vehicleInfo?.make || null,
      vehicle_model: vehicleInfo?.model || null,
      exterior_color: formData.exteriorColor || null,
      overall_condition: formData.overallCondition || null,
      lead_source: leadSource,
      dealership_id: tenant.dealership_id,
    };

    if (partialIdRef.current) {
      // Update existing partial
      supabase.from("submissions").update(payload as any).eq("id", partialIdRef.current).then(() => {});
    } else {
      // Insert new partial
      supabase.from("submissions").insert(payload as any).select("id").maybeSingle().then(({ data }) => {
        if (data) partialIdRef.current = data.id;
      });
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => savePartialRef.current?.();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") savePartialRef.current?.();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (step > 0 && formRef.current) {
      const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 80;
      const formTop = formRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: formTop - headerHeight - 8, behavior: "smooth" });
    }
  }, [step]);

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const updateArray = (field: string, value: string) =>
    setFormData((prev) => {
      const arr = (prev as any)[field] as string[];
      if (value === "none") return { ...prev, [field]: ["none"] };
      const without = arr.filter((v) => v !== "none");
      return {
        ...prev,
        [field]: without.includes(value)
          ? without.filter((v) => v !== value)
          : [...without, value],
      };
    });

  const toggleAddDeduct = (uoc: string) => {
    setSelectedAddDeducts((prev) =>
      prev.includes(uoc) ? prev.filter((u) => u !== uoc) : [...prev, uoc]
    );
  };

  // Build step order — when offer_before_details is on, contact info moves to offer page
  const offerFirst = formConfig.offer_before_details;

  const getDisplaySteps = () => {
    const steps: string[] = ["Vehicle Info"];
    if (showTrimStep) steps.push("Select Your Vehicle");
    if (formConfig.step_vehicle_build) steps.push("Vehicle Build");
    if (formConfig.step_condition_history) steps.push("Condition");
    steps.push("History");
    if (!offerFirst) steps.push("Finalize");
    return steps;
  };

  const displaySteps = getDisplaySteps();
  const totalSteps = displaySteps.length;

  const lookupBlackBook = async (): Promise<boolean> => {
    const isPlate = formData.plate.trim().length > 0;
    const isVin = formData.vin.trim().length >= 9;
    if (!isPlate && !isVin) return true;

    setBbLoading(true);
    try {
      const body: Record<string, unknown> = {
        lookup_type: isVin ? "vin" : "plate",
        state: formData.state || "CT",
      };
      if (isVin) body.vin = formData.vin.trim();
      else {
        body.plate = formData.plate.trim();
        body.state = formData.state.trim();
      }

      const { data, error } = await supabase.functions.invoke("bb-lookup", { body });

      if (error || data?.error) {
        console.error("BB lookup failed:", error || data?.error);
        toast({ title: "Vehicle lookup unavailable", description: "We'll continue with manual entry.", variant: "default" });
        setBbLoading(false);
        return true;
      }

      const vehicles: BBVehicle[] = data.vehicles || [];

      if (vehicles.length === 0) {
        toast({ title: "Vehicle not found", description: "Please check your info and try again, or continue manually.", variant: "destructive" });
        setBbLoading(false);
        return false;
      }

      setBbVehicles(vehicles);

      const autoSelected = vehicles[0].add_deduct_list
        .filter((ad) => ad.auto !== "N")
        .map((ad) => ad.uoc);
      setSelectedAddDeducts(autoSelected);

      if (vehicles.length === 1) {
        const v = vehicles[0];
        setBbSelectedVehicle(v);
        setVehicleInfo({ year: v.year, make: v.make, model: v.model });
        setFormData((prev) => ({ ...prev, bbUvc: v.uvc }));
        setShowTrimStep(false);
      } else {
        setShowTrimStep(true);
      }

      setBbLoading(false);
      return true;
    } catch (err) {
      console.error("BB lookup error:", err);
      setBbLoading(false);
      return true;
    }
  };

  const handleTrimSelect = (uvc: string) => {
    const v = bbVehicles.find((veh) => veh.uvc === uvc);
    if (v) {
      setBbSelectedVehicle(v);
      setVehicleInfo({ year: v.year, make: v.make, model: v.model });
      setFormData((prev) => ({ ...prev, bbUvc: v.uvc }));

      const autoSelected = v.add_deduct_list
        .filter((ad) => ad.auto !== "N")
        .map((ad) => ad.uoc);
      setSelectedAddDeducts(autoSelected);
    }
  };

  const validateStep = (): boolean => {
    const missing: string[] = [];
    const currentStepName = displaySteps[step];

    if (currentStepName === "Vehicle Info") {
      if (!formData.vin.trim() && !formData.plate.trim()) missing.push("VIN or License Plate");
      if (formData.plate.trim() && !formData.state.trim()) missing.push("State");
    } else if (currentStepName === "Select Your Vehicle") {
      if (!formData.bbUvc) missing.push("Please select your vehicle");
    } else if (currentStepName === "Vehicle Build") {
      if (formConfig.q_exterior_color && !formData.exteriorColor.trim()) missing.push("Exterior Color");
      if (formConfig.q_drivetrain && !formData.drivetrain) missing.push("Drivetrain");
      if (formConfig.q_modifications && !formData.modifications) missing.push("Modifications");
    } else if (currentStepName === "Condition") {
      if (formConfig.q_overall_condition && !formData.overallCondition) missing.push("Overall Condition");
      if (formConfig.q_exterior_damage && formData.exteriorDamage.length === 0) missing.push("Exterior Damage");
      if (formConfig.q_windshield_damage && !formData.windshieldDamage) missing.push("Windshield Damage");
      const noMoonroofDetectable = bbSelectedVehicle && !bbSelectedVehicle.add_deduct_list?.some(
        ad => /moon|sun|panoramic/i.test(ad.name)
      );
      if (formConfig.q_moonroof && !formData.moonroof && !noMoonroofDetectable) missing.push("Moonroof");
      if (formConfig.q_interior_damage && formData.interiorDamage.length === 0) missing.push("Interior Damage");
      if (formConfig.q_tech_issues && formData.techIssues.length === 0) missing.push("Technology Issues");
      if (formConfig.q_engine_issues && formData.engineIssues.length === 0) missing.push("Engine Issues");
      if (formConfig.q_mechanical_issues && formData.mechanicalIssues.length === 0) missing.push("Mechanical Issues");
      if (formConfig.q_drivable && !formData.drivable) missing.push("Drivable");
    } else if (currentStepName === "History") {
      if (!formData.mileage.trim()) missing.push("Mileage");
      if (formConfig.q_accidents && !formData.accidents) missing.push("Accidents");
      if (formConfig.q_smoked_in && !formData.smokedIn) missing.push("Smoked In");
      if (formConfig.q_tires_replaced && !formData.tiresReplaced) missing.push("Tires Replaced");
      if (formConfig.q_num_keys && !formData.numKeys) missing.push("Number of Keys");
    } else if (currentStepName === "Finalize") {
      if (!formData.name.trim()) missing.push("Full Name");
      if (!formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 10) missing.push("Phone Number");
      if (!formData.email.trim()) missing.push("Email Address");
      if (!formData.zip.trim()) missing.push("ZIP Code");
      if (!formData.loanStatus) missing.push("Sell or Trade-In");
    }

    // In offer-first mode, the last step is History — no contact validation needed

    if (missing.length > 0) {
      toast({
        title: "Please complete all fields",
        description: `Missing: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (displaySteps[step] === "Vehicle Info") {
      const success = await lookupBlackBook();
      if (!success) return;
    }

    if (step < totalSteps - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    if (honeypot) return;
    submittedRef.current = true;

    const lastSubmit = localStorage.getItem("lastSubmissionTime");
    if (lastSubmit && Date.now() - parseInt(lastSubmit) < 120000) {
      toast({ title: "Please wait", description: "You recently submitted. Please wait a couple of minutes.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const generatedToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Fetch active pricing model (checks pricing_models first, falls back to offer_settings)
      let offerSettingsData: OfferSettings | null = null;
      let offerRulesData: OfferRule[] = [];
      try {
        const { resolveEffectiveSettings } = await import("@/lib/resolvePricingModel");
        const resolved = await resolveEffectiveSettings(tenant.dealership_id);
        offerSettingsData = resolved.settings;
        offerRulesData = resolved.rules;
      } catch { /* use defaults */ }

      // Calculate offer estimate
      const estimate = calculateOffer(bbSelectedVehicle, formData, selectedAddDeducts, offerSettingsData, offerRulesData);

      // Resolve store assignment based on admin config
      const storeLocationId = formData.preferredLocationId
        ? formData.preferredLocationId
        : await resolveStoreAssignment(
            config as any,
            vehicleInfo?.make || "",
            formData.zip || "",
          );

      const { error } = await supabase
        .from("submissions")
        .insert({
          token: generatedToken,
          plate: formData.plate || null,
          state: formData.state || null,
          vin: formData.vin || null,
          mileage: formData.mileage || null,
          vehicle_year: vehicleInfo?.year || null,
          vehicle_make: vehicleInfo?.make || null,
          vehicle_model: vehicleInfo?.model || null,
          exterior_color: formData.exteriorColor || null,
          drivetrain: formData.drivetrain || null,
          modifications: formData.modifications || null,
          overall_condition: formData.overallCondition || null,
          exterior_damage: formData.exteriorDamage,
          windshield_damage: formData.windshieldDamage || null,
          moonroof: formData.moonroof || null,
          interior_damage: formData.interiorDamage,
          tech_issues: formData.techIssues,
          engine_issues: formData.engineIssues,
          mechanical_issues: formData.mechanicalIssues,
          drivable: formData.drivable || null,
          accidents: formData.accidents || null,
          smoked_in: formData.smokedIn || null,
          tires_replaced: formData.tiresReplaced || null,
          num_keys: formData.numKeys || null,
          name: formData.name || null,
          phone: formData.phone || null,
          email: formData.email || null,
          zip: formData.zip || null,
          loan_status: formData.loanStatus || null,
          loan_company: formData.loanCompany || null,
          loan_balance: formData.loanBalance || null,
          loan_payment: formData.loanPayment || null,
          next_step: "photos",
          lead_source: leadSource,
          dealership_id: tenant.dealership_id,
          bb_tradein_avg: bbSelectedVehicle?.tradein?.avg || null,
          bb_wholesale_avg: bbSelectedVehicle?.wholesale?.avg || null,
          estimated_offer_low: estimate?.low || null,
          estimated_offer_high: estimate?.high || null,
          is_hot_lead: estimate?.isHotLead || false,
          matched_rule_ids: estimate?.matchedRuleIds?.length ? estimate.matchedRuleIds : null,
          store_location_id: storeLocationId || null,
          salesperson_name: formData.salespersonName || null,
          // New BB data fields
          bb_msrp: bbSelectedVehicle?.msrp || null,
          bb_class_name: bbSelectedVehicle?.class_name || null,
          bb_drivetrain: bbSelectedVehicle?.drivetrain || null,
          bb_transmission: bbSelectedVehicle?.transmission || null,
          bb_fuel_type: bbSelectedVehicle?.fuel_type || null,
          bb_engine: bbSelectedVehicle?.engine || null,
          bb_mileage_adj: bbSelectedVehicle?.mileage_adj || null,
          bb_regional_adj: bbSelectedVehicle?.regional_adj || null,
          bb_base_whole_avg: bbSelectedVehicle?.base_whole_avg || null,
          bb_retail_avg: bbSelectedVehicle?.retail?.avg || null,
          bb_value_tiers: bbSelectedVehicle ? JSON.stringify({
            wholesale: bbSelectedVehicle.wholesale,
            tradein: bbSelectedVehicle.tradein,
            retail: bbSelectedVehicle.retail,
          }) : null,
          bb_add_deducts: bbSelectedVehicle?.add_deduct_list ? JSON.stringify(bbSelectedVehicle.add_deduct_list) : null,
          bb_selected_options: selectedAddDeducts.length > 0 ? selectedAddDeducts : [],
        } as any);

      if (error) throw error;

      // Clean up any partial submission we saved earlier
      if (partialIdRef.current) {
        supabase.from("submissions").delete().eq("id", partialIdRef.current).then(() => {});
        partialIdRef.current = null;
      }

      // Fire new_submission staff notification
      const { data: insertedSub } = await supabase
        .from("submissions")
        .select("id, is_hot_lead")
        .eq("token", generatedToken)
        .maybeSingle();

      if (insertedSub) {
        supabase.functions.invoke("send-notification", {
          body: { trigger_key: "new_submission", submission_id: insertedSub.id },
        }).catch(console.error);

        // If hot lead, fire hot_lead notification too
        if (insertedSub.is_hot_lead) {
          supabase.functions.invoke("send-notification", {
            body: { trigger_key: "hot_lead", submission_id: insertedSub.id },
          }).catch(console.error);
        }
      }

      localStorage.setItem("lastSubmissionTime", Date.now().toString());

      logConsent({
        customerName: formData.name,
        customerPhone: formData.phone,
        customerEmail: formData.email,
        formSource: "sell_form",
        submissionToken: generatedToken,
        dealershipName: config.dealership_name,
      });

      // Show calculating animation if enabled, otherwise navigate directly
      if (config.use_animated_calculating) {
        setPendingToken(generatedToken);
        setShowCalculating(true);
      } else {
        navigate(`/offer/${generatedToken}`);
      }
    } catch (err) {
      toast({ title: "Submission failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleCalculatingComplete = useCallback(() => {
    if (pendingToken) {
      navigate(`/offer/${pendingToken}`);
    }
  }, [pendingToken, navigate]);

  const currentStepName = displaySteps[step];

  const renderStep = () => {
    switch (currentStepName) {
      case "Vehicle Info":
        return <StepVehicleInfo formData={formData} update={update} vehicleInfo={vehicleInfo} setVehicleInfo={setVehicleInfo} bbSelectedVehicle={bbSelectedVehicle} />;
      case "Select Your Vehicle":
        return <StepSelectTrim vehicles={bbVehicles} selectedUvc={formData.bbUvc} onSelect={(uvc) => { handleTrimSelect(uvc); }} />;
      case "Vehicle Build":
        return (
          <StepVehicleBuild
            formData={formData}
            update={update}
            vehicleInfo={vehicleInfo}
            bbVehicle={bbSelectedVehicle}
            selectedAddDeducts={selectedAddDeducts}
            onToggleAddDeduct={toggleAddDeduct}
            formConfig={formConfig}
          />
        );
      case "Condition":
        return <StepCondition formData={formData} updateArray={updateArray} update={update} formConfig={formConfig} bbVehicle={bbSelectedVehicle} vehicleInfo={vehicleInfo} />;
      case "History":
        return <StepHistory formData={formData} update={update} formConfig={formConfig} bbVehicle={bbSelectedVehicle} vehicleInfo={vehicleInfo} />;
      case "Finalize":
        return <StepFinalize formData={formData} update={update} formConfig={formConfig} leadSource={leadSource} />;
      default:
        return null;
    }
  };

  if (showCalculating) {
    return (
      <div className="fixed inset-0 z-50">
        <CalculatingOffer
          vehicleYear={vehicleInfo?.year}
          vehicleMake={vehicleInfo?.make}
          vehicleModel={vehicleInfo?.model}
          onComplete={handleCalculatingComplete}
        />
      </div>
    );
  }

  return (
    <div ref={formRef} className={`bg-card rounded-2xl shadow-xl p-6 md:p-8 relative z-10 ${variant === "split" ? "w-full" : "mx-auto -mt-10 mb-10 max-w-lg w-[calc(100%-40px)]"}`}>
      {/* Progress */}
      <div className="mb-6 pb-5 border-b-2 border-muted">
        <div className="flex justify-center items-center gap-3 mb-3">
          {displaySteps.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i < step ? "bg-success" : i === step ? "bg-accent scale-125" : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground font-medium">
          Step {step + 1} of {totalSteps}: <strong className="text-card-foreground font-bold">{currentStepName}</strong>
          <span className="text-xs opacity-70 ml-1.5">· ~{stepTimeEstimates[currentStepName] || "30 sec"}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
          tabIndex={-1}
          autoComplete="off"
          aria-label="Website"
        />
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="flex-1 py-4 text-base font-bold border-[hsl(var(--cta-offer))] text-[hsl(var(--cta-offer))] hover:bg-[hsl(var(--cta-offer))]/10"
            >
              Back
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={bbLoading}
              className="flex-1 py-4 text-white text-[17px] font-bold shadow-lg hover:-translate-y-0.5 transition-all"
              style={{ backgroundColor: "hsl(var(--cta-offer))", boxShadow: "0 10px 15px -3px hsl(var(--cta-offer) / 0.3)" }}
            >
              {bbLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Looking up vehicle…
                </span>
              ) : (
                "Continue"
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 text-white text-[17px] font-bold shadow-lg hover:-translate-y-0.5 transition-all"
              style={{ backgroundColor: "hsl(var(--cta-offer))", boxShadow: "0 10px 15px -3px hsl(var(--cta-offer) / 0.3)" }}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Calculating your offer…
                </span>
              ) : (
                offerFirst ? "See My Offer →" : "Get My Offer →"
              )}
            </Button>
          )}
        </div>
      </form>

      <p className="text-center mt-4 text-[13px] text-muted-foreground">
        {offerFirst
          ? "🔒 No contact info needed — see your offer instantly."
          : "🔒 Your information is 100% secure and never shared."}
      </p>

      <div className="bg-gradient-to-br from-success to-[hsl(160,84%,30%)] text-success-foreground p-5 rounded-xl mt-6 text-center shadow-lg shadow-success/30">
        <Shield className="w-8 h-8 mx-auto mb-2" />
        <h2 className="text-lg font-extrabold tracking-wide mb-2">8-DAY PRICE GUARANTEE</h2>
        <p className="text-sm leading-relaxed opacity-95">Your offer is good for 8 days. No games. No surprises.</p>
      </div>
    </div>
  );
};

export default SellCarForm;
