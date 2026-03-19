import { useState, useRef, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logConsent } from "@/lib/consent";
import { calculateOffer, type OfferEstimate } from "@/lib/offerCalculator";
import { STEPS, initialFormData } from "./sell-form/types";
import type { FormData, VehicleInfo, BBVehicle } from "./sell-form/types";
import StepVehicleInfo from "./sell-form/StepVehicleInfo";
import StepVehicleBuild from "./sell-form/StepVehicleBuild";
import StepSelectTrim from "./sell-form/StepSelectTrim";
import StepConditionHistory from "./sell-form/StepConditionHistory";
import StepYourDetails from "./sell-form/StepYourDetails";
import StepGetOffer from "./sell-form/StepGetOffer";
import SubmissionSuccess from "./sell-form/SubmissionSuccess";
import { motion, AnimatePresence } from "framer-motion";

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

const SellCarForm = () => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [offerEstimate, setOfferEstimate] = useState<OfferEstimate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Black Book state
  const [bbVehicles, setBbVehicles] = useState<BBVehicle[]>([]);
  const [bbSelectedVehicle, setBbSelectedVehicle] = useState<BBVehicle | null>(null);
  const [bbLoading, setBbLoading] = useState(false);
  const [selectedAddDeducts, setSelectedAddDeducts] = useState<string[]>([]);
  // Whether we need a trim selection step (plate path with multiple results)
  const [showTrimStep, setShowTrimStep] = useState(false);

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

  // Determine actual displayed steps based on whether trim selection is needed
  const getDisplaySteps = () => {
    if (showTrimStep) {
      return ["Vehicle Info", "Select Your Vehicle", "Vehicle Build", "Condition & History", "Your Details", "Get Your Offer"];
    }
    return STEPS;
  };

  const displaySteps = getDisplaySteps();
  const totalSteps = displaySteps.length;

  const lookupBlackBook = async (): Promise<boolean> => {
    const isPlate = formData.plate.trim().length > 0;
    const isVin = formData.vin.trim().length >= 9;
    if (!isPlate && !isVin) return true; // No lookup needed

    setBbLoading(true);
    try {
      const mileageNum = parseInt(formData.mileage.replace(/[^0-9]/g, ""));
      const body: Record<string, unknown> = {
        lookup_type: isVin ? "vin" : "plate",
        mileage: mileageNum || undefined,
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
        // Fall back — don't block the user
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

      // Auto-select add/deducts that are pre-matched (auto = Y, M, or D)
      const autoSelected = vehicles[0].add_deduct_list
        .filter((ad) => ad.auto !== "N")
        .map((ad) => ad.uoc);
      setSelectedAddDeducts(autoSelected);

      if (vehicles.length === 1) {
        // Single match — go straight to vehicle build
        const v = vehicles[0];
        setBbSelectedVehicle(v);
        setVehicleInfo({ year: v.year, make: v.make, model: v.model });
        setFormData((prev) => ({ ...prev, bbUvc: v.uvc }));
        setShowTrimStep(false);
      } else {
        // Multiple matches — need trim selection step
        setShowTrimStep(true);
      }

      setBbLoading(false);
      return true;
    } catch (err) {
      console.error("BB lookup error:", err);
      setBbLoading(false);
      return true; // Don't block
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
      if (!formData.mileage.trim()) missing.push("Mileage");
    } else if (currentStepName === "Select Your Vehicle") {
      if (!formData.bbUvc) missing.push("Please select your vehicle");
    } else if (currentStepName === "Vehicle Build") {
      if (!formData.exteriorColor.trim()) missing.push("Exterior Color");
      if (!formData.drivetrain) missing.push("Drivetrain");
      if (!formData.modifications) missing.push("Modifications");
    } else if (currentStepName === "Condition & History") {
      if (!formData.overallCondition) missing.push("Overall Condition");
      if (formData.exteriorDamage.length === 0) missing.push("Exterior Damage");
      if (!formData.windshieldDamage) missing.push("Windshield Damage");
      if (!formData.moonroof) missing.push("Moonroof");
      if (formData.interiorDamage.length === 0) missing.push("Interior Damage");
      if (formData.techIssues.length === 0) missing.push("Technology Issues");
      if (formData.engineIssues.length === 0) missing.push("Engine Issues");
      if (formData.mechanicalIssues.length === 0) missing.push("Mechanical Issues");
      if (!formData.drivable) missing.push("Drivable");
      if (!formData.accidents) missing.push("Accidents");
      if (!formData.smokedIn) missing.push("Smoked In");
      if (!formData.tiresReplaced) missing.push("Tires Replaced");
      if (!formData.numKeys) missing.push("Number of Keys");
    } else if (currentStepName === "Your Details") {
      if (!formData.name.trim()) missing.push("Full Name");
      if (!formData.phone.trim()) missing.push("Phone Number");
      if (!formData.email.trim()) missing.push("Email Address");
      if (!formData.zip.trim()) missing.push("ZIP Code");
      if (!formData.loanStatus) missing.push("Sell or Trade-In");
    } else if (currentStepName === "Get Your Offer") {
      if (!formData.nextStep) missing.push("Next Step");
    }

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

    // On step 0 (Vehicle Info), trigger BB lookup
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

      // Calculate offer estimate from BB data + condition
      const estimate = calculateOffer(bbSelectedVehicle, formData, selectedAddDeducts);
      setOfferEstimate(estimate);

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
          next_step: formData.nextStep || null,
          lead_source: "inventory",
          bb_tradein_avg: bbSelectedVehicle?.tradein?.avg || null,
          bb_wholesale_avg: bbSelectedVehicle?.wholesale?.avg || null,
          estimated_offer_low: estimate?.low || null,
          estimated_offer_high: estimate?.high || null,
        } as any);

      if (error) throw error;

      const baseUrl = window.location.origin;
      setUploadUrl(`${baseUrl}/upload/${generatedToken}`);
      localStorage.setItem("lastSubmissionTime", Date.now().toString());

      logConsent({
        customerName: formData.name,
        customerPhone: formData.phone,
        customerEmail: formData.email,
        formSource: "sell_form",
        submissionToken: generatedToken,
      });

      setSubmitted(true);
    } catch (err) {
      toast({ title: "Submission failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="bg-card rounded-2xl shadow-xl mx-auto -mt-10 mb-10 p-6 md:p-8 relative z-10 max-w-lg w-[calc(100%-40px)]">
        <SubmissionSuccess
          uploadUrl={uploadUrl}
          vehicleInfo={vehicleInfo}
          nextStep={formData.nextStep}
        />
      </div>
    );
  }

  const currentStepName = displaySteps[step];

  const renderStep = () => {
    switch (currentStepName) {
      case "Vehicle Info":
        return <StepVehicleInfo formData={formData} update={update} vehicleInfo={vehicleInfo} setVehicleInfo={setVehicleInfo} />;
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
          />
        );
      case "Condition & History":
        return <StepConditionHistory formData={formData} updateArray={updateArray} update={update} />;
      case "Your Details":
        return <StepYourDetails formData={formData} update={update} />;
      case "Get Your Offer":
        return <StepGetOffer formData={formData} update={update} vehicleInfo={vehicleInfo} />;
      default:
        return null;
    }
  };

  return (
    <div ref={formRef} className="bg-card rounded-2xl shadow-xl mx-auto -mt-10 mb-10 p-6 md:p-8 relative z-10 max-w-lg w-[calc(100%-40px)]">
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
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1 py-4 text-base font-bold">
              Back
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={bbLoading}
              className="flex-1 py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30 hover:-translate-y-0.5 transition-all"
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
              className="flex-1 py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30 hover:-translate-y-0.5 transition-all"
            >
              {submitting ? "Submitting..." : "Get My Cash Offer →"}
            </Button>
          )}
        </div>
      </form>

      <p className="text-center mt-4 text-[13px] text-muted-foreground">
        🔒 Your information is 100% secure and never shared.
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
