import { useState } from "react";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import MotoVehicleHero from "../MotoVehicleHero";
import type { MotoFlowState, Ownership } from "../types";

const OPTIONS: { id: Ownership; label: string }[] = [
  { id: "own", label: "Own it outright (no loan or lease)" },
  { id: "finance", label: "Have a loan" },
  { id: "lease", label: "Leasing it" },
];

const MotoStepOwnership = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const [picked, setPicked] = useState<Ownership | "">(state.ownership || "");
  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard title="Ownership Status">
        <label className="block">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value as Ownership)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-[hsl(var(--cta-offer))] focus:ring-2 focus:ring-[hsl(var(--cta-offer)/0.15)]"
          >
            <option value="">Select Status</option>
            {OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      </MotoCard>
      <div className="mt-5">
        <MotoPrimaryButton
          disabled={!picked}
          onClick={() => picked && onNext({ ownership: picked as Ownership, step: "color" })}
        >
          Next
        </MotoPrimaryButton>
      </div>
    </>
  );
};

export default MotoStepOwnership;
