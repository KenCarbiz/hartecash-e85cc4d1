import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import LandingForm from "@/components/LandingForm";

/**
 * CLARITY — Apple-minimal white. Single centered form on plain white,
 * massive negative space, big display headline. The form IS the hero;
 * no stock car photo, no marketing rails competing for attention.
 *
 * Per the May-2026 sell-flow design audit (docs/sell-flow-design-audit.md):
 * deliberately omits the stock-car hero, "why sell to us" icon wall,
 * and FAQ-above-the-fold patterns that read mom-and-pop. Below the
 * fold gets ONE 3-step strip and ONE customer quote — that's the
 * ceiling. No collapsible FAQ, no map, no hours.
 *
 * Best for: premium import single-rooftops, EV dealers, design-literate
 * customers (Tesla-adjacent, Honda/Toyota suburban premium).
 */
const ClarityTemplate = () => {
  const { config } = useSiteConfig();

  return (
    <>
      {/* Above the fold — only the form. Nothing else. */}
      <section className="relative min-h-[88vh] flex items-center justify-center px-5 py-16 bg-white text-zinc-900">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="w-full max-w-[560px] flex flex-col items-center gap-10"
        >
          {/* Headline — huge, tight, single weight */}
          <div className="text-center space-y-4">
            <h1 className="font-display text-[44px] md:text-[64px] lg:text-[72px] font-bold tracking-[-0.025em] leading-[1.02] text-zinc-900">
              {config.hero_headline || "Sell your car in 2 minutes."}
            </h1>
            <p className="text-base md:text-lg text-zinc-500 max-w-md mx-auto leading-relaxed">
              {config.hero_subtext || "Real cash offer. No haggling. Picked up at your door."}
            </p>
          </div>

          {/* The form — minimal card, no shadow flourishes */}
          <div
            id="sell-car-form"
            className="w-full rounded-3xl bg-zinc-50 border border-zinc-200 p-1.5"
          >
            <div className="rounded-[20px] bg-white p-1">
              <LandingForm variant="split" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Below the fold — one 3-step strip, one customer quote, full stop. */}
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
    </>
  );
};

export default ClarityTemplate;
