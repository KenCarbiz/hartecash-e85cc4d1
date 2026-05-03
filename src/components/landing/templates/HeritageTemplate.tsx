import { useState } from "react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import LandingForm from "@/components/LandingForm";
import LandingPlateInput, { type LandingPlateInputValue } from "../LandingPlateInput";
import FullscreenWizard from "../FullscreenWizard";

/**
 * HERITAGE — storytelling / family-dealer. Two-column desktop, stacked
 * mobile. Left: a real photo of the dealership family / showroom (NOT
 * a stock car). Right: form card. Humanist serif headline, warm color
 * palette, single trust line referencing the dealer's history.
 *
 * Per the May-2026 sell-flow design audit: for dealers who win on
 * relationship, not flash. The photo is authentic — lifestyle, not
 * stock. One photo. No carousel. No press logos. The dealer's
 * identity stays present without blocking the form.
 *
 * Falls back to a parchment-card if no logo / about-photo set.
 *
 * Best for: single-rooftop family dealers, regional chains in
 * small/mid markets where personal trust matters more than speed.
 */
const HeritageTemplate = () => {
  const { config } = useSiteConfig();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initial, setInitial] = useState<LandingPlateInputValue | null>(null);

  const handleEngage = (value: LandingPlateInputValue) => {
    setInitial(value);
    setWizardOpen(true);
  };

  // Warm palette anchors — dealer can override via Branding admin
  // (top_bar_bg, customer_file_accent), but defaults are intentionally
  // family-dealer warm: deep navy + warm off-white + brick accent.
  const primary = (config as any).primary_color
    ? `hsl(${(config as any).primary_color})`
    : "#1F4068";
  const offWhite = "#F4EFE6";
  const ink = "#2C2A26";
  const accent = "#A3886B";

  // The hero image — falls back to a colored card with the wordmark
  // when no about-photo is set (most dealers won't upload one initially).
  const heroPhoto =
    (config as any).about_hero_photo_url ||
    config.logo_white_url ||
    null;
  const established = config.established_year || null;

  return (
    <>
      <section
        className="relative min-h-[90vh] px-5 py-12 md:py-20"
        style={{ background: offWhite, color: ink }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
          {/* Left column — photo + caption */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="order-2 md:order-1 space-y-5"
          >
            {heroPhoto ? (
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/5] md:aspect-[3/4]">
                <img
                  src={heroPhoto}
                  alt={`${config.dealership_name} — family-owned`}
                  className="w-full h-full object-cover"
                />
                {/* Subtle warm wash for tone */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(44,42,38,0.18) 100%)" }}
                />
              </div>
            ) : (
              // Fallback: parchment card with wordmark
              <div
                className="rounded-2xl shadow-xl aspect-[4/5] md:aspect-[3/4] flex flex-col items-center justify-center p-10 text-center"
                style={{ background: primary, color: offWhite }}
              >
                <div className="font-serif text-3xl md:text-4xl tracking-wide">
                  {config.dealership_name}
                </div>
                {established && (
                  <div className="text-sm mt-2 opacity-80 tracking-widest font-light">
                    EST. {established}
                  </div>
                )}
              </div>
            )}
            <p className="text-sm leading-relaxed" style={{ color: `${ink}cc` }}>
              <span className="font-medium" style={{ color: ink }}>
                Family-owned in {(config as any).address?.split(",")?.[1]?.trim() || "our community"}
                {established ? ` since ${established}.` : "."}
              </span>{" "}
              We've been buying our neighbors' cars for decades — same family, same handshake.
            </p>
          </motion.div>

          {/* Right column — form */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="order-1 md:order-2 space-y-7"
          >
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.25em] mb-3"
                style={{ color: accent }}
              >
                Sell to {config.dealership_name}
              </p>
              <h1
                className="font-serif text-[34px] md:text-[44px] lg:text-[48px] font-medium tracking-[-0.005em] leading-[1.1]"
                style={{ color: ink }}
              >
                {config.hero_headline ||
                  "We'll buy your car. Like we have for three generations."}
              </h1>
              <p className="text-base mt-4 max-w-md" style={{ color: `${ink}99` }}>
                {config.hero_subtext ||
                  "Tell us about your car. We'll have a fair offer in your hand in two minutes — no out-of-state buyer, no phone tag, no surprises."}
              </p>
            </div>

            {/* Plate input — warm theme, hands off to FullscreenWizard
                with Tier A "warm graphite" feel inside (slow 700ms
                cubic-bezier handoff per the May-2026 design audit). */}
            <div
              className="rounded-2xl bg-white p-5"
              style={{ border: `1px solid ${accent}33` }}
            >
              <LandingPlateInput onEngage={handleEngage} theme="warm" ctaLabel="Tell us about your car" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Below the fold — three reassurance blocks; warm, restrained */}
      <section className="px-5 py-16" style={{ background: "#FAF6EE", color: ink }}>
        <div className="max-w-3xl mx-auto text-center space-y-10">
          <h2 className="font-serif text-2xl md:text-3xl font-normal" style={{ color: ink }}>
            What you can expect from us.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "A real human appraiser",
                body: "Your offer is set by an experienced buyer who works at this rooftop, not a national algorithm.",
              },
              {
                title: "Plain dealing",
                body: "What we offer is what we pay. No deductions at pickup. No surprise paperwork.",
              },
              {
                title: "Local pickup",
                body: "We come to you, anywhere in the area. Title, payment, keys — done in 20 minutes.",
              },
            ].map((s) => (
              <div key={s.title} className="space-y-2">
                <div
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: accent }}
                >
                  {s.title}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: `${ink}b3` }}>
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fullscreen wizard — warm theme. Slow Tier A handoff so the
          family-dealer feel carries into the focused flow. */}
      <FullscreenWizard open={wizardOpen} onClose={() => setWizardOpen(false)} theme="warm" accent={primary}>
        <LandingForm
          variant="default"
          initial={initial ? { plate: initial.plate, state: initial.state } : undefined}
          theme="warm"
          loader="hand-drawn"
          accent={primary}
        />
      </FullscreenWizard>
    </>
  );
};

export default HeritageTemplate;
