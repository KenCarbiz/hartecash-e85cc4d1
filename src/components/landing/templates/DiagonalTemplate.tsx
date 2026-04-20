import { motion } from "framer-motion";
import { Car, ArrowRight } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * DIAGONAL — DealerSocket / DealerFire signature. A diagonal accent-color
 * block slices across a vehicle photo placeholder; chunky rounded buttons;
 * one italic accent word breaks up an otherwise heavy display sans.
 */
const DiagonalTemplate = () => {
  const { config } = useSiteConfig();

  return (
    <>
      <section className="relative bg-background overflow-hidden">
        {/* Diagonal accent slash — pure CSS, no SVG mask needed */}
        <div
          aria-hidden
          className="absolute inset-0 bg-accent"
          style={{ clipPath: "polygon(0 0, 60% 0, 35% 100%, 0% 100%)" }}
        />
        {/* Right-side photo placeholder */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-[60%] bg-gradient-to-bl from-[hsl(220,30%,18%)] to-[hsl(220,40%,10%)]"
          style={{ clipPath: "polygon(40% 0, 100% 0, 100% 100%, 15% 100%)" }}
        >
          <div className="absolute inset-0 flex items-end justify-end pb-10 pr-12 opacity-40">
            <Car className="w-2/3 h-2/3 text-primary-foreground" strokeWidth={0.5} />
          </div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 lg:py-28">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-[44px] md:text-[64px] lg:text-[78px] font-extrabold leading-[0.98] text-accent-foreground max-w-2xl"
          >
            Cash for cars.{" "}
            <span className="italic font-light">Done right.</span>
          </motion.h1>
          <p className="mt-5 max-w-md text-base lg:text-lg text-accent-foreground/80">
            {config.hero_subtext || "Real numbers, real-time, no haggling."}
          </p>
          <button
            onClick={() => document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-9 inline-flex items-center gap-2 bg-foreground hover:bg-foreground/90 text-background font-bold text-base px-8 py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.02]"
          >
            Get My Offer <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <section id="sell-car-form" className="bg-muted/30 py-16 px-5">
        <div className="max-w-[560px] mx-auto rounded-2xl bg-card shadow border border-border overflow-hidden">
          <SellCarForm variant="split" />
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default DiagonalTemplate;
