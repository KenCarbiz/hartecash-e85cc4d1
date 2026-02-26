import FormField from "./FormField";
import RadioOption from "./RadioOption";
import type { FormData, VehicleInfo } from "./types";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
  vehicleInfo?: VehicleInfo | null;
}

const COLOR_OPTIONS = [
  { label: "Black", hex: "#1a1a1a" },
  { label: "White", hex: "#f5f5f5" },
  { label: "Silver", hex: "#c0c0c0" },
  { label: "Gray", hex: "#808080" },
  { label: "Red", hex: "#cc2936" },
  { label: "Blue", hex: "#1e3a8a" },
  { label: "Brown", hex: "#6b3a2a" },
  { label: "Green", hex: "#2d6a4f" },
  { label: "Gold", hex: "#b8860b" },
  { label: "Orange", hex: "#e36414" },
  { label: "Beige", hex: "#d4c5a9" },
  { label: "Other", hex: "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)" },
];

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
      <div className="grid grid-cols-3 gap-2">
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color.label}
            type="button"
            onClick={() => update("exteriorColor", color.label)}
            className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 transition-all text-left text-sm font-medium ${
              formData.exteriorColor === color.label
                ? "border-accent bg-accent/10 text-card-foreground shadow-sm"
                : "border-input bg-card text-muted-foreground hover:border-accent/50"
            }`}
          >
            <span
              className="w-5 h-5 rounded-full shrink-0 border border-border"
              style={{
                background: color.label === "Other" ? color.hex : color.hex,
              }}
            />
            <span className="truncate">{color.label}</span>
          </button>
        ))}
      </div>
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
