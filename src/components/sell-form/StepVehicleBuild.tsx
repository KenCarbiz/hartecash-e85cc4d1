import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import CheckboxOption from "./CheckboxOption";
import VehicleImage from "./VehicleImage";
import type { FormData, VehicleInfo, BBVehicle, BBColor } from "./types";
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

const FALLBACK_COLOR_OPTIONS = [
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

/** Get hex color from BB color - prefer hex swatch, fall back to rgb conversion */
const getColorHex = (c: BBColor): string => {
  if (c.hex) return c.hex;
  if (!c.rgb) return "#888";
  const parts = c.rgb.split(",").map((p) => parseInt(p.trim(), 10));
  if (parts.length < 3 || parts.some(isNaN)) return "#888";
  return `#${parts.map((p) => p.toString(16).padStart(2, "0")).join("")}`;
};

const ColorDropdown = ({
  value,
  onChange,
  bbColors,
}: {
  value: string;
  onChange: (v: string) => void;
  bbColors?: BBColor[];
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Deduplicate BB colors by name (keep first occurrence)
  const colorOptions = useMemo(() => {
    if (bbColors && bbColors.length > 0) {
      const seen = new Set<string>();
      const opts = bbColors
        .filter((c) => {
          const key = c.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c) => ({ label: c.name, hex: rgbToHex(c.rgb) }));
      opts.push({ label: "Other", hex: "none" });
      return opts;
    }
    return FALLBACK_COLOR_OPTIONS;
  }, [bbColors]);

  const selected = colorOptions.find((c) => c.label === value);

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
          {colorOptions.map((color) => (
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

/** Verified spec badge — green check or red X */
const VerifiedBadge = ({ label, value, verified }: { label: string; value: string; verified: boolean }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
    verified
      ? "bg-success/5 border-success/20 text-card-foreground"
      : "bg-destructive/5 border-destructive/20 text-card-foreground"
  }`}>
    {verified ? (
      <CheckCircle className="w-4 h-4 text-success shrink-0" />
    ) : (
      <XCircle className="w-4 h-4 text-destructive shrink-0" />
    )}
    <span className="font-medium">{label}:</span>
    <span className="text-muted-foreground">{value || "Unknown"}</span>
  </div>
);

const StepVehicleBuild = ({ formData, update, vehicleInfo, bbVehicle, selectedAddDeducts, onToggleAddDeduct, formConfig }: Props) => {
  // Auto-populate drivetrain from BB data
  const bbDrivetrain = bbVehicle?.drivetrain
    ? bbVehicle.drivetrain.toUpperCase()
    : bbVehicle
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

  // Build verified specs from BB data
  const verifiedSpecs = bbVehicle ? [
    { label: "Class", value: bbVehicle.class_name, verified: !!bbVehicle.class_name },
    { label: "Drivetrain", value: bbDrivetrain || "Unknown", verified: !!bbDrivetrain },
    { label: "Transmission", value: bbVehicle.transmission || "Unknown", verified: !!bbVehicle.transmission },
    { label: "Engine", value: bbVehicle.engine || "Unknown", verified: !!bbVehicle.engine },
    { label: "Fuel Type", value: bbVehicle.fuel_type || "Unknown", verified: !!bbVehicle.fuel_type },
    { label: "Original MSRP", value: bbVehicle.msrp ? `$${bbVehicle.msrp.toLocaleString()}` : "N/A", verified: !!bbVehicle.msrp },
  ].filter(s => s.value && s.value !== "Unknown" && s.value !== "N/A" && s.value !== "") : [];

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

      {displayInfo && (
        <VehicleImage
          year={displayInfo.year}
          make={displayInfo.make}
          model={displayInfo.model}
          style={bbVehicle?.style}
          selectedColor={formData.exteriorColor}
          uvc={bbVehicle?.uvc}
        />
      )}

      {/* Verified Vehicle Specs from Black Book */}
      {verifiedSpecs.length > 0 && (
        <FormField label="Verified Vehicle Specifications">
          <div className="grid gap-1.5">
            {verifiedSpecs.map((spec) => (
              <VerifiedBadge
                key={spec.label}
                label={spec.label}
                value={spec.value}
                verified={spec.verified}
              />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_exterior_color) && (
        <FormField label="What color is your vehicle?">
          <ColorDropdown value={formData.exteriorColor} onChange={(v) => update("exteriorColor", v)} bbColors={bbVehicle?.exterior_colors} />
        </FormField>
      )}

      {/* Only show drivetrain question if BB didn't provide it */}
      {(!formConfig || formConfig.q_drivetrain) && !bbDrivetrain && (
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
      )}

      {/* Auto-applied equipment from VIN */}
      {autoAddDeducts.length > 0 && (
        <FormField label="Included equipment (from VIN)">
          <div className="grid gap-1.5">
            {autoAddDeducts.map((ad) => (
              <div key={ad.uoc} className="px-3 py-2 bg-success/10 border border-success/20 rounded-lg text-sm text-card-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success shrink-0" />
                {ad.name}
                {ad.avg !== 0 && (
                  <span className={`ml-auto text-xs font-medium ${ad.avg > 0 ? "text-success" : "text-destructive"}`}>
                    {ad.avg > 0 ? "+" : ""}${ad.avg.toLocaleString()}
                  </span>
                )}
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
                label={`${ad.name}${ad.avg !== 0 ? ` (${ad.avg > 0 ? "+" : ""}$${ad.avg.toLocaleString()})` : ""}`}
                checked={selectedAddDeducts.includes(ad.uoc)}
                onClick={() => onToggleAddDeduct(ad.uoc)}
              />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_modifications) && (
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
      )}
    </>
  );
};

export default StepVehicleBuild;
