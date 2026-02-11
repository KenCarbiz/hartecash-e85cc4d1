import { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STEPS, initialFormData } from "./sell-form/types";
import type { FormData, VehicleInfo } from "./sell-form/types";
import StepVehicleInfo from "./sell-form/StepVehicleInfo";
import StepVehicleBuild from "./sell-form/StepVehicleBuild";
import StepConditionHistory from "./sell-form/StepConditionHistory";
import StepYourDetails from "./sell-form/StepYourDetails";
import StepGetOffer from "./sell-form/StepGetOffer";

const SellCarForm = () => {
  const [step, setStep] = useState(0);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

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

  const handleNext = () => { if (step < STEPS.length - 1) setStep(step + 1); };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nextStep === "photos") {
      alert("Thank you! We'll send you a link to upload your vehicle photos shortly.");
    } else if (formData.nextStep === "visit") {
      alert("Thank you! We'll contact you to schedule your in-person visit.");
    } else {
      alert("Thank you! We'll reach out with your cash offer shortly.");
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-xl mx-auto -mt-10 mb-10 p-6 md:p-8 relative z-10 max-w-lg w-[calc(100%-40px)]">
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
              className="flex-1 py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30 hover:-translate-y-0.5 transition-all"
            >
              Get My Cash Offer →
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
