import { Link } from "react-router-dom";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface ProgressStepsProps {
  currentStageIdx: number;
  isComplete: boolean;
  appointmentSet: boolean;
  scheduleLink: string;
  /**
   * Whether the customer has accepted the offer. Drives which step
   * sequence renders:
   *   - false (offer pending) — 5 steps:
   *       Offer Received · Offer Accepted · Inspection Scheduled ·
   *       Deal Finalized / Paperwork · Check Received
   *   - true  (offer accepted) — 4 steps; the "Offer Received" step
   *     drops off and "Offer Accepted" becomes step 0.
   */
  isOfferAccepted?: boolean;
  /**
   * When set, we know the inspector has actually started the physical
   * inspection — shifts the active "Inspection Scheduled" indicator
   * into an explicit "Inspecting now" state with a live animation.
   */
  inspectionStartedAt?: string | null;
  /**
   * When set, the check is physically printed and ready for pickup.
   * Shifts the "Deal Finalized / Paperwork" step into an explicit
   * "Check Ready — pick up today" indicator.
   */
  checkReadyAt?: string | null;
}

const STEPS_PRE_ACCEPTANCE = [
  { label: "Offer Received" },
  { label: "Offer Accepted" },
  { label: "Inspection Scheduled" },
  { label: "Deal Finalized / Paperwork" },
  { label: "Check Received" },
];

const STEPS_POST_ACCEPTANCE = [
  { label: "Offer Accepted" },
  { label: "Inspection Scheduled" },
  { label: "Deal Finalized / Paperwork" },
  { label: "Check Received" },
];

const ProgressSteps = ({
  currentStageIdx,
  isComplete,
  appointmentSet,
  scheduleLink,
  isOfferAccepted = false,
  inspectionStartedAt,
  checkReadyAt,
}: ProgressStepsProps) => {
  const STEPS = isOfferAccepted ? STEPS_POST_ACCEPTANCE : STEPS_PRE_ACCEPTANCE;

  // Index of the "Inspection Scheduled" step varies by sequence —
  // step 1 in the post-acceptance flow, step 2 in the pre-acceptance
  // flow. Same for "Deal Finalized / Paperwork" (the check-ready
  // override target).
  const inspectionStepIdx = isOfferAccepted ? 1 : 2;
  const paperworkStepIdx = isOfferAccepted ? 2 : 3;

  // Live-state overrides — upgrade the active step's label to what's
  // actually happening right now ("Inspecting now", "Check ready
  // for pickup").
  const liveLabel = (stageIdx: number, fallback: string): string => {
    if (stageIdx === inspectionStepIdx && inspectionStartedAt) return "Inspecting now";
    if (stageIdx === paperworkStepIdx && checkReadyAt) return "Check ready for pickup";
    return fallback;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="bg-card rounded-2xl p-5 shadow-xl border border-border/50"
    >
      <h3 className="font-display text-card-foreground text-base mb-4">Your Progress</h3>
      <div className="flex items-start justify-between gap-1">
        {STEPS.map((step, i) => {
          const done = isComplete || currentStageIdx > i;
          const active = currentStageIdx === i && !isComplete;

          // Special: when the active step is "Inspection Scheduled"
          // but the customer hasn't actually scheduled yet, show a
          // pending yellow indicator + click-to-schedule.
          const isPendingInspection = i === inspectionStepIdx && active && !appointmentSet;
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

              {/* Label — upgraded to live-state text when active */}
              <span className={`text-[11px] leading-tight text-center font-medium ${
                done ? "text-card-foreground"
                  : isPendingInspection ? "text-yellow-600 dark:text-yellow-400 font-bold"
                  : active ? "text-accent font-bold"
                  : "text-muted-foreground/50"
              }`}>
                {active ? liveLabel(i, step.label) : step.label}
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

/**
 * Map the DB status to the right step index for the active sequence.
 * The `isOfferAccepted` flag picks between the 5-step pre-acceptance
 * sequence and the 4-step post-acceptance sequence.
 *
 * Pre-acceptance (5 steps):
 *   0 Offer Received       — new, contacted, offer_made
 *   1 Offer Accepted       — offer_accepted, price_agreed (no inspection yet)
 *   2 Inspection Scheduled — inspection_scheduled, inspection_completed
 *   3 Deal Finalized       — deal_finalized, title_ownership_verified, check_request_submitted
 *   4 Check Received       — purchase_complete
 *
 * Post-acceptance (4 steps):
 *   0 Offer Accepted       — offer_accepted, price_agreed
 *   1 Inspection Scheduled
 *   2 Deal Finalized
 *   3 Check Received
 */
export function mapStatusToStepIndex(mappedStatus: string, isOfferAccepted = false): number {
  if (isOfferAccepted) {
    switch (mappedStatus) {
      case "offer_accepted":
      case "price_agreed":
        return 0;
      case "inspection_scheduled":
      case "inspection_completed":
        return 1;
      case "deal_finalized":
      case "title_ownership_verified":
      case "check_request_submitted":
        return 2;
      case "purchase_complete":
        return 3;
      default:
        return 0;
    }
  }

  // Pre-acceptance (5 steps)
  switch (mappedStatus) {
    case "new":
    case "contacted":
    case "offer_made":
      return 0;
    case "offer_accepted":
    case "price_agreed":
      return 1;
    case "inspection_scheduled":
    case "inspection_completed":
      return 2;
    case "deal_finalized":
    case "title_ownership_verified":
    case "check_request_submitted":
      return 3;
    case "purchase_complete":
      return 4;
    default:
      return 0;
  }
}
