import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import CheckboxOption from "./CheckboxOption";
import VehicleImage from "./VehicleImage";
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

const VehicleColorPreview = ({ color, vehicleName }: { color: string; vehicleName: string }) => {
  const selected = COLOR_OPTIONS.find((c) => c.label === color);
  const hex = selected?.hex && selected.hex !== "none" ? selected.hex : "#a0a0a0";

  return (
    <motion.div
      layout
      className="relative w-full rounded-xl overflow-hidden mb-2"
      style={{ aspectRatio: "16/7" }}
    >
      {/* Background gradient based on car color */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: `linear-gradient(135deg, ${hex}18 0%, ${hex}08 50%, transparent 100%)`,
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* Reflection line */}
      <div className="absolute bottom-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* SVG Car silhouette */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.svg
          viewBox="0 0 400 140"
          className="w-[85%] max-w-[340px]"
          initial={false}
        >
          {/* Shadow */}
          <ellipse cx="200" cy="132" rx="160" ry="6" fill={`${hex}20`} />

          {/* Car body */}
          <motion.path
            d="M50,95 L60,95 L75,60 Q80,50 95,45 L170,38 Q185,36 200,36 L260,38 Q280,39 295,45 L330,60 Q335,65 340,75 L348,90 Q350,95 348,98 L345,100 L55,100 Q50,100 50,95 Z"
            animate={{ fill: hex }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />

          {/* Roof / windows */}
          <path
            d="M105,58 L165,42 Q180,39 200,39 L255,41 Q270,42 280,48 L310,62 Q312,63 310,65 L295,66 Q250,68 200,68 Q150,68 105,66 Q102,65 103,62 Z"
            fill="hsl(var(--muted))"
            opacity="0.5"
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
          />

          {/* Window divider */}
          <line x1="200" y1="40" x2="200" y2="67" stroke="hsl(var(--border))" strokeWidth="1.5" />

          {/* Front windshield glare */}
          <path
            d="M270,46 L300,60 L295,64 L260,50 Z"
            fill="white"
            opacity="0.15"
          />

          {/* Headlights */}
          <motion.rect
            x="335" y="78" width="14" height="8" rx="3"
            animate={{ fill: hex }}
            transition={{ duration: 0.5 }}
            stroke="hsl(var(--border))"
            strokeWidth="0.8"
            filter="brightness(1.3)"
          />
          <rect x="338" y="80" width="8" height="4" rx="1.5" fill="white" opacity="0.5" />

          {/* Taillights */}
          <rect x="52" y="80" width="10" height="8" rx="2" fill="hsl(var(--destructive))" opacity="0.7" stroke="hsl(var(--border))" strokeWidth="0.5" />

          {/* Lower body trim */}
          <motion.path
            d="M68,100 L340,100 L345,95 Q346,93 344,92 L60,92 Q58,93 59,95 Z"
            animate={{ fill: hex }}
            transition={{ duration: 0.5 }}
            opacity="0.7"
          />

          {/* Front wheel */}
          <circle cx="115" cy="102" r="20" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
          <circle cx="115" cy="102" r="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
          <circle cx="115" cy="102" r="5" fill="hsl(var(--muted-foreground))" opacity="0.4" />
          {/* Spokes */}
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <line
              key={angle}
              x1={115 + 6 * Math.cos((angle * Math.PI) / 180)}
              y1={102 + 6 * Math.sin((angle * Math.PI) / 180)}
              x2={115 + 13 * Math.cos((angle * Math.PI) / 180)}
              y2={102 + 13 * Math.sin((angle * Math.PI) / 180)}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="1.5"
              opacity="0.3"
            />
          ))}

          {/* Rear wheel */}
          <circle cx="295" cy="102" r="20" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
          <circle cx="295" cy="102" r="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
          <circle cx="295" cy="102" r="5" fill="hsl(var(--muted-foreground))" opacity="0.4" />
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <line
              key={angle}
              x1={295 + 6 * Math.cos((angle * Math.PI) / 180)}
              y1={102 + 6 * Math.sin((angle * Math.PI) / 180)}
              x2={295 + 13 * Math.cos((angle * Math.PI) / 180)}
              y2={102 + 13 * Math.sin((angle * Math.PI) / 180)}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="1.5"
              opacity="0.3"
            />
          ))}
        </motion.svg>
      </div>

      {/* Color label chip */}
      <AnimatePresence mode="wait">
        {color && (
          <motion.div
            key={color}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-2.5 right-3 flex items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-border rounded-full px-2.5 py-1 shadow-sm"
          >
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${selected?.hex === "none" ? "border border-dashed border-muted-foreground" : "border border-border/50"}`}
              style={selected?.hex !== "none" ? { background: hex } : undefined}
            />
            <span className="text-xs font-medium text-card-foreground">{color}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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

      {displayInfo && (
        <VehicleColorPreview
          color={formData.exteriorColor}
          vehicleName={`${displayInfo.year} ${displayInfo.make} ${displayInfo.model}`}
        />
      )}

      {(!formConfig || formConfig.q_exterior_color) && (
        <FormField label="What color is your vehicle?">
          <ColorDropdown value={formData.exteriorColor} onChange={(v) => update("exteriorColor", v)} />
        </FormField>
      )}

      {(!formConfig || formConfig.q_drivetrain) && (
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
      )}

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
