import { motion } from "framer-motion";
import { Tag, Car, ArrowRight, Flame } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * CIRCULAR — "Dealership Circular" / Force Marketing energy. Yellow/red
 * incentive bursts, payment-per-month chips, vehicle cutout on a vibrant
 * gradient. Loud, promo-heavy, conversion-driven.
 */
const CircularTemplate = () => {
  const { config } = useSiteConfig();

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(0,75%,50%)] via-[hsl(15,80%,52%)] to-[hsl(40,90%,55%)] text-white">
        <div aria-hidden className="absolute inset-0 opacity-10" style={{
          backgroundImage: "repeating-linear-gradient(45deg, white 0 2px, transparent 2px 18px)",
        }} />

        <div className="relative max-w-6xl mx-auto px-5 py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: promo copy */}
          <div className="lg:col-span-7 relative">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: -8 }}
              transition={{ duration: 0.4 }}
              className="absolute -top-4 -left-2 bg-yellow-300 text-foreground font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1"
            >
              <Flame className="w-3.5 h-3.5" /> Top dollar event
            </motion.div>

            <h1 className="font-display text-[44px] md:text-[64px] lg:text-[78px] font-extrabold leading-[0.95] tracking-tight uppercase drop-shadow-md">
              We&apos;ll pay <span className="bg-yellow-300 text-foreground px-2 inline-block transform -rotate-1">$2,000 more</span> than the other guys.
            </h1>
            <p className="mt-5 text-lg max-w-xl drop-shadow font-medium">
              Get a real cash offer in 2 minutes. Bring it to us — beat it or we pay you the difference.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { kicker: "From", val: "$0", body: "Down payment options" },
                { kicker: "Up to", val: `$${(config.ppt_guarantee_amount || 3000).toLocaleString()}`, body: "Guaranteed trade min" },
                { kicker: "0%", val: "APR", body: "Qualified buyers" },
              ].map((c) => (
                <div key={c.body} className="bg-white/95 text-foreground rounded-xl px-4 py-2.5 shadow-md min-w-[140px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.kicker}</div>
                  <div className="text-2xl font-extrabold tracking-tight">{c.val}</div>
                  <div className="text-[10px] text-muted-foreground">{c.body}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" })}
              className="mt-7 inline-flex items-center gap-2 bg-yellow-300 hover:bg-yellow-200 text-foreground font-bold text-base px-7 py-3.5 rounded-full shadow-2xl transition-all hover:scale-[1.02]"
            >
              Lock in my offer <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right: vehicle cutout placeholder + price-tag burst */}
          <div className="lg:col-span-5 relative hidden lg:block">
            <div className="relative bg-white/15 backdrop-blur rounded-3xl aspect-square flex items-center justify-center overflow-hidden">
              <Car className="w-2/3 h-2/3 text-white/80" strokeWidth={0.4} />
              <div className="absolute top-6 right-6 bg-yellow-300 text-foreground font-extrabold rounded-full w-28 h-28 flex flex-col items-center justify-center shadow-2xl transform rotate-12">
                <span className="text-[10px] uppercase tracking-wider">Your offer</span>
                <Tag className="w-5 h-5 mt-0.5" />
                <span className="text-[10px] mt-0.5 opacity-70">in 2 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="sell-car-form" className="bg-background py-16 px-5">
        <div className="max-w-[560px] mx-auto rounded-2xl shadow-lg border border-border overflow-hidden">
          <SellCarForm variant="split" />
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default CircularTemplate;
