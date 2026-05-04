import { motion } from "framer-motion";
import { Search, ChevronDown } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import LandingForm from "@/components/LandingForm";
import { FullBelowFold } from "../sharedSections";

/**
 * MINIMAL — almost-empty hero with one giant decorative search bar that
 * scrolls down to the real form. White space dominates, single CTA, single
 * focal point. Apple-clean / Stripe-clean vibe.
 *
 * Typography: Inter (font-sans) — the national-tech-brand workhorse.
 * Stripe / Linear / Vercel / GitHub / Notion / Apple's web all ship
 * Inter for surfaces like this one. The previous version used DM
 * Serif Display (font-display) which read editorial/dealer-y rather
 * than the "minimalist national brand" feel this template wants.
 *
 * Primary CTA on Minimal is yellow (#FFD000) — Carvana's well-known
 * conversion accent. It pops against the white expanse without
 * needing oversized type or shadows.
 */
const MinimalTemplate = () => {
  const { config } = useSiteConfig();

  // Carvana-style amber/yellow. Calibrated dark enough that the black
  // CTA copy passes WCAG AA contrast against it.
  const cta = "#FFD000";
  const ctaText = "#0A0A0A";

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
      {/* Empty hero — Inter typography, one search box, that's it */}
      <section className="relative min-h-[78vh] flex flex-col items-center justify-center px-5 pt-10 pb-16 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl text-center"
        >
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-primary mb-6">
            {config.dealership_name}
          </p>
          <h1 className="font-sans text-[40px] md:text-[64px] lg:text-[80px] font-bold tracking-[-0.025em] leading-[1.02] text-foreground">
            {config.hero_headline || "What's your car worth?"}
          </h1>
          <p className="font-sans text-[15px] md:text-lg text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed">
            {config.hero_subtext || "Tell us your plate, VIN, or year-make-model. We'll have a real cash offer in two minutes."}
          </p>
        </motion.div>

        {/* Decorative search box — clicking jumps to the real form.
            National-brand layout: large rounded pill with a soft
            backplate, segmented method tags as small chips, and a
            yellow CTA pill on the right. Reads like Stripe Sell or
            Apple Trade-In rather than dealer-card. */}
        <motion.button
          type="button"
          onClick={focusForm}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="group mt-12 w-full max-w-2xl flex items-center gap-3 bg-card border border-border/70 hover:border-foreground/30 rounded-full pl-5 pr-1.5 py-1.5 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.10)] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.18)] transition-all"
          aria-label="Start your offer — opens the search form"
        >
          <Search className="w-[18px] h-[18px] text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
            <span className="font-sans text-[13px] md:text-[14px] text-muted-foreground/90 whitespace-nowrap">
              Start with
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <span className="font-sans text-[11px] md:text-[12px] font-semibold tracking-wide text-foreground/80 bg-muted/60 group-hover:bg-muted px-2.5 py-1 rounded-full transition-colors">Plate</span>
              <span className="text-muted-foreground/40 text-xs" aria-hidden>·</span>
              <span className="font-sans text-[11px] md:text-[12px] font-semibold tracking-wide text-foreground/80 bg-muted/60 group-hover:bg-muted px-2.5 py-1 rounded-full transition-colors">VIN</span>
              <span className="text-muted-foreground/40 text-xs" aria-hidden>·</span>
              <span className="font-sans text-[11px] md:text-[12px] font-semibold tracking-wide text-foreground/80 bg-muted/60 group-hover:bg-muted px-2.5 py-1 rounded-full transition-colors">Year · Make · Model</span>
            </span>
            <span className="sm:hidden font-sans text-[13px] font-medium text-foreground/80">
              Plate, VIN, or YMM
            </span>
          </div>
          <span
            className="font-sans text-[13px] md:text-sm font-bold px-5 py-3 rounded-full transition-transform group-hover:scale-[1.02] flex-shrink-0"
            style={{ background: cta, color: ctaText }}
          >
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
            <LandingForm variant="split" />
          </div>
        </div>
      </section>

      <FullBelowFold />
    </>
  );
};

export default MinimalTemplate;
