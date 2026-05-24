import { Repeat, Banknote, Check } from "lucide-react";
import { motion } from "framer-motion";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";

const StepUsage = ({ state, update, next }: StepContext) => {
  const sel = state.usage;
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Trade in or sell outright" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[13px] leading-relaxed text-slate-600">
        <span className="mt-0.5 text-[hsl(262_60%_45%)]">💡</span>
        <span>Your choice helps us match the right dealer process for your offer. You can change this before accepting.</span>
      </div>

      <PrimaryCTA onClick={next} disabled={!sel}>Continue to Contact Info</PrimaryCTA>
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
    role="radio"
    aria-checked={active}
    tabIndex={active ? 0 : -1}
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className={`group relative flex h-full min-h-[168px] cursor-pointer flex-col items-center justify-center rounded-2xl border px-5 py-6 text-center outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%)] focus-visible:ring-offset-2 ${
      active
        ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%/0.06)] ring-2 ring-[hsl(262_83%_58%/0.35)] shadow-[0_10px_30px_-12px_hsl(262_83%_58%/0.45)]"
        : "border-slate-200 bg-white hover:-translate-y-px hover:border-[hsl(262_83%_58%/0.55)] hover:bg-[hsl(262_83%_58%/0.04)] hover:shadow-[0_8px_24px_-12px_hsl(262_83%_58%/0.20)]"
    }`}
  >
    {/* Selection badge — faint ring at rest, filled check fades in on select */}
    <span
      className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ${
        active ? "bg-[hsl(262_83%_58%)] text-white" : "border border-slate-300 bg-white text-transparent"
      }`}
    >
      <Check
        className={`h-3.5 w-3.5 transition-all duration-200 ${active ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
        strokeWidth={3}
      />
    </span>

    <span
      className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
        active
          ? "bg-[hsl(262_83%_58%)] text-white shadow-[0_4px_12px_-2px_hsl(262_83%_58%/0.5)]"
          : "bg-[hsl(262_83%_58%/0.08)] text-[hsl(262_60%_45%)] group-hover:bg-[hsl(262_83%_58%/0.14)]"
      }`}
    >
      {icon}
    </span>

    <p className={`text-base font-semibold ${active ? "text-[hsl(262_55%_38%)]" : "text-slate-900"}`}>{title}</p>
    <p className="mt-1 max-w-[22ch] text-sm leading-relaxed text-slate-500">{desc}</p>
  </motion.button>
);

export default StepUsage;
