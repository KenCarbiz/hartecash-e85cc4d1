import FormField from "./FormField";
import RadioOption from "./RadioOption";
import CheckboxOption from "./CheckboxOption";
import type { FormData } from "./types";

interface Props {
  formData: FormData;
  updateArray: (field: string, value: string) => void;
  update: (field: string, value: string) => void;
}

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
  { value: "missing", label: "Missing equipment" },
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

const conditionRatings = [
  { value: "like_new", label: "Like new", subtitle: "Looks new inside and out. Excellent mechanical condition." },
  { value: "pretty_great", label: "Pretty great", subtitle: "Well-maintained with minor signs of use." },
  { value: "just_okay", label: "Just okay", subtitle: "Normal wear for its age. No major issues." },
  { value: "kind_of_rough", label: "Kind of rough", subtitle: "More than normal wear, but no major issues." },
  { value: "major_issues", label: "Major issues", subtitle: "Significant repairs are required." },
];

const StepVehicleCondition = ({ formData, updateArray, update }: Props) => (
  <>
    <FormField label="Is there any exterior damage?">
      <div className="grid gap-2">
        {exteriorOptions.map((opt) => (
          <CheckboxOption
            key={opt.value}
            label={opt.label}
            checked={formData.exteriorDamage.includes(opt.value)}
            onClick={() => updateArray("exteriorDamage", opt.value)}
          />
        ))}
      </div>
    </FormField>

    <FormField label="Is your front windshield damaged?">
      <div className="grid gap-2">
        {["No windshield damage", "Minor chips or pitting", "Major cracks or chips"].map((opt) => (
          <RadioOption
            key={opt}
            label={opt}
            selected={formData.windshieldDamage === opt}
            onClick={() => update("windshieldDamage", opt)}
          />
        ))}
      </div>
    </FormField>

    <FormField label="If your vehicle has a moonroof, does it work?">
      <div className="grid gap-2">
        {["Works great", "Doesn't work", "No moonroof"].map((opt) => (
          <RadioOption
            key={opt}
            label={opt}
            selected={formData.moonroof === opt}
            onClick={() => update("moonroof", opt)}
          />
        ))}
      </div>
    </FormField>

    <FormField label="Is there any interior damage?">
      <div className="grid gap-2">
        {interiorOptions.map((opt) => (
          <CheckboxOption
            key={opt.value}
            label={opt.label}
            subtitle={opt.subtitle}
            checked={formData.interiorDamage.includes(opt.value)}
            onClick={() => updateArray("interiorDamage", opt.value)}
          />
        ))}
      </div>
    </FormField>

    <FormField label="Are there any technology system issues?">
      <div className="grid gap-2">
        {techOptions.map((opt) => (
          <CheckboxOption
            key={opt.value}
            label={opt.label}
            checked={formData.techIssues.includes(opt.value)}
            onClick={() => updateArray("techIssues", opt.value)}
          />
        ))}
      </div>
    </FormField>

    <FormField label="Are there any engine issues?">
      <div className="grid gap-2">
        {engineOptions.map((opt) => (
          <CheckboxOption
            key={opt.value}
            label={opt.label}
            subtitle={opt.subtitle}
            checked={formData.engineIssues.includes(opt.value)}
            onClick={() => updateArray("engineIssues", opt.value)}
          />
        ))}
      </div>
    </FormField>

    <FormField label="Are there any mechanical or electrical issues?">
      <div className="grid gap-2">
        {mechanicalOptions.map((opt) => (
          <CheckboxOption
            key={opt.value}
            label={opt.label}
            subtitle={opt.subtitle}
            checked={formData.mechanicalIssues.includes(opt.value)}
            onClick={() => updateArray("mechanicalIssues", opt.value)}
          />
        ))}
      </div>
    </FormField>

    <FormField label="Can your vehicle be safely driven?">
      <div className="grid grid-cols-2 gap-2">
        <RadioOption label="Drivable" selected={formData.drivable === "Drivable"} onClick={() => update("drivable", "Drivable")} />
        <RadioOption label="Not drivable" selected={formData.drivable === "Not drivable"} onClick={() => update("drivable", "Not drivable")} />
      </div>
    </FormField>

    <FormField label="What best describes your vehicle's overall condition?">
      <div className="grid gap-2">
        {conditionRatings.map((opt) => (
          <RadioOption
            key={opt.value}
            label={`${opt.label} — ${opt.subtitle}`}
            selected={formData.overallCondition === opt.value}
            onClick={() => update("overallCondition", opt.value)}
          />
        ))}
      </div>
    </FormField>
  </>
);

export default StepVehicleCondition;
