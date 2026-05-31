import { Sparkles } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";

/**
 * Generic "coming up" placeholder for journey steps that exist in the
 * rail (Photos, Payoff, Trade/Sell, Dealer Questions, Documents,
 * Schedule, Complete) but don't yet have a bespoke UI. Dealers can
 * swap any of these with a custom step via the JourneyConfig without
 * touching the engine.
 */
const makePlaceholder = (label: string, description: string) => {
  const Step = ({ next }: StepContext) => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-8">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(263_70%_50%/0.1)] text-[hsl(263_70%_50%)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-900">{label}</h3>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
      </div>
      <PrimaryCTA onClick={next}>Continue</PrimaryCTA>
    </div>
  );
  Step.displayName = `Step_${label.replace(/\s+/g, "")}`;
  return Step;
};

export const StepPhotos = makePlaceholder(
  "Add a few photos",
  "Snap exterior, interior, and odometer shots. We'll guide you frame by frame, or you can skip and continue on mobile.",
);
export const StepPayoff = makePlaceholder(
  "Loan or lease payoff",
  "If your vehicle has a remaining balance, share the payoff details so we can include it in your final offer.",
);
export const StepTradeSell = makePlaceholder(
  "Trade or sell outright",
  "Choose how you'd like to complete the transaction. Trade-ins may unlock additional dealer-specific bonuses.",
);
export const StepDealerQuestions = makePlaceholder(
  "A few quick questions",
  "Your dealer added a couple of optional questions to personalize your offer.",
);
export const StepDocuments = makePlaceholder(
  "Upload your documents",
  "Driver's license and title. We'll automatically sync between your desktop and phone — no email needed.",
);
export const StepSchedule = makePlaceholder(
  "Pick a time",
  "Schedule a quick appointment for inspection or pickup. 30-minute windows.",
);
export const StepComplete = makePlaceholder(
  "You're all set",
  "We'll be in touch shortly. You can return to your portal any time to track progress.",
);
