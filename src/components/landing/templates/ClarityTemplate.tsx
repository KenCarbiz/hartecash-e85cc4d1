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
            <LandingPlateInput
              onEngage={handleEngage}
              theme="light"
              ctaLabel="Get my offer"
              ctaColor={config.landing_cta_color || undefined}
              ctaTextColor={config.landing_cta_text_color || undefined}
              defaultLookup={config.landing_lookup_default || "vin"}
              trustLine={`★ ${config.stats_rating || "4.9"} · ${config.stats_cars_purchased || "14,721+"} cars purchased · 100% free, no obligation`}
            />
          </div>
        </motion.div>
      </section>

      {/* ── Canonical below-fold (reviews with stars, the bolder 1-2-3
            HowItWorks, comparison wedge, value props, FAQ, etc.).
            Replaces the prior inline "01/02/03" strip + curated
            testimonial that duplicated this content one fold below. */}
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
