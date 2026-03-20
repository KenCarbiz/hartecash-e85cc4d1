import { Input } from "@/components/ui/input";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import type { FormData } from "./types";
import type { FormConfig } from "@/hooks/useFormConfig";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
  formConfig?: FormConfig;
}

const StepHistory = ({ formData, update, formConfig }: Props) => {
  return (
    <>
      <FormField label="How many total miles are on your vehicle?">
        <Input
          placeholder="e.g. 45,000"
          value={formData.mileage}
          onChange={(e) => update("mileage", e.target.value)}
          className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
        />
      </FormField>

      {(!formConfig || formConfig.q_accidents) && (
        <FormField label="Has your vehicle been in an accident?">
          <div className="grid gap-2">
            {["No accidents", "1 accident", "2+ accidents"].map((opt) => (
              <RadioOption key={opt} label={opt} selected={formData.accidents === opt} onClick={() => update("accidents", opt)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_smoked_in) && (
        <FormField label="Has your vehicle been smoked in?">
          <div className="grid grid-cols-2 gap-2">
            <RadioOption label="Not smoked in" selected={formData.smokedIn === "No"} onClick={() => update("smokedIn", "No")} />
            <RadioOption label="Smoked in" selected={formData.smokedIn === "Yes"} onClick={() => update("smokedIn", "Yes")} />
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_tires_replaced) && (
        <FormField label="How many tires replaced in the past 12 months?">
          <div className="grid grid-cols-3 gap-2">
            {["None", "1", "2", "3", "4"].map((opt) => (
              <RadioOption key={opt} label={opt === "None" ? "None" : `${opt} tire${opt !== "1" ? "s" : ""}`} selected={formData.tiresReplaced === opt} onClick={() => update("tiresReplaced", opt)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_num_keys) && (
        <FormField label="How many keys do you have?">
          <div className="grid grid-cols-2 gap-2">
            <RadioOption label="1 key" selected={formData.numKeys === "1"} onClick={() => update("numKeys", "1")} />
            <RadioOption label="2+ keys" selected={formData.numKeys === "2+"} onClick={() => update("numKeys", "2+")} />
          </div>
        </FormField>
      )}
    </>
  );
};

export default StepHistory;
