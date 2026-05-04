import { useState } from "react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import LandingForm from "@/components/LandingForm";
import LandingPlateInput, { type LandingPlateInputValue } from "../LandingPlateInput";
import FullscreenWizard from "../FullscreenWizard";
import { FullBelowFold } from "../sharedSections";

/**
 * CLARITY — Apple/Porsche minimal white. Tier C of the May-2026
 * design audit. The customer sees a marketing landing (headline +
 * plate input + minimal proof + below-fold strip) and the moment
 * they engage, the FullscreenWizard takes over the viewport — the
 * landing chrome disappears entirely so the flow is focused and
 * premium.
 *
 * Mercedes/Apple-grade easing on transitions: 500ms cubic-bezier
 * (0.16, 1, 0.3, 1). Slow, deliberate, no springs or bounces.
 */
const ClarityTemplate = () => {
  const { config } = useSiteConfig();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initial, setInitial] = useState<LandingPlateInputValue | null>(null);

  const handleEngage = (value: LandingPlateInputValue) => {
    setInitial(value);
    setWizardOpen(true);
  };

  return (
    <>
      {/* ── Landing — marketing-rich, the only customer-facing input
            is plate+state. All other context lives in the page itself
            (reviews, process, comparison) and disappears the moment
            the customer engages. */}
      <section className="relative min-h-[88vh] flex items-center justify-center px-5 py-16 bg-white text-zinc-900">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[640px] flex flex-col items-center gap-10"
        >
          <div className="text-center space-y-4">
            <h1 className="font-sans text-[44px] md:text-[64px] lg:text-[72px] font-bold tracking-[-0.025em] leading-[1.02] text-zinc-900">
              {config.hero_headline || "Sell your car in 2 minutes."}
            </h1>
            <p className="font-sans text-base md:text-lg text-zinc-500 max-w-md mx-auto leading-relaxed">
              {config.hero_subtext || "Real cash offer. No haggling. Picked up at your door."}
            </p>
          </div>

          <div className="w-full max-w-[560px]">
            <LandingPlateInput onEngage={handleEngage} theme="light" ctaLabel="Get my offer" />
          </div>
        </motion.div>
      </section>

      {/* ── Below the fold — the marketing assets stay on the LANDING
            (reviews / process / why us). They never appear inside the
            wizard. Per the May-2026 audit: rich landing, slim flow. */}
      <section className="bg-zinc-50 border-t border-zinc-200 px-5 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-16">
            {[
              { n: "01", title: "Tell us about your car", body: "Plate or VIN, then a few quick questions." },
              { n: "02", title: "Get your offer", body: "Real cash number in under two minutes. Good for 7 days." },
              { n: "03", title: "We pick it up", body: "Free pickup at your home or work. We pay on the spot." },
            ].map((s) => (
              <div key={s.n} className="space-y-2">
                <div className="text-xs font-mono text-zinc-400 tracking-wider">{s.n}</div>
                <div className="text-lg font-semibold text-zinc-900">{s.title}</div>
                <div className="text-sm text-zinc-500 leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>

          <blockquote className="text-center max-w-2xl mx-auto">
            <p className="text-xl md:text-2xl font-medium text-zinc-700 leading-snug">
              "Easiest car sale I've ever made. Two minutes online, picked up the next day, money in my account."
            </p>
            <footer className="text-sm text-zinc-400 mt-4">
              — Customer, {config.dealership_name}
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── Canonical below-fold (reviews, 1-2-3, comparison, FAQ, etc.)
            shared with every other template. Inherits the Clarity
            light theme via CSS vars; FAQ stays collapsed by default. */}
      <FullBelowFold />

      {/* ── Fullscreen wizard — opens on plate submit, takes over the
            viewport so the marketing chrome disappears. */}
      <FullscreenWizard open={wizardOpen} onClose={() => setWizardOpen(false)} theme="light">
        <LandingForm
          variant="default"
          initial={initial ?? undefined}
          theme="light"
          loader="thin-line"
        />
      </FullscreenWizard>
    </>
  );
};

export default ClarityTemplate;
