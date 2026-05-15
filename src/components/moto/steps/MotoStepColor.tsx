import { useState } from "react";
import MotoCard from "../MotoCard";
import MotoVehicleHero from "../MotoVehicleHero";
import type { MotoFlowState } from "../types";
import { cn } from "@/lib/utils";

const FALLBACK_COLORS = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#0A0A0A" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Gray", hex: "#6B7280" },
  { name: "Red", hex: "#B91C1C" },
  { name: "Blue", hex: "#1D4ED8" },
  { name: "Green", hex: "#15803D" },
  { name: "Tan", hex: "#C2A878" },
];

/**
 * Tap-to-advance — picking a color swatch auto-routes to the
 * contact step after a brief highlight. No explicit Next button.
 */
const MotoStepColor = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const bbColors = state.bbVehicle?.exterior_colors ?? [];
  const palette = bbColors.length
    ? bbColors.map((c) => ({ name: c.name, hex: c.hex.startsWith("#") ? c.hex : `#${c.hex}` }))
    : FALLBACK_COLORS;

  const [picked, setPicked] = useState(state.color || "");

  const choose = (name: string) => {
    setPicked(name);
    window.setTimeout(() => onNext({ color: name, step: "contact" }), 250);
  };

  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={picked || state.color} mileage={state.mileage} />
      <MotoCard title="Exterior Color">
        <div className="grid grid-cols-4 gap-3">
          {palette.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => choose(c.name)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 transition",
                picked === c.name
                  ? "border-[hsl(var(--cta-offer))] ring-1 ring-[hsl(var(--cta-offer))]"
                  : "border-zinc-200 hover:border-zinc-300",
              )}
            >
              <span
                className="h-10 w-10 rounded-full border border-zinc-300"
                style={{ background: c.hex }}
              />
              <span className="text-[11px] text-zinc-700">{c.name}</span>
            </button>
          ))}
        </div>
      </MotoCard>
    </>
  );
};

export default MotoStepColor;
