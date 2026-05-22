import { Repeat, Banknote, Check, Circle } from "lucide-react";
import { motion } from "framer-motion";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";

const StepUsage = ({ state, update, next }: StepContext) => {
  const sel = state.usage;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          active={sel === "trade"}
          onClick={() => update({ usage: "trade" })}
          icon={<Repeat className="h-5 w-5" strokeWidth={2.25} />}
          title="Trade In"
          desc="Apply your car's value toward your next one."
        />
        <Card
          active={sel === "sell"}
          onClick={() => update({ usage: "sell" })}
          icon={<Banknote className="h-5 w-5" strokeWidth={2.25} />}
          title="Sell Outright"
          desc="Get paid directly — no purchase required."
        />
      </div>

      <p className="text-center text-[13px] text-slate-500 sm:text-left">
        You can change this later before accepting your offer.
      </p>

      <PrimaryCTA onClick={next} disabled={!sel}>Next</PrimaryCTA>
    </div>
  );
};

const Card = ({
  active, onClick, icon, title, desc,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string;
}) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className={`group relative flex h-full min-h-[156px] cursor-pointer flex-col rounded-2xl border p-5 text-left transition-all ${
      active
        ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%/0.05)] shadow-[0_8px_24px_-12px_hsl(262_83%_58%/0.45),0_0_0_4px_hsl(262_83%_58%/0.08)]"
        : "border-slate-200 bg-white hover:border-[hsl(262_83%_58%/0.5)] hover:bg-[hsl(262_83%_58%/0.025)] hover:shadow-[0_4px_12px_-6px_rgba(15,23,42,0.1)]"
    }`}
  >
    {/* Top row — icon + selection indicator */}
    <div className="flex items-start justify-between">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
          active
            ? "bg-[hsl(262_83%_58%)] text-white"
            : "bg-[hsl(262_83%_58%/0.08)] text-[hsl(262_60%_45%)] group-hover:bg-[hsl(262_83%_58%/0.12)]"
        }`}
      >
        {icon}
      </div>
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
          active
            ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%)] text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
      >
        {active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-2 w-2" />}
      </div>
    </div>

    <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-sm leading-relaxed text-slate-500">{desc}</p>
  </motion.button>
);

export default StepUsage;
