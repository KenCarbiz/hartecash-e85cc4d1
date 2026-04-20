import { ChevronDown, Shield, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

const VideoTemplate = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => {
    document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Cinematic full-bleed hero.
          Background is a layered gradient today; a dealer-uploaded video/image
          can drop in here later by swapping the <div> for <video autoplay muted loop>. */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden text-primary-foreground">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary via-[hsl(210,100%,22%)] to-[hsl(220,80%,10%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 40%, hsla(0,0%,100%,0.25), transparent 55%), radial-gradient(circle at 70% 70%, hsla(200,100%,60%,0.3), transparent 50%)",
          }}
        />
        <div aria-hidden className="absolute inset-0 bg-black/25" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-4xl mx-auto px-6 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-success/20 backdrop-blur-sm border border-success/40 rounded-full px-5 py-1.5 mb-6">
            <Shield className="w-4 h-4 text-success fill-success/30" />
            <span className="text-xs font-bold tracking-wide">
              {config.price_guarantee_days}-DAY PRICE GUARANTEE
            </span>
          </div>

          <h1 className="font-display text-[40px] md:text-[56px] lg:text-[72px] font-extrabold tracking-tight leading-[1.05] mb-6 uppercase">
            {config.hero_headline || "Sell Your Car The Easy Way"}
          </h1>
          <p className="text-lg md:text-xl opacity-90 mb-10 max-w-2xl mx-auto leading-relaxed">
            {config.hero_subtext || "Get a top-dollar cash offer in 2 minutes. No haggling, no stress."}
          </p>

          <button
            onClick={scrollToForm}
            className="inline-flex items-center gap-3 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg px-10 py-5 rounded-full shadow-2xl transition-all hover:scale-[1.03]"
          >
            Get My Cash Offer
            <ChevronDown className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-center gap-3 mt-8 opacity-90">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-sm font-semibold">
              {config.stats_rating || "4.9"} · {config.stats_reviews_count || "2,400+"} reviews
            </span>
          </div>
        </motion.div>

        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7, y: [0, 10, 0] }}
          transition={{ opacity: { delay: 1.2, duration: 0.6 }, y: { repeat: Infinity, duration: 2 } }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </section>

      {/* Form section — full-width card on muted background */}
      <section id="sell-car-form" className="py-16 lg:py-24 px-5 bg-muted/30">
        <div className="max-w-[560px] mx-auto">
          <div className="text-center mb-6">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-primary/70 mb-2">
              Start Here
            </span>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold">
              Get Your Offer in 2 Minutes
            </h2>
          </div>
          <div className="rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)]">
            <SellCarForm variant="split" />
          </div>
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default VideoTemplate;
