import { useState } from "react";
import MotoCard from "../MotoCard";
import MotoVehicleHero from "../MotoVehicleHero";
import type { MotoFlowState, Ownership } from "../types";

const OPTIONS: { id: Ownership; label: string }[] = [
  { id: "own", label: "Own it outright (no loan or lease)" },
  { id: "finance", label: "Have a loan" },
  { id: "lease", label: "Leasing it" },
];

/**
 * Tap-to-advance — once the customer picks a value from the
 * dropdown, the flow auto-advances after a short delay. No
 * explicit Next button.
 */
const MotoStepOwnership = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const [picked, setPicked] = useState<Ownership | "">(state.ownership || "");

  const choose = (val: string) => {
    if (!val) {
      setPicked("");
      return;
    }
    const id = val as Ownership;
    setPicked(id);
    window.setTimeout(() => onNext({ ownership: id, step: "color" }), 250);
  };

  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard title="Ownership Status">
        <label className="block">
          <select
            value={picked}
            onChange={(e) => choose(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-[hsl(var(--cta-offer))] focus:ring-2 focus:ring-[hsl(var(--cta-offer)/0.15)]"
          >
            <option value="">Select Status</option>
            {OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      </MotoCard>
    </>
  );
};

export default MotoStepOwnership;
