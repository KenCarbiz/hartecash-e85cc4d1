import { CheckCircle } from "lucide-react";
import type { BBVehicle } from "./types";

interface Props {
  vehicles: BBVehicle[];
  selectedUvc: string;
  onSelect: (uvc: string) => void;
}

const StepSelectTrim = ({ vehicles, selectedUvc, onSelect }: Props) => {
  if (vehicles.length === 0) return null;

  return (
    <>
      <div className="mb-5 text-center">
        <h3 className="text-lg font-bold text-card-foreground mb-1">
          We found {vehicles.length} possible match{vehicles.length > 1 ? "es" : ""}
        </h3>
        <p className="text-sm text-muted-foreground">
          Please select the trim that matches your vehicle.
        </p>
      </div>

      <div className="grid gap-2">
        {vehicles.map((v) => {
          const selected = selectedUvc === v.uvc;
          const label = [v.year, v.make, v.model, v.series, v.style]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={v.uvc}
              type="button"
              onClick={() => onSelect(v.uvc)}
              className={`w-full text-left px-4 py-3.5 rounded-lg border-2 transition-all ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-input bg-background hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center gap-3">
                {selected && <CheckCircle className="w-5 h-5 text-accent shrink-0" />}
                <div>
                  <span className={`text-sm font-bold ${selected ? "text-accent" : "text-card-foreground"}`}>
                    {label}
                  </span>
                  {v.class_name && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {v.class_name} • MSRP ${v.msrp?.toLocaleString() || "N/A"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default StepSelectTrim;
