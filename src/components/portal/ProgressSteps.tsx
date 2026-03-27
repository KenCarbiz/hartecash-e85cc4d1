import { Link } from "react-router-dom";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface ProgressStepsProps {
  currentStageIdx: number;
  isComplete: boolean;
  appointmentSet: boolean;
  scheduleLink: string;
}

const STEPS = [
  { label: "Offer Accepted" },
  { label: "Inspection Scheduled" },
  { label: "Deal Finalized" },
  { label: "Paperwork Complete" },
  { label: "Check Received" },
];

const ProgressSteps = ({ currentStageIdx, isComplete, appointmentSet, scheduleLink }: ProgressStepsProps) => {
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

          // Special: step 1 (Inspection Scheduled) — show pending yellow if active & not yet scheduled
          const isPendingInspection = i === 1 && active && !appointmentSet;
          const isClickable = isPendingInspection;

          const node = (
            <div key={step.label} className={`flex flex-col items-center flex-1 relative ${isClickable ? "cursor-pointer group" : ""}`}>
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
                ) : isPendingInspection ? (
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center group-hover:bg-yellow-400 transition-colors">
                      <Clock className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="absolute inset-0 rounded-full animate-ping bg-yellow-500/30" />
                  </div>
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
                done ? "text-card-foreground"
                  : isPendingInspection ? "text-yellow-600 dark:text-yellow-400 font-bold"
                  : active ? "text-accent font-bold"
                  : "text-muted-foreground/50"
              }`}>
                {step.label}
              </span>
              {isPendingInspection && (
                <span className="text-[9px] text-yellow-600 dark:text-yellow-400 mt-0.5 underline group-hover:no-underline">
                  Schedule now
                </span>
              )}
            </div>
          );

          if (isClickable) {
            return <Link key={step.label} to={scheduleLink} className="flex-1">{node}</Link>;
          }
          return node;
        })}
      </div>
    </motion.div>
  );
};

export default ProgressSteps;

/** Map the DB status to 0-4 index for the 5-step bar */
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
