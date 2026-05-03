import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import LandingForm from "@/components/LandingForm";

/**
 * VELOCITY — conversion-tuned, Carvana-style. Bright brand-blue
 * gradient hero, white form card centered, saturated yellow CTA for
 * ruthless contrast. ONE social-proof line + a tiny 3-step chip
 * strip — and that's it above the fold.
 *
 * Per the May-2026 sell-flow design audit: pure mass-market conversion
 * play. Speed signals competence; the page is hard, fast, and
 * unapologetically focused on the form. The running-car loading
 * animation belongs HERE (not in the other three templates).
 *
 * Best for: mass-market multi-rooftops, mainstream domestics
 * (Chevy, Ford, Hyundai), volume dealers like Ingersoll Chevrolet
 * who currently use sellmyride.com.
 */
const VelocityTemplate = () => {
  const { config } = useSiteConfig();

  // Velocity uses Carvana-blue defaults but respects dealer-customized
  // primary if set (we just darken the gradient stops a touch so the
  // form card stays high-contrast).
  const primary = "#0066CC";
  const gradientStop = "#00A6E6";
  const ctaYellow = "#FFC700";

  return (
    <>
      <section
        className="relative min-h-[88vh] flex flex-col items-center justify-center px-5 py-12 text-white"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${gradientStop} 100%)`,
        }}
      >
        {/* Headline — short, declarative, top-loaded with the offer-time anchor */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8 max-w-2xl"
        >
          <h1 className="font-display text-[34px] md:text-[52px] lg:text-[60px] font-extrabold tracking-tight leading-[1.05] text-white">
            {config.hero_headline || "Real cash offer in 2 minutes."}
          </h1>
          <p className="text-base md:text-lg text-white/90 mt-4 max-w-md mx-auto">
            {config.hero_subtext || "Tell us about your car. Get a real number. Pick up at your door."}
          </p>
        </motion.div>

        {/* Form card — white, centered, the visual focal point */}
        <motion.div
          id="sell-car-form"
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="w-full max-w-[560px] rounded-2xl bg-white shadow-2xl overflow-hidden"
          style={{
            boxShadow: "0 30px 60px -20px rgba(0,0,0,0.35), 0 0 0 4px rgba(255,255,255,0.12)",
          }}
        >
          <LandingForm variant="split" />

          {/* CTA reinforcement — saturated yellow strip below the form
              referencing what the LandingForm's submit button delivers.
              Visual anchor for the ruthlessly-contrasting yellow. */}
          <div
            className="border-t-4"
            style={{ borderColor: ctaYellow, background: `${ctaYellow}14` }}
          >
            <p className="text-center text-[13px] font-bold text-zinc-900 py-3 tracking-wide">
              Real offer in 2 minutes · Good for 7 days
            </p>
          </div>
        </motion.div>

        {/* One line of social proof — the only thing else above the fold */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-white/95 text-sm md:text-base font-medium mt-8 text-center"
        >
          We've paid sellers{" "}
          <span className="font-bold text-white" style={{ color: ctaYellow }}>
            {config.stats_cars_purchased || "$4.2B"}
          </span>{" "}
          and counting.
        </motion.p>

        {/* Tiny 3-step chip strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
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

      {/* Below the fold — minimal explainer, 7-day badge, that's it */}
      <section className="bg-zinc-50 px-5 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { n: "1", title: "Plate + state", body: "Tell us your car. We auto-find it in seconds." },
            { n: "2", title: "Quick condition Q's", body: "Five questions. Two minutes. Real cash number." },
            { n: "3", title: "Pickup or drop-off", body: "Free pickup nationwide. Money in your account same day." },
          ].map((s) => (
            <div key={s.n} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
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
    </>
  );
};

export default VelocityTemplate;
