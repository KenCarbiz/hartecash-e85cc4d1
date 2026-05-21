import { useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import JourneyRail from "./JourneyRail";
import MobileStepper from "./MobileStepper";
import SummaryPanel from "./SummaryPanel";
import {
  emptyJourneyState,
  type JourneyConfig,
  type JourneyState,
  type StepContext,
} from "./types";

/**
 * Modular Moto Detailed engine.
 *
 * The engine is fully driven by a JourneyConfig — steps, order, and
 * offer placement are configuration, not code. To inject a custom
 * dealer question, pass a new StepDefinition in `config.steps` at
 * the desired index. Steps can also opt out at runtime via
 * `shouldRender(state)`.
 */
const JourneyEngine = ({ config }: { config: JourneyConfig }) => {
  const [state, setState] = useState<JourneyState>(emptyJourneyState);
  const [cursor, setCursor] = useState(0);

  // Filter out steps whose runtime predicate says "skip".
  const activeSteps = useMemo(
    () => config.steps.filter((s) => (s.shouldRender ? s.shouldRender(state) : true)),
    [config.steps, state],
  );

  const safeCursor = Math.min(cursor, activeSteps.length - 1);
  const current = activeSteps[safeCursor];

  const update = useCallback((patch: Partial<JourneyState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const next = useCallback(() => {
    setCursor((c) => Math.min(c + 1, activeSteps.length - 1));
  }, [activeSteps.length]);

  const back = useCallback(() => {
    setCursor((c) => Math.max(c - 1, 0));
  }, []);

  const goTo = useCallback(
    (stepId: string) => {
      const i = activeSteps.findIndex((s) => s.id === stepId);
      if (i >= 0) setCursor(i);
    },
    [activeSteps],
  );

  const ctx: StepContext = { state, update, next, back, goTo, offerDisplayMode: config.offerDisplayMode };

  if (!current) return null;
  const StepComponent = current.Component;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 lg:px-8 lg:pt-16">
        {/* Mobile stepper */}
        <div className="mb-6 lg:hidden">
          <MobileStepper
            total={activeSteps.length}
            activeIndex={safeCursor}
            title={current.title}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* LEFT — desktop journey rail */}
          <div className="lg:col-span-3">
            <JourneyRail steps={activeSteps} activeIndex={safeCursor} />
          </div>

          {/* CENTER — active step */}
          <div className="lg:col-span-6">
            {safeCursor > 0 && (
              <button
                onClick={back}
                className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <header className="mb-6">
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                    {current.pageTitle}
                  </h1>
                  {current.pageSubtitle && (
                    <p className="mt-2 text-base text-zinc-500">{current.pageSubtitle}</p>
                  )}
                </header>

                <StepComponent {...ctx} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* RIGHT — summary panel */}
          <div className="lg:col-span-3">
            <SummaryPanel state={state} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JourneyEngine;
