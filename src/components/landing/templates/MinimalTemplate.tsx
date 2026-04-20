import { motion } from "framer-motion";
import { Search, ChevronDown } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * MINIMAL — almost-empty hero with one giant decorative search bar that
 * scrolls down to the real form. White space dominates, single CTA, single
 * focal point. Apple-clean / Google-for-cars vibe. The full SellCarForm
 * (which already supports VIN, plate+state, and YMM) sits one fold down.
 */
const MinimalTemplate = () => {
  const { config } = useSiteConfig();

  const focusForm = () => {
    document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const firstInput = document.querySelector<HTMLInputElement | HTMLButtonElement>(
        "#sell-car-form input, #sell-car-form [role=combobox]",
      );
      firstInput?.focus();
    }, 450);
  };

  return (
    <>
      {/* Empty hero — typography + one search box, that's it */}
      <section className="relative min-h-[78vh] flex flex-col items-center justify-center px-5 pt-10 pb-16 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-5">
            {config.dealership_name}
          </p>
          <h1 className="font-display text-[36px] md:text-[56px] lg:text-[72px] font-extrabold tracking-tight leading-[1.05] text-foreground">
            {config.hero_headline || "What's your car worth?"}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-5 max-w-xl mx-auto">
            {config.hero_subtext || "Tell us your plate, VIN, or year-make-model. We'll have a real cash offer in two minutes."}
          </p>
        </motion.div>

        {/* Decorative search box — clicking jumps the user to the real form */}
        <motion.button
          type="button"
          onClick={focusForm}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="group mt-10 w-full max-w-2xl flex items-center gap-4 bg-card border-2 border-border hover:border-primary/50 rounded-full pl-6 pr-2 py-2 shadow-sm hover:shadow-md transition-all"
        >
          <Search className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="flex-1 text-left text-base text-muted-foreground">
            <span className="font-mono">Plate</span> &middot; <span className="font-mono">VIN</span> &middot; or <span className="font-mono">Year &middot; Make &middot; Model</span>
          </span>
          <span className="bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-full">
            Get my cash offer
          </span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55, y: [0, 6, 0] }}
          transition={{ opacity: { delay: 1, duration: 0.5 }, y: { repeat: Infinity, duration: 2 } }}
          className="mt-12 text-muted-foreground"
          aria-hidden
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </section>

      {/* The real form — minimal-card styling, no extra chrome */}
      <section id="sell-car-form" className="bg-muted/30 px-5 py-16 lg:py-24">
        <div className="max-w-[560px] mx-auto">
          <div className="rounded-2xl bg-card shadow-md border border-border overflow-hidden">
            <SellCarForm variant="split" />
          </div>
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default MinimalTemplate;
