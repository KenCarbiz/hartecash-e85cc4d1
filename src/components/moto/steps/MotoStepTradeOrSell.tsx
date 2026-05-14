import { useState } from "react";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import MotoStickyFooter from "../MotoStickyFooter";
import MotoVehicleHero from "../MotoVehicleHero";
import type { MotoFlowState, TradeOrSell } from "../types";
import { cn } from "@/lib/utils";

const OPTIONS: { id: TradeOrSell; label: string; blurb: string }[] = [
  { id: "trade", label: "Trade In", blurb: "Apply the value toward your next vehicle." },
  { id: "sell", label: "Sell Outright", blurb: "Walk away with a check, no purchase needed." },
];

const MotoStepTradeOrSell = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const [picked, setPicked] = useState<TradeOrSell | null>(state.intent);
  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard title="Are you trading in or selling?">
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
      <MotoStickyFooter>
        <MotoPrimaryButton
          disabled={!picked}
          onClick={() => picked && onNext({ intent: picked, step: "ownership" })}
        >
          Next
        </MotoPrimaryButton>
      </MotoStickyFooter>
    </>
  );
};

export default MotoStepTradeOrSell;
