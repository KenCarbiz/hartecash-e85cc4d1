import { motion } from "framer-motion";
import { Play, Car, ArrowRight } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * CINEMA — Dealer Inspire / Toyota T3 / Honda HDDP visual.
 * Full-bleed cinematic hero with a charcoal gradient overlay, model
 * "ribbon" strip below, and a sticky payment widget anchor in the corner.
 */
const CinemaTemplate = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" });

  // Decorative model ribbon — every template gets the same six placeholder
  // categories so dealers don't need real inventory wiring.
  const ribbon = ["SUV", "Truck", "Sedan", "EV", "Hybrid", "Used"];

  return (
    <>
      <section className="relative min-h-[88vh] overflow-hidden text-primary-foreground">
        {/* Layered cinematic background */}
        <div aria-hidden className="absolute inset-0 bg-[hsl(220,30%,8%)]" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at center, hsl(var(--primary) / 0.45) 0%, transparent 65%), linear-gradient(to bottom, transparent 30%, hsl(220 30% 8% / 0.8) 100%)",
          }}
        />
        {/* Faux play-button motif (decorative, not a real video) */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 0.15, scale: 1 }}
          transition={{ duration: 1.2 }}
          className="absolute right-[8%] top-1/3 hidden md:block"
        >
          <div className="w-32 h-32 rounded-full border border-primary-foreground/30 flex items-center justify-center">
            <Play className="w-12 h-12 text-primary-foreground/40" />
          </div>
        </motion.div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-40 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-[44px] md:text-[64px] lg:text-[84px] font-extrabold tracking-tight leading-[0.95] uppercase"
          >
            {config.hero_headline || "Your next car starts here."}
          </motion.h1>
          <p className="text-base md:text-lg text-primary-foreground/85 mt-6 max-w-2xl mx-auto leading-relaxed">
            {config.hero_subtext || "Sell us yours, browse ours, build a deal — all in two minutes."}
          </p>
          <button
            onClick={scrollToForm}
            className="mt-9 inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-8 py-3.5 rounded-full shadow-2xl transition-all hover:scale-[1.02]"
          >
            Get my cash offer <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Model ribbon strip pinned to the bottom of hero */}
        <div className="absolute bottom-0 inset-x-0 bg-[hsl(220,30%,5%)]/90 backdrop-blur border-t border-primary-foreground/10">
          <div className="max-w-6xl mx-auto px-4 py-3 overflow-x-auto">
            <ul className="flex gap-2 min-w-max">
              {ribbon.map((m) => (
                <li
                  key={m}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 text-sm font-semibold text-primary-foreground/80 hover:text-primary-foreground hover:border-primary-foreground/30 cursor-default"
                >
                  <Car className="w-3.5 h-3.5" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="sell-car-form" className="bg-background py-20 px-5">
        <div className="max-w-[600px] mx-auto rounded-2xl shadow-xl border border-border overflow-hidden">
          <SellCarForm variant="split" />
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default CinemaTemplate;
