import MotoCard from "../MotoCard";
import MotoVehicleHero from "../MotoVehicleHero";
import type { Condition, MotoFlowState } from "../types";
import { useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS: { id: Condition; label: string; blurb: string }[] = [
  { id: "excellent", label: "Excellent", blurb: "(about 2% of vehicles) - Looks new and is in excellent mechanical condition." },
  { id: "very_good", label: "Very Good", blurb: "(about 28% of vehicles) - Has minor cosmetic defects and is in good mechanical condition." },
  { id: "good", label: "Good", blurb: "(about 50% of vehicles) - Has repairable cosmetic defects and mechanical problems." },
  { id: "fair", label: "Fair", blurb: "(about 20% of vehicles) - Requires some mechanical repairs." },
];

/**
 * Tap-to-advance — picking a condition immediately routes to the
 * next step after a brief highlight (250 ms) so the customer sees
 * their selection register. No explicit Next button on this step.
 */
const MotoStepCondition = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  // Pre-select "Good" — that's what ~50% of cars are, so defaulting it
  // saves customers a tap. They can still pick a different option to override.
  const [picked, setPicked] = useState<Condition | null>(state.condition ?? "good");

  const choose = (id: Condition) => {
    setPicked(id);
    window.setTimeout(() => onNext({ condition: id, step: "trade-or-sell" }), 250);
  };

  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard title="How would you rate the condition?">
        <div className="space-y-2">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              className={cn(
                "w-full rounded-lg border p-4 text-left transition",
                picked === o.id
                  ? "border-[hsl(var(--cta-offer))] bg-[hsl(var(--cta-offer)/0.06)] ring-1 ring-[hsl(var(--cta-offer))]"
                  : "border-zinc-200 hover:border-zinc-300",
              )}
            >
              <div className="font-semibold text-zinc-900">{o.label}</div>
              <div className="mt-0.5 text-xs text-zinc-600">{o.blurb}</div>
            </button>
          ))}
        </div>
      </MotoCard>
    </>
  );
};

export default MotoStepCondition;
