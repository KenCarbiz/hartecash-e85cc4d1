import FormField from "./FormField";
import RadioOption from "./RadioOption";
import CheckboxOption from "./CheckboxOption";
import type { FormData } from "./types";

interface Props {
  formData: FormData;
  updateArray: (field: string, value: string) => void;
  update: (field: string, value: string) => void;
}

const conditionRatings = [
  { value: "excellent", label: "Excellent", desc: "Looks new and is in excellent mechanical condition.", pct: "3%" },
  { value: "very_good", label: "Very Good", desc: "Minor cosmetic defects, good mechanical condition.", pct: "28%" },
  { value: "good", label: "Good", desc: "Has repairable cosmetic defects and mechanical problems.", pct: "50%" },
  { value: "fair", label: "Fair", desc: "Requires some mechanical repairs.", pct: "20%" },
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

const StepConditionHistory = ({ formData, updateArray, update }: Props) => (
  <>
    {/* Overall Condition - CarMax style */}
    <FormField label="What is the overall condition of your vehicle?">
      <div className="grid gap-2">
        {conditionRatings.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => update("overallCondition", r.value)}
            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
              formData.overallCondition === r.value
                ? "border-accent bg-accent/10"
                : "border-input bg-background hover:border-muted-foreground/30"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-sm font-bold ${formData.overallCondition === r.value ? "text-accent" : "text-card-foreground"}`}>
                {r.label}
              </span>
              <span className="text-xs text-muted-foreground">{r.pct} of cars</span>
            </div>
            <span className="text-xs text-muted-foreground mt-0.5 block">{r.desc}</span>
          </button>
        ))}
      </div>
    </FormField>

    <FormField label="Is there any exterior damage?">
      <div className="grid gap-2">
        {exteriorOptions.map((opt) => (
          <CheckboxOption key={opt.value} label={opt.label} checked={formData.exteriorDamage.includes(opt.value)} onClick={() => updateArray("exteriorDamage", opt.value)} />
        ))}
      </div>
    </FormField>

    <FormField label="Is your front windshield damaged?">
      <div className="grid gap-2">
        {["No windshield damage", "Minor chips or pitting", "Major cracks or chips"].map((opt) => (
          <RadioOption key={opt} label={opt} selected={formData.windshieldDamage === opt} onClick={() => update("windshieldDamage", opt)} />
        ))}
      </div>
    </FormField>

    <FormField label="If your vehicle has a moonroof, does it work?">
      <div className="grid gap-2">
        {["Works great", "Doesn't work", "No moonroof"].map((opt) => (
          <RadioOption key={opt} label={opt} selected={formData.moonroof === opt} onClick={() => update("moonroof", opt)} />
        ))}
      </div>
    </FormField>

    <FormField label="Is there any interior damage?">
      <div className="grid gap-2">
        {interiorOptions.map((opt) => (
          <CheckboxOption key={opt.value} label={opt.label} subtitle={opt.subtitle} checked={formData.interiorDamage.includes(opt.value)} onClick={() => updateArray("interiorDamage", opt.value)} />
        ))}
      </div>
    </FormField>

    <FormField label="Are there any technology system issues?">
      <div className="grid gap-2">
        {techOptions.map((opt) => (
          <CheckboxOption key={opt.value} label={opt.label} checked={formData.techIssues.includes(opt.value)} onClick={() => updateArray("techIssues", opt.value)} />
        ))}
      </div>
    </FormField>

    <FormField label="Are there any engine issues?">
      <div className="grid gap-2">
        {engineOptions.map((opt) => (
          <CheckboxOption key={opt.value} label={opt.label} subtitle={opt.subtitle} checked={formData.engineIssues.includes(opt.value)} onClick={() => updateArray("engineIssues", opt.value)} />
        ))}
      </div>
    </FormField>

    <FormField label="Are there any mechanical or electrical issues?">
      <div className="grid gap-2">
        {mechanicalOptions.map((opt) => (
          <CheckboxOption key={opt.value} label={opt.label} subtitle={opt.subtitle} checked={formData.mechanicalIssues.includes(opt.value)} onClick={() => updateArray("mechanicalIssues", opt.value)} />
        ))}
      </div>
    </FormField>

    <FormField label="Can your vehicle be safely driven?">
      <div className="grid grid-cols-2 gap-2">
        <RadioOption label="Drivable" selected={formData.drivable === "Drivable"} onClick={() => update("drivable", "Drivable")} />
        <RadioOption label="Not drivable" selected={formData.drivable === "Not drivable"} onClick={() => update("drivable", "Not drivable")} />
      </div>
    </FormField>

    {/* History section */}
    <div className="border-t-2 border-muted pt-5 mt-5">
      <h3 className="text-base font-bold text-card-foreground mb-4">Vehicle History</h3>
    </div>

    <FormField label="Has your vehicle been in an accident?">
      <div className="grid gap-2">
        {["No accidents", "1 accident", "2+ accidents"].map((opt) => (
          <RadioOption key={opt} label={opt} selected={formData.accidents === opt} onClick={() => update("accidents", opt)} />
        ))}
      </div>
    </FormField>

    <FormField label="Has your vehicle been smoked in?">
      <div className="grid grid-cols-2 gap-2">
        <RadioOption label="Not smoked in" selected={formData.smokedIn === "No"} onClick={() => update("smokedIn", "No")} />
        <RadioOption label="Smoked in" selected={formData.smokedIn === "Yes"} onClick={() => update("smokedIn", "Yes")} />
      </div>
    </FormField>

    <FormField label="How many tires replaced in the past 12 months?">
      <div className="grid grid-cols-3 gap-2">
        {["None", "1", "2", "3", "4"].map((opt) => (
          <RadioOption key={opt} label={opt === "None" ? "None" : `${opt} tire${opt !== "1" ? "s" : ""}`} selected={formData.tiresReplaced === opt} onClick={() => update("tiresReplaced", opt)} />
        ))}
      </div>
    </FormField>

    <FormField label="How many keys do you have?">
      <div className="grid grid-cols-2 gap-2">
        <RadioOption label="1 key" selected={formData.numKeys === "1"} onClick={() => update("numKeys", "1")} />
        <RadioOption label="2+ keys" selected={formData.numKeys === "2+"} onClick={() => update("numKeys", "2+")} />
      </div>
    </FormField>
  </>
);

export default StepConditionHistory;
