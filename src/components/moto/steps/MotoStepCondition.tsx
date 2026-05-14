import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import MotoVehicleHero from "../MotoVehicleHero";
import type { Condition, MotoFlowState } from "../types";
import { useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS: { id: Condition; label: string; blurb: string }[] = [
  { id: "excellent", label: "Excellent", blurb: "Like new, no visible flaws, full service history." },
  { id: "good", label: "Good", blurb: "Minor wear, clean inside, runs and drives well." },
  { id: "fair", label: "Fair", blurb: "Visible scratches or interior wear, needs minor work." },
  { id: "poor", label: "Poor", blurb: "Mechanical or cosmetic issues that need fixing." },
];

const MotoStepCondition = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const [picked, setPicked] = useState<Condition | null>(state.condition);

  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard title="How would you rate the condition?">
        <div className="space-y-2">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPicked(o.id)}
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
      <div className="mt-5">
        <MotoPrimaryButton
          disabled={!picked}
          onClick={() => picked && onNext({ condition: picked, step: "trade-or-sell" })}
        >
          Next
        </MotoPrimaryButton>
      </div>
    </>
  );
};

export default MotoStepCondition;
