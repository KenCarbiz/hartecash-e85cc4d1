import { motion } from "framer-motion";
import { ArrowRight, Car } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * MAGAZINE — Stream Companies / Lincoln editorial. Full-width photo
 * placeholder, oversized left-aligned headline with a thin underline,
 * kicker text above. Feels like an automotive print ad.
 */
const MagazineTemplate = () => {
  const { config } = useSiteConfig();

  return (
    <>
      {/* Full-width photo "spread" */}
      <section className="relative bg-[hsl(40,15%,93%)]">
        <div className="relative h-[55vh] min-h-[420px] overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: "linear-gradient(120deg, hsl(220 30% 15%) 0%, hsl(220 30% 25%) 50%, hsl(40 30% 50%) 100%)",
            }}
          />
          <div aria-hidden className="absolute inset-0 flex items-center justify-end pr-12 opacity-25">
            <Car className="w-[55%] h-[60%] text-[hsl(40,30%,90%)]" strokeWidth={0.3} />
          </div>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[hsl(40,15%,93%)]/60 via-transparent to-transparent" />
        </div>

        {/* Headline overflows up into the photo, like a magazine layout */}
        <div className="relative -mt-32 max-w-6xl mx-auto px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl bg-[hsl(40,15%,93%)] pt-8 pr-8"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary">Issue No. {new Date().getFullYear()}</span>
            <h1 className="font-display text-[40px] md:text-[60px] lg:text-[80px] font-extrabold leading-[1.0] tracking-[-0.01em] mt-4 text-foreground">
              {config.hero_headline || "The shortest distance between owning a car and getting paid for it."}
            </h1>
            <div className="h-px w-24 bg-foreground/40 mt-7" aria-hidden />
            <p className="text-base md:text-lg text-muted-foreground mt-4 max-w-xl leading-relaxed italic">
              {config.hero_subtext || "Two minutes, one number, no theatrics. That's the whole pitch."}
            </p>
            <button
              onClick={() => document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" })}
              className="mt-8 inline-flex items-center gap-2 text-foreground font-bold border-b-2 border-foreground hover:gap-3 transition-all pb-1"
            >
              Begin <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      <section id="sell-car-form" className="bg-background py-16 px-5">
        <div className="max-w-[560px] mx-auto rounded-2xl shadow border border-border overflow-hidden">
          <SellCarForm variant="split" />
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default MagazineTemplate;
