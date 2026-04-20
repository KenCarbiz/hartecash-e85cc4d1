import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, DollarSign, Repeat, Wrench, Search } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * CAROUSEL — CDK / Sincro form factor. 16:9 hero slider with chevrons,
 * four-tile shortcut row underneath. Conservative, "bank-website energy"
 * but it's what franchise dealers expect for muscle-memory navigation.
 */
const SLIDES = [
  { kicker: "This Month",  headline: "0% APR for qualified buyers",        gradient: "from-primary to-[hsl(220,40%,18%)]" },
  { kicker: "Always",      headline: "Real cash for your trade in 2 min",  gradient: "from-[hsl(0,50%,32%)] to-[hsl(0,30%,16%)]" },
  { kicker: "Service",     headline: "Free multi-point inspection",        gradient: "from-[hsl(180,40%,28%)] to-[hsl(180,30%,16%)]" },
];

const TILES = [
  { icon: Search,     label: "Browse Cars" },
  { icon: DollarSign, label: "Sell My Car",  scrollTo: "sell-car-form" },
  { icon: Repeat,     label: "Trade Value",  href: "/trade" },
  { icon: Wrench,     label: "Service",      href: "/service" },
];

const CarouselTemplate = () => {
  const { config } = useSiteConfig();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const go = (dir: number) => setIdx((i) => (i + dir + SLIDES.length) % SLIDES.length);
  const slide = SLIDES[idx];

  return (
    <>
      {/* 16:9 slider hero */}
      <section className="relative bg-[hsl(220,30%,8%)] overflow-hidden">
        <div className="relative aspect-[16/9] max-h-[640px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={`absolute inset-0 bg-gradient-to-br ${slide.gradient}`}
            />
          </AnimatePresence>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

          <div className="relative z-10 max-w-6xl mx-auto h-full px-6 flex flex-col justify-center text-primary-foreground">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-80">{slide.kicker}</span>
            <motion.h1
              key={`h-${idx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold leading-tight mt-2 max-w-2xl"
            >
              {slide.headline}
            </motion.h1>
            <p className="text-sm md:text-base opacity-80 mt-3 max-w-xl">{config.tagline}</p>
          </div>

          {/* Chevrons */}
          <button onClick={() => go(-1)} aria-label="Previous slide" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/20 hover:bg-background/40 backdrop-blur text-primary-foreground flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(1)} aria-label="Next slide" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/20 hover:bg-background/40 backdrop-blur text-primary-foreground flex items-center justify-center">
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-primary-foreground" : "w-1.5 bg-primary-foreground/40"}`}
              />
            ))}
          </div>
        </div>

        {/* 4-tile shortcut row */}
        <div className="bg-card border-y border-border">
          <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
            {TILES.map((t) => {
              const Icon = t.icon;
              const inner = (
                <div className="flex items-center justify-center gap-2 py-5 hover:bg-muted/30 transition-colors cursor-pointer">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">{t.label}</span>
                </div>
              );
              if (t.scrollTo) {
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => document.getElementById(t.scrollTo!)?.scrollIntoView({ behavior: "smooth" })}
                  >
                    {inner}
                  </button>
                );
              }
              return <a key={t.label} href={t.href}>{inner}</a>;
            })}
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

export default CarouselTemplate;
