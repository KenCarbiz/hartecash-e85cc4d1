import FormField from "./FormField";
import RadioOption from "./RadioOption";
import type { FormData } from "./types";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
}

const StepVehicleHistory = ({ formData, update }: Props) => (
  <>
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

    <FormField label="How many keys do you have for this vehicle?">
      <div className="grid grid-cols-2 gap-2">
        <RadioOption label="1 key" selected={formData.numKeys === "1"} onClick={() => update("numKeys", "1")} />
        <RadioOption label="2+ keys" selected={formData.numKeys === "2+"} onClick={() => update("numKeys", "2+")} />
      </div>
    </FormField>
  </>
);

export default StepVehicleHistory;
