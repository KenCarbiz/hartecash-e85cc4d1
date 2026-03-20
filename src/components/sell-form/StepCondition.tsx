import { useState } from "react";
import { Check, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import CheckboxOption from "./CheckboxOption";
import type { FormData } from "./types";
import type { FormConfig } from "@/hooks/useFormConfig";

interface Props {
  formData: FormData;
  updateArray: (field: string, value: string) => void;
  update: (field: string, value: string) => void;
  formConfig?: FormConfig;
}

const conditionRatings = [
  { value: "excellent", label: "Excellent", desc: "(2% of cars KBB values) - Looks new and is in excellent mechanical condition.", pct: "3%" },
  { value: "very_good", label: "Very Good", desc: "(28% of cars KBB values) - Has minor cosmetic defects and is in good mechanical condition.", pct: "28%" },
  { value: "good", label: "Good", desc: "(50% of cars KBB values) - Has repairable cosmetic defects and mechanical problems.", pct: "50%" },
  { value: "fair", label: "Fair", desc: "(20% of cars KBB values) - Requires some mechanical repairs.", pct: "20%" },
];

const exteriorOptions = [
  { value: "scratches", label: "Scuffs, scratches, or chips" },
  { value: "fading", label: "Fading or dull paint" },
  { value: "dents", label: "Dents or scrapes" },
  { value: "rust", label: "Rust" },
  { value: "hail", label: "Hail damage" },
  { value: "none", label: "No exterior damage" },
];

const interiorOptions = [
  { value: "odors", label: "Persistent odors", subtitle: "Pets, smoking, mildew, etc." },
  { value: "dashboard", label: "Damaged dashboard or panels" },
  { value: "stains", label: "Noticeable stains" },
  { value: "rips", label: "Rips or tears in seats" },
  { value: "none", label: "No interior damage" },
];

const techOptions = [
  { value: "sound", label: "Sound system" },
  { value: "display", label: "Interior display" },
  { value: "camera", label: "Backup camera" },
  { value: "sensors", label: "Safety sensors" },
  { value: "none", label: "No technology issues" },
];

const engineOptions = [
  { value: "check_light", label: "Check engine light is on" },
  { value: "noises", label: "Strange noises", subtitle: "Knocking, clicking, pinging" },
  { value: "vibration", label: "Engine vibration / shaking" },
  { value: "smoke", label: "Smoke or steam" },
  { value: "service", label: "Needs service or repair" },
  { value: "none", label: "No engine issues" },
];

const mechanicalOptions = [
  { value: "ac", label: "Air conditioning issues" },
  { value: "electrical", label: "Electrical issues", subtitle: "Airbag light, dim headlights, etc." },
  { value: "tpms", label: "Tire pressure light / TPMS" },
  { value: "transmission", label: "Transmission / drivetrain issues" },
  { value: "none", label: "No mechanical or electrical issues" },
];

const kbbDefinitions = [
  {
    title: "Excellent",
    text: `"Excellent" condition means that the vehicle looks new and is in excellent mechanical condition. This vehicle has never had any paint or bodywork and does not need reconditioning. The engine compartment is clean and free of fluid leaks. This vehicle is free of rust. The body and interior are free of wear or visible defects. The tires all match and are like new. This vehicle has a clean title history and will pass a safety and smog inspection. This vehicle has complete and verifiable service records.`,
  },
  {
    title: "Very Good",
    text: `"Very Good" condition means that the vehicle has minor cosmetic defects and is in excellent mechanical condition. This vehicle has had minor or no paint or bodywork, and requires minimal reconditioning. The engine compartment is clean and free of fluid leaks. This vehicle is free of rust. The body and interior have minimal signs of wear or visible defects. The tires all match and have 75% or more of tread remaining. This vehicle has a clean title history and will pass a safety and smog inspection. Most service records are available.`,
  },
  {
    title: "Good",
    text: `"Good" condition means that the vehicle has some cosmetic repairable defects and is free of major mechanical problems. The paint and bodywork may require minor touch-ups. The engine compartment may have minor leaks. This vehicle has only minor cosmetic or no rust. The body may have minor scratches or dings and the interior has minor blemishes characteristic of normal wear. The tires match and have at least 50% of tread remaining. Though it may need some reconditioning, it has a clean title history and will pass safety and smog inspection. Some service records are available.`,
  },
  {
    title: "Fair",
    text: `"Fair" condition means that the vehicle has some cosmetic defects that require repairing and/or replacing and requires some mechanical repairs. The paint and bodywork may require refinishing and body repair. The engine compartment has leaks and may require a tune up. This vehicle may have some repairable rust damage. The body has dings, chips, or scratches and the interior has substantial wear, and may have small tears. The tires may need replacing. This vehicle needs servicing, but is still in reasonable running condition. Has a clean title history. A few service records are available.`,
  },
];

const StepCondition = ({ formData, updateArray, update, formConfig }: Props) => {
  const [showKbb, setShowKbb] = useState(false);

  return (
    <>
      <Dialog open={showKbb} onOpenChange={setShowKbb}>
        <DialogContent className="max-h-[80vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-6 py-4 rounded-t-lg text-center">
            <DialogTitle className="text-2xl font-bold">Kelley Blue Book® Condition Definitions</DialogTitle>
          </div>
          <div className="px-6 pt-2">
            <div className="space-y-5 mt-2">
              {kbbDefinitions.map((d) => (
                <div key={d.title}>
                  <h4 className="font-bold text-card-foreground mb-1 text-center">{d.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 pb-4">
            <DialogFooter>
              <Button onClick={() => setShowKbb(false)} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
                GOT IT!
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {(!formConfig || formConfig.q_overall_condition) && (
        <FormField label="What is the overall condition of your vehicle?">
          <button
            type="button"
            onClick={() => setShowKbb(true)}
            className="flex items-center gap-1.5 text-xs text-accent hover:underline mb-3 font-medium"
          >
            <Info className="w-3.5 h-3.5" />
            View full Kelley Blue Book® condition definitions
          </button>
          <div className="grid gap-2">
            {conditionRatings.map((r) => {
              const selected = formData.overallCondition === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => update("overallCondition", r.value)}
                  className={`relative w-full text-left px-4 py-3 rounded-lg border-2 transition-all overflow-hidden ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-input bg-background hover:border-muted-foreground/30"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-0 right-0 w-8 h-8">
                      <div className="absolute top-0 right-0 w-0 h-0 border-t-[32px] border-t-accent border-l-[32px] border-l-transparent" />
                      <Check className="absolute top-0.5 right-0.5 w-3.5 h-3.5 text-accent-foreground" strokeWidth={3} />
                    </div>
                  )}
                  <span className={`text-sm font-bold ${selected ? "text-accent" : "text-card-foreground"}`}>
                    {r.label}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5 block">{r.desc}</span>
                </button>
              );
            })}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_exterior_damage) && (
        <FormField label="Is there any exterior damage?">
          <div className="grid gap-2">
            {exteriorOptions.map((opt) => (
              <CheckboxOption key={opt.value} label={opt.label} checked={formData.exteriorDamage.includes(opt.value)} onClick={() => updateArray("exteriorDamage", opt.value)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_windshield_damage) && (
        <FormField label="Is your front windshield damaged?">
          <div className="grid gap-2">
            {["No windshield damage", "Minor chips or pitting", "Major cracks or chips"].map((opt) => (
              <RadioOption key={opt} label={opt} selected={formData.windshieldDamage === opt} onClick={() => update("windshieldDamage", opt)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_moonroof) && (
        <FormField label="If your vehicle has a moonroof, does it work?">
          <div className="grid gap-2">
            {["Works great", "Doesn't work", "No moonroof"].map((opt) => (
              <RadioOption key={opt} label={opt} selected={formData.moonroof === opt} onClick={() => update("moonroof", opt)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_interior_damage) && (
        <FormField label="Is there any interior damage?">
          <div className="grid gap-2">
            {interiorOptions.map((opt) => (
              <CheckboxOption key={opt.value} label={opt.label} subtitle={opt.subtitle} checked={formData.interiorDamage.includes(opt.value)} onClick={() => updateArray("interiorDamage", opt.value)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_tech_issues) && (
        <FormField label="Are there any technology system issues?">
          <div className="grid gap-2">
            {techOptions.map((opt) => (
              <CheckboxOption key={opt.value} label={opt.label} checked={formData.techIssues.includes(opt.value)} onClick={() => updateArray("techIssues", opt.value)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_engine_issues) && (
        <FormField label="Are there any engine issues?">
          <div className="grid gap-2">
            {engineOptions.map((opt) => (
              <CheckboxOption key={opt.value} label={opt.label} subtitle={opt.subtitle} checked={formData.engineIssues.includes(opt.value)} onClick={() => updateArray("engineIssues", opt.value)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_mechanical_issues) && (
        <FormField label="Are there any mechanical or electrical issues?">
          <div className="grid gap-2">
            {mechanicalOptions.map((opt) => (
              <CheckboxOption key={opt.value} label={opt.label} subtitle={opt.subtitle} checked={formData.mechanicalIssues.includes(opt.value)} onClick={() => updateArray("mechanicalIssues", opt.value)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_drivable) && (
        <FormField label="Can your vehicle be safely driven?">
          <div className="grid grid-cols-2 gap-2">
            <RadioOption label="Drivable" selected={formData.drivable === "Drivable"} onClick={() => update("drivable", "Drivable")} />
            <RadioOption label="Not drivable" selected={formData.drivable === "Not drivable"} onClick={() => update("drivable", "Not drivable")} />
          </div>
        </FormField>
      )}
    </>
  );
};

export default StepCondition;
