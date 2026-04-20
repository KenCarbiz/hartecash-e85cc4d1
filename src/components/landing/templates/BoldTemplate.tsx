import { ArrowRight, Shield, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * BOLD — dark cinematic, asymmetric, premium feel. Inspired by Carvana and
 * modern OEM "build & price" landing pages. Single focused CTA at the top;
 * the actual VIN/plate/YMM entry sits in a clean card immediately below
 * the fold so customers don't lose context.
 */
const BoldTemplate = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => {
    document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Asymmetric dark hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden text-primary-foreground">
        {/* Layered background */}
        <div aria-hidden className="absolute inset-0 bg-[hsl(220,30%,8%)]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top left, hsl(var(--primary) / 0.55) 0%, transparent 55%), radial-gradient(ellipse at bottom right, hsl(var(--accent) / 0.35) 0%, transparent 50%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-8"
          >
            <div className="inline-flex items-center gap-2 bg-success/15 border border-success/30 rounded-full px-3 py-1 mb-6 text-xs font-semibold tracking-wide">
              <Shield className="w-3.5 h-3.5 text-success" />
              {config.price_guarantee_days}-day price guarantee
            </div>

            <h1 className="font-display text-[44px] md:text-[68px] lg:text-[88px] font-extrabold tracking-[-0.02em] leading-[0.95]">
              {config.hero_headline || "Sell your car.\nGet paid today."}
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mt-6 max-w-2xl leading-relaxed">
              {config.hero_subtext ||
                "A real cash offer in two minutes. No haggling, no junk-mail follow-ups, no tire kickers."}
            </p>

            <button
              onClick={scrollToForm}
              className="mt-9 inline-flex items-center gap-3 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base px-8 py-4 rounded-full shadow-2xl transition-all hover:scale-[1.02]"
            >
              Get my cash offer
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>

          {/* Right: floating proof column */}
          <motion.aside
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            className="lg:col-span-4 lg:pl-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="font-bold">{config.stats_rating || "4.9"}</span>
              <span className="text-primary-foreground/60">·</span>
              <span className="text-primary-foreground/70">{config.stats_reviews_count || "2,400+"} reviews</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 backdrop-blur p-4">
                <div className="text-2xl font-extrabold tracking-tight">{config.stats_cars_purchased || "14,721+"}</div>
                <div className="text-[11px] text-primary-foreground/60 uppercase tracking-wider mt-0.5">Cars purchased</div>
              </div>
              <div className="rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 backdrop-blur p-4">
                <div className="text-2xl font-extrabold tracking-tight">{config.stats_years_in_business || "78 yrs"}</div>
                <div className="text-[11px] text-primary-foreground/60 uppercase tracking-wider mt-0.5">In business</div>
              </div>
            </div>
          </motion.aside>
        </div>
      </section>

      {/* Form sits on a contrasting light section directly below */}
      <section id="sell-car-form" className="bg-background py-16 lg:py-24 px-5 -mt-16 relative z-20">
        <div className="max-w-[600px] mx-auto">
          <div className="rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)] border border-border overflow-hidden">
            <SellCarForm variant="split" />
          </div>
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default BoldTemplate;
