import { useState } from "react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import LandingForm from "@/components/LandingForm";
import LandingPlateInput, { type LandingPlateInputValue } from "../LandingPlateInput";
import FullscreenWizard from "../FullscreenWizard";
import { FullBelowFold } from "../sharedSections";

/**
 * VELOCITY — conversion-tuned, Carvana-style with Tier B prestige
 * polish per the May-2026 luxury design audit. Bright brand-blue
 * gradient hero, white form card, and the moment the customer engages
 * the FullscreenWizard takes over the viewport — all marketing chrome
 * disappears.
 *
 * Tier B motion: cubic-bezier(0.16, 1, 0.3, 1) "expo out" at 450ms.
 * Sharper than Tier A but still premium — no springs, no bounces.
 *
 * The running-car loading animation (when wired to the offer compute
 * step inside the wizard) belongs HERE, not in the other three.
 *
 * Best for: mass-market multi-rooftops, mainstream domestics
 * (Chevy, Ford, Hyundai), volume dealers like Ingersoll Chevrolet
 * who currently use sellmyride.com.
 */
const VelocityTemplate = () => {
  const { config } = useSiteConfig();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initial, setInitial] = useState<LandingPlateInputValue | null>(null);

  const handleEngage = (value: LandingPlateInputValue) => {
    setInitial(value);
    setWizardOpen(true);
  };

  const primary = "#0066CC";
  const gradientStop = "#00A6E6";

  return (
    <>
      <section
        className="relative min-h-[88vh] flex flex-col items-center justify-center px-5 py-12 text-white"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${gradientStop} 100%)`,
        }}
      >
        {/* Headline — Tier B sharp grotesk feel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10 max-w-2xl"
        >
          <h1 className="font-sans text-[34px] md:text-[52px] lg:text-[60px] font-semibold tracking-[-0.02em] leading-[1.05] text-white">
            {config.hero_headline || "Real cash offer in 2 minutes."}
          </h1>
          <p className="font-sans text-base md:text-lg text-white/85 mt-4 max-w-md mx-auto font-light">
            {config.hero_subtext || "Tell us about your car. Get a real number. Pick up at your door."}
          </p>
        </motion.div>

        {/* Plate input — light theme on white card */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[560px] rounded-2xl bg-white p-6"
          style={{
            boxShadow:
              "0 30px 60px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)",
          }}
        >
          <LandingPlateInput
            onEngage={handleEngage}
            theme="light"
            ctaLabel="Get real offer"
            defaultLookup={config.landing_lookup_default || "plate"}
            trustLine={`★ ${config.stats_rating || "4.9"} · ${config.stats_cars_purchased || "14,721+"} sellers paid · Free pickup nationwide`}
          />
        </motion.div>

        {/* One line of social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-white/95 text-sm md:text-base font-medium mt-8 text-center"
        >
          We've paid sellers{" "}
          <span className="font-bold text-white">
            {config.stats_cars_purchased || "$4.2B"}
          </span>{" "}
          and counting.
        </motion.p>

        {/* Tiny 3-step chip strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 md:gap-3 mt-4 flex-wrap justify-center"
        >
          {["Plate or VIN", "30-second offer", "Pickup at your door"].map((s, i) => (
            <span
              key={s}
              className="text-[11px] md:text-xs font-semibold text-white bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5"
            >
              <span className="opacity-70 mr-1">{i + 1}</span>
              {s}
            </span>
          ))}
        </motion.div>
      </section>

      {/* Below the fold — minimal explainer; lives only on the LANDING.
          Disappears entirely once the customer engages. */}
      <section className="bg-zinc-50 px-5 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { n: "1", title: "Plate + state", body: "Tell us your car. We auto-find it in seconds." },
            { n: "2", title: "Quick condition Q's", body: "Five questions. Two minutes. Real cash number." },
            { n: "3", title: "Pickup or drop-off", body: "Free pickup nationwide. Money in your account same day." },
          ].map((s) => (
            <div key={s.n} className="bg-white rounded-2xl border border-zinc-200 p-6">
              <div
                className="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center mb-3 text-sm"
                style={{ background: primary }}
              >
                {s.n}
              </div>
              <div className="text-base font-bold text-zinc-900 mb-1">{s.title}</div>
              <div className="text-sm text-zinc-600 leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Canonical below-fold marketing chrome shared with every
          template (reviews, 1-2-3, comparison, FAQ collapsed). The
          FullscreenWizard hides this during the customer journey
          via fixed-position overlay + body-scroll lock. */}
      <FullBelowFold />

      {/* Fullscreen wizard — light theme, blue accent */}
      <FullscreenWizard open={wizardOpen} onClose={() => setWizardOpen(false)} theme="light" accent={primary}>
        <LandingForm
          variant="default"
          initial={initial ?? undefined}
          theme="light"
          loader="running-car"
          accent={primary}
        />
      </FullscreenWizard>
    </>
  );
};

export default VelocityTemplate;
