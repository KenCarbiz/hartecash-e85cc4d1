import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import LandingForm from "@/components/LandingForm";

/**
 * MARQUEE — premium dark / luxury. Full-bleed near-black hero with
 * the dealer wordmark large top-center, serif headline, and a charcoal
 * form card with brass-edged input. Built for rooftops where the
 * dealer's brand IS a flex (BMW, Audi, Lexus, Porsche, Mercedes,
 * family-owned luxury groups).
 *
 * Per the May-2026 sell-flow design audit. Slow elegant easing
 * (350ms cubic-bezier) on transitions; brass accent only, no shouty
 * yellows. Optional 8% silhouette of a luxury car behind the form.
 */
const MarqueeTemplate = () => {
  const { config } = useSiteConfig();

  return (
    <>
      {/* Hero — full-bleed near-black, dealer wordmark prominent */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center px-5 py-16 overflow-hidden bg-[#0F0F12] text-white">
        {/* Faint radial light behind the form for depth */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(201,169,110,0.10) 0%, rgba(15,15,18,0) 55%)",
          }}
        />

        {/* Wordmark header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 mb-12 text-center"
        >
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt={config.dealership_name}
              className="h-12 md:h-16 mx-auto mb-4 brightness-0 invert opacity-95"
            />
          ) : (
            <div className="font-serif text-3xl md:text-4xl tracking-wider text-white/95 mb-4">
              {config.dealership_name}
            </div>
          )}
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 text-center mb-10 max-w-2xl"
        >
          <h1 className="font-serif text-[36px] md:text-[52px] lg:text-[60px] font-normal tracking-[-0.01em] leading-[1.05] text-white">
            {config.hero_headline || "A precise valuation. Within minutes."}
          </h1>
          <p className="text-base md:text-lg text-white/60 mt-5 max-w-md mx-auto font-light">
            {config.hero_subtext ||
              "We buy luxury vehicles at full market price, and we make it effortless."}
          </p>
        </motion.div>

        {/* Form card — charcoal with brass edge */}
        <motion.div
          id="sell-car-form"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[560px]"
        >
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(180deg, #1A1A1F 0%, #0F0F12 100%)",
              border: "1px solid #2A2A2E",
              boxShadow: "0 0 0 1px rgba(201,169,110,0.18) inset, 0 30px 60px -20px rgba(0,0,0,0.6)",
            }}
          >
            <div className="p-1">
              <div className="rounded-xl bg-[#0F0F12]">
                <LandingForm variant="split" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Trust line — single sentence, brass accent */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="relative z-10 text-center text-[13px] text-white/50 mt-8 font-light tracking-wide"
        >
          Trusted by{" "}
          <span style={{ color: "#C9A96E" }} className="font-medium">
            {config.dealership_name}
          </span>
          {config.established_year ? ` since ${config.established_year}.` : "."}
        </motion.p>
      </section>

      {/* Below the fold — quiet, luxury-restrained */}
      <section className="bg-[#0A0A0C] text-white/85 px-5 py-20 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { title: "Precise valuation", body: "Real market data, not a generic guide. Premium vehicles priced like premium vehicles." },
              { title: "Discreet handling", body: "We come to you. No queue, no showroom. Concierge from offer to title." },
              { title: "Full market price", body: "We pay what your car is worth. No 'we buy any car' lowballing." },
            ].map((s) => (
              <div key={s.title} className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.2em]" style={{ color: "#C9A96E" }}>
                  {s.title}
                </div>
                <div className="text-sm text-white/70 leading-relaxed font-light">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default MarqueeTemplate;
