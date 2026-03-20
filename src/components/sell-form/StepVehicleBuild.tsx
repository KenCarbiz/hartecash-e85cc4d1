import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import CheckboxOption from "./CheckboxOption";
import type { FormData, VehicleInfo, BBVehicle } from "./types";
import type { FormConfig } from "@/hooks/useFormConfig";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
  vehicleInfo?: VehicleInfo | null;
  bbVehicle?: BBVehicle | null;
  selectedAddDeducts: string[];
  onToggleAddDeduct: (uoc: string) => void;
  formConfig?: FormConfig;
}

const COLOR_OPTIONS = [
  { label: "White", hex: "#f5f5f5" },
  { label: "Gray", hex: "#808080" },
  { label: "Silver", hex: "#c0c0c0" },
  { label: "Black", hex: "#1a1a1a" },
  { label: "Blue", hex: "#1e3a8a" },
  { label: "Red", hex: "#cc2936" },
  { label: "Green", hex: "#2d6a4f" },
  { label: "Brown", hex: "#6b3a2a" },
  { label: "Gold", hex: "#b8860b" },
  { label: "Orange", hex: "#e36414" },
  { label: "Beige", hex: "#d4c5a9" },
  { label: "Other", hex: "none" },
];

const ColorDropdown = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = COLOR_OPTIONS.find((c) => c.label === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border-2 text-base transition-all bg-card ${
          open ? "border-accent ring-2 ring-accent/10" : "border-input"
        }`}
      >
        <span className="flex items-center gap-3">
          {selected ? (
            <>
              <span
                className={`w-5 h-5 rounded-full shrink-0 ${selected.hex === "none" ? "border-2 border-dashed border-muted-foreground" : "border border-border"}`}
                style={selected.hex !== "none" ? { background: selected.hex } : undefined}
              />
              <span className="text-card-foreground font-medium">{selected.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Exterior color</span>
          )}
        </span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color.label}
              type="button"
              onClick={() => { onChange(color.label); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] transition-colors hover:bg-accent/5 ${
                value === color.label ? "bg-accent/10 font-semibold text-card-foreground" : "text-card-foreground"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full shrink-0 ${color.hex === "none" ? "border-2 border-dashed border-muted-foreground" : "border border-border"}`}
                style={color.hex !== "none" ? { background: color.hex } : undefined}
              />
              {color.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const StepVehicleBuild = ({ formData, update, vehicleInfo, bbVehicle, selectedAddDeducts, onToggleAddDeduct, formConfig }: Props) => {
  // Derive drivetrain from BB data if available (from price_includes or style)
  const bbDrivetrain = bbVehicle
    ? (() => {
        const style = (bbVehicle.style || "").toUpperCase();
        const includes = (bbVehicle.price_includes || "").toUpperCase();
        if (style.includes("4WD") || includes.includes("4WD")) return "4WD";
        if (style.includes("AWD") || includes.includes("AWD")) return "AWD";
        if (style.includes("RWD") || includes.includes("RWD")) return "RWD";
        return "FWD";
      })()
    : null;

  // Auto-set drivetrain from BB on first render if not yet set
  useEffect(() => {
    if (bbDrivetrain && !formData.drivetrain) {
      update("drivetrain", bbDrivetrain);
    }
  }, [bbDrivetrain]);

  const displayInfo = bbVehicle
    ? { year: bbVehicle.year, make: bbVehicle.make, model: bbVehicle.model, series: bbVehicle.series, style: bbVehicle.style }
    : vehicleInfo;

  // Filter add/deducts: only show non-auto-selected ones for user choice
  const userAddDeducts = bbVehicle?.add_deduct_list?.filter((ad) => ad.auto === "N") || [];
  const autoAddDeducts = bbVehicle?.add_deduct_list?.filter((ad) => ad.auto !== "N") || [];

  return (
    <>
      {displayInfo && (
        <div className="mb-5 p-4 bg-primary/10 border border-primary/30 rounded-lg text-center">
          <p className="text-lg font-bold text-card-foreground">
            {displayInfo.year} {displayInfo.make} {displayInfo.model}
          </p>
          {bbVehicle && (bbVehicle.series || bbVehicle.style) && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {[bbVehicle.series, bbVehicle.style].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>
      )}

      <FormField label="What color is your vehicle?">
        <ColorDropdown value={formData.exteriorColor} onChange={(v) => update("exteriorColor", v)} />
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
        {bbDrivetrain && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Auto-detected: <strong>{bbDrivetrain}</strong> — change if incorrect
          </p>
        )}
      </FormField>

      {/* Auto-applied equipment from VIN */}
      {autoAddDeducts.length > 0 && (
        <FormField label="Included equipment (from VIN)">
          <div className="grid gap-1.5">
            {autoAddDeducts.map((ad) => (
              <div key={ad.uoc} className="px-3 py-2 bg-success/10 border border-success/20 rounded-lg text-sm text-card-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                {ad.name}
              </div>
            ))}
          </div>
        </FormField>
      )}

      {/* Optional equipment for user to select */}
      {userAddDeducts.length > 0 && (
        <FormField label="Does your vehicle have any of these options?">
          <div className="grid gap-2">
            {userAddDeducts.map((ad) => (
              <CheckboxOption
                key={ad.uoc}
                label={ad.name}
                checked={selectedAddDeducts.includes(ad.uoc)}
                onClick={() => onToggleAddDeduct(ad.uoc)}
              />
            ))}
          </div>
        </FormField>
      )}

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
};

export default StepVehicleBuild;
