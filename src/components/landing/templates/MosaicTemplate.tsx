import { motion } from "framer-motion";
import { Car, Truck, Zap, Users, Sparkles, ArrowRight } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * MOSAIC — Jazel-style: no big hero photo. A model-category mosaic IS the
 * hero. Light mode, performance-first, light shadows, large hit targets.
 */
const TILES = [
  { icon: Car,      label: "SUVs",     desc: "Mid-size + 3-row", tone: "bg-primary/10 text-primary" },
  { icon: Truck,    label: "Trucks",   desc: "Half-ton + work",  tone: "bg-accent/10 text-accent" },
  { icon: Users,    label: "Sedans",   desc: "Family + commuter", tone: "bg-primary/10 text-primary" },
  { icon: Zap,      label: "EVs",      desc: "All-electric",     tone: "bg-success/10 text-success" },
  { icon: Sparkles, label: "Hybrids",  desc: "Best of both",     tone: "bg-primary/10 text-primary" },
  { icon: Car,      label: "Used",     desc: "Pre-owned, certified", tone: "bg-muted text-foreground" },
];

const MosaicTemplate = () => {
  const { config } = useSiteConfig();

  return (
    <>
      <section className="bg-background pt-12 pb-10 px-5">
        <div className="max-w-6xl mx-auto">
          {/* Compact headline (no photo) */}
          <div className="text-center mb-10">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
              {config.dealership_name}
            </span>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-display text-[32px] md:text-[44px] lg:text-[56px] font-extrabold tracking-tight mt-3 max-w-3xl mx-auto leading-tight"
            >
              {config.hero_headline || "Sell yours. Browse ours. Two minutes either way."}
            </motion.h1>
          </div>

          {/* Model mosaic */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TILES.map((t, i) => {
              const Icon = t.icon;
              return (
                <motion.div
                  key={t.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  className="group rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all p-5 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.tone}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-card-foreground mt-3">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-3" />
                </motion.div>
              );
            })}
          </div>

          {/* Sell CTA strip across the bottom */}
          <div className="mt-8 rounded-2xl bg-primary text-primary-foreground p-5 md:p-7 flex flex-col md:flex-row items-center justify-between gap-4 shadow">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Selling, not buying?</div>
              <div className="font-bold text-xl md:text-2xl mt-1">Get a real cash offer in 2 minutes</div>
            </div>
            <button
              onClick={() => document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-6 py-3 rounded-full flex items-center gap-2 whitespace-nowrap"
            >
              Get my offer <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section id="sell-car-form" className="bg-muted/30 py-14 px-5">
        <div className="max-w-[560px] mx-auto rounded-2xl bg-card shadow border border-border overflow-hidden">
          <SellCarForm variant="split" />
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default MosaicTemplate;
