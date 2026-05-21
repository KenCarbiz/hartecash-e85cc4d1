import { Repeat, Banknote, Check } from "lucide-react";
import { motion } from "framer-motion";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";

const StepUsage = ({ state, update, next }: StepContext) => {
  const sel = state.usage;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          active={sel === "trade"}
          onClick={() => update({ usage: "trade" })}
          icon={<Repeat className="h-5 w-5" />}
          title="Trade In"
          desc="Apply your car's value toward your next one."
        />
        <Card
          active={sel === "sell"}
          onClick={() => update({ usage: "sell" })}
          icon={<Banknote className="h-5 w-5" />}
          title="Sell Outright"
          desc="Get paid directly — no purchase required."
        />
      </div>

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
    whileTap={{ scale: 0.985 }}
    onClick={onClick}
    className={`relative rounded-2xl border p-6 text-left transition-all ${
      active
        ? "border-emerald-500 bg-emerald-50/40 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]"
        : "border-zinc-200 bg-white hover:border-zinc-300"
    }`}
  >
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-600"}`}>
      {icon}
    </div>
    <p className="mt-4 text-base font-semibold text-zinc-900">{title}</p>
    <p className="mt-1 text-sm text-zinc-500">{desc}</p>
    {active && (
      <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" />
      </div>
    )}
  </motion.button>
);

export default StepUsage;
