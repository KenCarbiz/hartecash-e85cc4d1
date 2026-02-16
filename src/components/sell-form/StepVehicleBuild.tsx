import { Input } from "@/components/ui/input";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import type { FormData, VehicleInfo } from "./types";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
  vehicleInfo?: VehicleInfo | null;
}

const StepVehicleBuild = ({ formData, update, vehicleInfo }: Props) => (
  <>
    {vehicleInfo && (
      <div className="mb-5 p-4 bg-primary/10 border border-primary/30 rounded-lg text-center">
        <p className="text-lg font-bold text-card-foreground">
          {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
        </p>
      </div>
    )}
    <FormField label="What color is your vehicle?">
      <Input
        placeholder="e.g. Black, White, Silver"
        value={formData.exteriorColor}
        onChange={(e) => update("exteriorColor", e.target.value)}
        className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
      />
    </FormField>

    <FormField label="What is your vehicle's drivetrain?">
      <div className="grid grid-cols-2 gap-2">
        {["FWD", "RWD", "AWD", "4WD"].map((opt) => (
          <RadioOption
            key={opt}
            label={opt}
            selected={formData.drivetrain === opt}
            onClick={() => update("drivetrain", opt)}
          />
        ))}
      </div>
    </FormField>

    <FormField label="Does your vehicle have any modifications?">
      <div className="grid grid-cols-2 gap-2">
        <RadioOption
          label="No modifications"
          selected={formData.modifications === "none"}
          onClick={() => update("modifications", "none")}
        />
        <RadioOption
          label="Has modifications"
          selected={formData.modifications === "yes"}
          onClick={() => update("modifications", "yes")}
        />
      </div>
    </FormField>
  </>
);

export default StepVehicleBuild;
