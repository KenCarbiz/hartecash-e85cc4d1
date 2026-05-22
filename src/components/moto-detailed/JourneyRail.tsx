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
    <ol className="space-y-2">
      {steps.map((step, i) => {
        const isComplete = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <li key={step.id} className="relative">
            <div
              className={`flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors ${
                isActive ? "bg-[hsl(262_83%_58%/0.05)]" : ""
              }`}
            >
              <div className="relative">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: isComplete
                      ? "hsl(142 71% 45%)"
                      : isActive
                      ? "hsl(262 83% 58%)"
                      : "hsl(210 20% 96%)",
                    color: isComplete || isActive ? "#fff" : "hsl(215 16% 55%)",
                    boxShadow: isActive
                      ? "0 0 0 4px hsl(262 83% 58% / 0.12)"
                      : "0 0 0 0px transparent",
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
                >
                  {isComplete ? <Check className="h-4 w-4" /> : i + 1}
                </motion.div>
                {i < steps.length - 1 && (
                  <div className="absolute left-1/2 top-8 h-7 w-px -translate-x-1/2 bg-slate-200/70" />
                )}
              </div>
              <div className="pt-0.5">
                <p
                  className={`text-[14px] font-semibold leading-tight ${
                    isActive
                      ? "text-slate-900"
                      : isComplete
                      ? "text-slate-700"
                      : "text-slate-400"
                  }`}
                >
                  {step.title}
                </p>
                {step.helper && (
                  <p
                    className={`mt-0.5 text-[12px] leading-snug ${
                      isActive ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
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
