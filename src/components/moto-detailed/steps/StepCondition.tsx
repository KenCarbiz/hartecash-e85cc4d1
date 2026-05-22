import { Check } from "lucide-react";
import { motion } from "framer-motion";
import PrimaryCTA from "../PrimaryCTA";
import type { JourneyCondition, StepContext } from "../types";

const OPTIONS: { value: JourneyCondition; label: string; desc: string }[] = [
  { value: "excellent", label: "Excellent", desc: "Like new. No flaws, fully maintained." },
  { value: "very_good", label: "Very Good", desc: "Minor wear. Well cared for." },
  { value: "good", label: "Good", desc: "Normal wear for its age and miles." },
  { value: "fair", label: "Fair", desc: "Some cosmetic or mechanical issues." },
];

const StepCondition = ({ state, update, next }: StepContext) => {
  const selected = state.condition;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3">
        {OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.99 }}
              onClick={() => update({ condition: opt.value })}
              className={`group relative flex min-h-[88px] items-center rounded-2xl border p-5 text-left transition-all ${
                active
                  ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%/0.05)] shadow-[0_8px_24px_-12px_hsl(262_83%_58%/0.45),0_0_0_4px_hsl(262_83%_58%/0.08)]"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-4px_rgba(15,23,42,0.08)]"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">{opt.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{opt.desc}</p>
                </div>
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    active
                      ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%)]"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-sm text-slate-500">
        Most vehicles with similar age and mileage are rated{" "}
        <span className="font-semibold text-slate-700">Good</span>.
      </p>

      <PrimaryCTA onClick={next} disabled={!selected}>Next</PrimaryCTA>
    </div>
  );
};

export default StepCondition;
