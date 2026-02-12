import { useState, useRef, useEffect } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { STEPS, initialFormData } from "./sell-form/types";
import type { FormData, VehicleInfo } from "./sell-form/types";
import StepVehicleInfo from "./sell-form/StepVehicleInfo";
import StepVehicleBuild from "./sell-form/StepVehicleBuild";
import StepConditionHistory from "./sell-form/StepConditionHistory";
import StepYourDetails from "./sell-form/StepYourDetails";
import StepGetOffer from "./sell-form/StepGetOffer";
import SubmissionSuccess from "./sell-form/SubmissionSuccess";

const SellCarForm = () => {
  const [step, setStep] = useState(0);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (step > 0) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const validateStep = (): boolean => {
    const missing: string[] = [];

    if (step === 0) {
      if (!formData.vin.trim() && !formData.plate.trim()) missing.push("VIN or License Plate");
      if (formData.plate.trim() && !formData.state.trim()) missing.push("State");
      if (!formData.mileage.trim()) missing.push("Mileage");
    } else if (step === 1) {
      if (!formData.exteriorColor.trim()) missing.push("Exterior Color");
      if (!formData.drivetrain) missing.push("Drivetrain");
      if (!formData.modifications) missing.push("Modifications");
    } else if (step === 2) {
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
    } else if (step === 3) {
      if (!formData.name.trim()) missing.push("Full Name");
      if (!formData.phone.trim()) missing.push("Phone Number");
      if (!formData.email.trim()) missing.push("Email Address");
      if (!formData.zip.trim()) missing.push("ZIP Code");
      if (!formData.loanStatus) missing.push("Sell or Trade-In");
    } else if (step === 4) {
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

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    // Honeypot check
    if (honeypot) return;
    // Cooldown check
    const lastSubmit = localStorage.getItem("lastSubmissionTime");
    if (lastSubmit && Date.now() - parseInt(lastSubmit) < 120000) {
      toast({ title: "Please wait", description: "You recently submitted. Please wait a couple of minutes.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("submissions")
        .insert({
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
        })
        .select("token")
        .single();

      if (error) throw error;

      const baseUrl = window.location.origin;
      setUploadUrl(`${baseUrl}/upload/${data.token}`);
      localStorage.setItem("lastSubmissionTime", Date.now().toString());
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

  return (
    <div ref={formRef} className="bg-card rounded-2xl shadow-xl mx-auto -mt-10 mb-10 p-6 md:p-8 relative z-10 max-w-lg w-[calc(100%-40px)]">
      {/* Progress */}
      <div className="mb-6 pb-5 border-b-2 border-muted">
        <div className="flex justify-center items-center gap-3 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i < step ? "bg-success" : i === step ? "bg-accent scale-125" : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground font-medium">
          Step {step + 1} of {STEPS.length}: <strong className="text-card-foreground font-bold">{STEPS[step]}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Honeypot field - hidden from real users */}
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
        {step === 0 && <StepVehicleInfo formData={formData} update={update} vehicleInfo={vehicleInfo} setVehicleInfo={setVehicleInfo} />}
        {step === 1 && <StepVehicleBuild formData={formData} update={update} />}
        {step === 2 && <StepConditionHistory formData={formData} updateArray={updateArray} update={update} />}
        {step === 3 && <StepYourDetails formData={formData} update={update} />}
        {step === 4 && <StepGetOffer formData={formData} update={update} vehicleInfo={vehicleInfo} />}

        <div className="flex gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1 py-4 text-base font-bold">
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="flex-1 py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30 hover:-translate-y-0.5 transition-all"
            >
              Continue
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
        <h4 className="text-lg font-extrabold tracking-wide mb-2">8-DAY PRICE GUARANTEE</h4>
        <p className="text-sm leading-relaxed opacity-95">Your offer is good for 8 days. No games. No surprises.</p>
      </div>
    </div>
  );
};

export default SellCarForm;
