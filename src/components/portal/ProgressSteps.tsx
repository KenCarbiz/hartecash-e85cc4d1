import { CheckCircle, Circle } from "lucide-react";
import { motion } from "framer-motion";

interface ProgressStepsProps {
  currentStageIdx: number;
  isComplete: boolean;
}

const STEPS = [
  { label: "Offer Accepted" },
  { label: "Inspection Done" },
  { label: "Deal Finalized" },
  { label: "Paperwork Complete" },
  { label: "Check Received" },
];

const ProgressSteps = ({ currentStageIdx, isComplete }: ProgressStepsProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="bg-card rounded-xl p-5 shadow-lg"
    >
      <h3 className="font-bold text-card-foreground text-sm mb-4">Your Progress</h3>
      <div className="flex items-start justify-between gap-1">
        {STEPS.map((step, i) => {
          const done = isComplete || currentStageIdx > i;
          const active = currentStageIdx === i && !isComplete;

          return (
            <div key={step.label} className="flex flex-col items-center flex-1 relative">
              {/* Connector line */}
              {i > 0 && (
                <div className="absolute top-3 -left-1/2 w-full h-0.5">
                  <div className={`h-full rounded-full transition-colors duration-500 ${done || active ? "bg-success" : "bg-border"}`} />
                </div>
              )}

              {/* Circle */}
              <div className="relative z-10 mb-1.5">
                {done ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1, type: "spring" }}>
                    <CheckCircle className="w-6 h-6 text-success" />
                  </motion.div>
                ) : active ? (
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-accent-foreground" />
                    </div>
                    <span className="absolute inset-0 rounded-full animate-ping bg-accent/30" />
                  </div>
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground/30" />
                )}
              </div>

              {/* Label */}
              <span className={`text-[11px] leading-tight text-center font-medium ${
                done ? "text-card-foreground" : active ? "text-accent font-bold" : "text-muted-foreground/50"
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ProgressSteps;

/** Map the DB status to 0-3 index for the 4-step bar */
export function mapStatusToStepIndex(mappedStatus: string): number {
  switch (mappedStatus) {
    case "new":
    case "contacted":
    case "offer_made":
      return 0;
    case "inspection_scheduled":
    case "inspection_completed":
      return 1;
    case "price_agreed":
      return 2;
    case "title_verified":
    case "ownership_verified":
      return 3;
    case "purchase_complete":
      return 4;
    default:
      return 0;
  }
}
