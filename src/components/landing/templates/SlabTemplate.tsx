import { Search, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * SLAB — DealerOn / Overfuel conversion-first. The search bar is THE hero.
 * Translucent dark overlay on a single muted backdrop, oversized headline,
 * twin pill CTAs. Fast LCP, no narrative.
 */
const SlabTemplate = () => {
  const { config } = useSiteConfig();

  const focusForm = () => {
    document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => {
      const i = document.querySelector<HTMLInputElement>("#sell-car-form input");
      i?.focus();
    }, 400);
  };

  return (
    <>
      <section className="relative min-h-[78vh] flex items-center text-primary-foreground overflow-hidden">
        {/* Single muted photographic backdrop placeholder */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[hsl(220,30%,20%)] via-[hsl(220,30%,12%)] to-[hsl(220,40%,8%)]" />
        <div aria-hidden className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 max-w-4xl mx-auto px-5 w-full text-center">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-[40px] md:text-[60px] lg:text-[72px] font-extrabold leading-[1.05]"
          >
            {config.hero_headline || "Find your car. Sell yours. Done in two minutes."}
          </motion.h1>

          {/* Sticky-feel search bar — the hero CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-10 bg-background rounded-2xl shadow-2xl flex items-center gap-2 p-2"
          >
            <div className="flex-1 flex items-center gap-3 px-4 py-3 text-foreground">
              <Search className="w-5 h-5 text-primary" />
              <input
                type="text"
                placeholder="Plate, VIN, or Year-Make-Model"
                className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground"
                onClick={focusForm}
                onFocus={focusForm}
                readOnly
              />
            </div>
            <button
              onClick={focusForm}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-xl flex items-center gap-2"
            >
              Get my offer <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Twin pill CTAs */}
          <div className="flex items-center justify-center gap-3 mt-6 text-sm">
            <button onClick={focusForm} className="bg-primary-foreground/10 hover:bg-primary-foreground/15 backdrop-blur border border-primary-foreground/20 px-5 py-2 rounded-full font-semibold">
              Sell my car
            </button>
            <a href="/trade" className="bg-primary-foreground/10 hover:bg-primary-foreground/15 backdrop-blur border border-primary-foreground/20 px-5 py-2 rounded-full font-semibold">
              Value my trade
            </a>
          </div>
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

export default SlabTemplate;
