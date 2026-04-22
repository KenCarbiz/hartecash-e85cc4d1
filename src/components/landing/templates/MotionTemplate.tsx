import { motion } from "framer-motion";
import { MessageCircle, ArrowRight } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * MOTION — fusionZONE energy. Animated SVG shapes drift behind a
 * mid-weight headline; teal/orange accents on a dark navy field; a
 * conspicuous chat-bubble trigger floats bottom-right.
 */
const MotionTemplate = () => {
  const { config } = useSiteConfig();

  return (
    <>
      <section className="relative min-h-[80vh] flex items-center overflow-hidden bg-[hsl(220,40%,10%)] text-primary-foreground">
        {/* Drifting SVG shapes */}
        <svg aria-hidden viewBox="0 0 1200 600" className="absolute inset-0 w-full h-full opacity-50">
          <defs>
            <radialGradient id="m-teal" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="hsl(180 70% 55%)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="hsl(180 70% 55%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="m-orange" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="hsl(20 90% 60%)" stopOpacity="0.65" />
              <stop offset="100%" stopColor="hsl(20 90% 60%)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <motion.circle
            cx="220" cy="180" r="220" fill="url(#m-teal)"
            animate={{ cx: [200, 320, 240, 200], cy: [180, 230, 150, 180] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx="980" cy="430" r="280" fill="url(#m-orange)"
            animate={{ cx: [980, 880, 1020, 980], cy: [430, 380, 470, 430] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx="600" cy="520" r="180" fill="url(#m-teal)"
            animate={{ cx: [600, 520, 660, 600], cy: [520, 480, 540, 520] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>

        <div className="relative z-10 max-w-5xl mx-auto px-5 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[hsl(180,70%,55%)]/15 border border-[hsl(180,70%,55%)]/30 rounded-full px-4 py-1 text-xs font-semibold tracking-wider mb-7"
          >
            <span className="w-2 h-2 rounded-full bg-[hsl(180,70%,55%)] animate-pulse" />
            Live appraisers online
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-[40px] md:text-[60px] lg:text-[72px] font-bold leading-[1.05] tracking-tight"
          >
            Your offer, in motion.
          </motion.h1>
          <p className="mt-5 text-base md:text-lg max-w-2xl mx-auto opacity-85">
            {config.hero_subtext || "Type, scan, or chat your way to a real cash offer. We meet you where you are."}
          </p>

          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              onClick={() => document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-[hsl(20,90%,60%)] hover:bg-[hsl(20,90%,55%)] text-foreground font-bold px-7 py-3.5 rounded-full shadow-2xl flex items-center gap-2"
            >
              Get my offer <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="bg-primary-foreground/8 backdrop-blur border border-primary-foreground/20 hover:border-primary-foreground/40 px-7 py-3.5 rounded-full font-semibold flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> Chat with us
            </button>
          </div>
        </div>

        {/* Floating chat trigger */}
        <button
          type="button"
          aria-label="Open chat"
          className="absolute bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-[hsl(20,90%,60%)] hover:bg-[hsl(20,90%,55%)] text-foreground shadow-2xl flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
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

export default MotionTemplate;
