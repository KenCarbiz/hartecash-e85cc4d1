import { motion } from "framer-motion";
import { Truck, ArrowRight, ShieldCheck } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * PICKUP — Ford / FordDirect / GM truck dealer feel. Brand-color ribbon
 * nav across the top, "truck-at-dawn" gradient hero (warm horizon,
 * silhouetted truck), twin Build / Search CTAs.
 */
const PickupTemplate = () => {
  const { config } = useSiteConfig();

  return (
    <>
      {/* Brand-color ribbon */}
      <div className="bg-primary text-primary-foreground border-b-4 border-primary/40">
        <div className="max-w-6xl mx-auto px-5 py-2 flex items-center justify-between text-xs font-semibold">
          <span className="uppercase tracking-wider">{config.dealership_name}</span>
          <span className="hidden md:inline opacity-80">{config.tagline || "Built tough since 1947"}</span>
        </div>
      </div>

      <section className="relative min-h-[80vh] flex items-end overflow-hidden">
        {/* Truck-at-dawn gradient — warm horizon top, silhouette dark bottom */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, hsl(28 80% 60%) 0%, hsl(15 60% 35%) 40%, hsl(220 30% 12%) 75%, hsl(220 40% 8%) 100%)",
          }}
        />
        {/* Silhouette truck */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-center opacity-90">
          <Truck className="w-[80%] h-[40vh] max-h-96 text-[hsl(220,50%,5%)]" strokeWidth={0.5} />
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-[hsl(220,50%,4%)]" />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-5 py-16 text-primary-foreground">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-[40px] md:text-[60px] lg:text-[78px] font-extrabold tracking-tight leading-[0.95] uppercase max-w-3xl drop-shadow-2xl"
          >
            {config.hero_headline || "Built to last. Built to trade."}
          </motion.h1>
          <p className="mt-5 text-lg max-w-xl drop-shadow text-primary-foreground/90">
            {config.hero_subtext || "Top dollar for trucks, SUVs, and work vehicles. Real cash in two minutes."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-7 py-3.5 rounded-md shadow-2xl flex items-center gap-2"
            >
              Get my cash offer <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="/trade"
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 backdrop-blur border border-primary-foreground/30 text-primary-foreground font-bold px-7 py-3.5 rounded-md"
            >
              Build a deal
            </a>
            <span className="ml-2 text-sm flex items-center gap-1.5 opacity-90">
              <ShieldCheck className="w-4 h-4 text-success" />
              {config.price_guarantee_days}-day price guarantee
            </span>
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

export default PickupTemplate;
