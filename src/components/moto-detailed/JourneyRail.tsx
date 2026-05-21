import { Check } from "lucide-react";
import { motion } from "framer-motion";
import type { StepDefinition } from "./types";

interface Props {
  steps: StepDefinition[];
  activeIndex: number;
}

/**
 * Desktop left journey rail. Minimal, calm, sticky.
 * NOT the customer portal sidebar — purely a progress tracker for
 * the public valuation flow.
 */
const JourneyRail = ({ steps, activeIndex }: Props) => (
  <nav className="sticky top-24 hidden lg:block" aria-label="Valuation progress">
    <ol className="space-y-1">
      {steps.map((step, i) => {
        const isComplete = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <li key={step.id} className="relative">
            <div className="flex items-start gap-3 rounded-xl px-3 py-2.5">
              <div className="relative">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: isComplete
                      ? "hsl(142 71% 45%)"
                      : isActive
                      ? "hsl(262 83% 58%)"
                      : "hsl(0 0% 96%)",
                    color: isComplete || isActive ? "#fff" : "hsl(0 0% 60%)",
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </motion.div>
                {i < steps.length - 1 && (
                  <div className="absolute left-1/2 top-7 h-6 w-px -translate-x-1/2 bg-zinc-200" />
                )}
              </div>
              <div className="pt-0.5">
                <p
                  className={`text-sm font-medium ${
                    isActive ? "text-zinc-900" : isComplete ? "text-zinc-700" : "text-zinc-400"
                  }`}
                >
                  {step.title}
                </p>
                {step.helper && (
                  <p className={`text-xs ${isActive ? "text-zinc-500" : "text-zinc-400"}`}>
                    {step.helper}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  </nav>
);

export default JourneyRail;
