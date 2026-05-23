import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Camera,
  ShieldCheck,
  ArrowRight,
  Clock,
  X,
} from "lucide-react";
import type { StepContext } from "../types";
import { trackAiBoostStarted, trackCtaClicked } from "../analytics";

/**
 * AI Photo Appraisal intro — premium concierge modal.
 *
 * Refined to match approved target: eyebrow concierge label, two-line
 * headline with purple "AI appraisal.", inline payout sentence with mint
 * dollar range (NOT boxed), time pill, tight 3-up benefit panel, premium CTA.
 */
const StepBoostIntro = ({ state, goTo, update }: StepContext) => {
  const currentOffer = state.valuation?.firm ?? state.valuation?.high ?? 0;
  const minIncrease = Math.round(currentOffer * 0.02);
  const maxIncrease = Math.round(currentOffer * 0.12);
  const hasOffer = currentOffer > 0;

  const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const onStart = () => {
    trackCtaClicked("photo_review", "Add Photos for a Better Offer");
    trackAiBoostStarted();
    goTo("boost_upload");
  };

  const onKeep = () => {
    trackCtaClicked("photo_review", "Save Your Offer");
    update({ branch: "accept" });
    goTo("accepted");
  };

  const benefits = [
    {
      icon: Zap,
      title: "Fast AI review",
      body: "Advanced AI analyzes your vehicle instantly.",
    },
    {
      icon: Camera,
      title: "Guided photo capture",
      body: "We'll show you exactly what to snap.",
    },
    {
      icon: ShieldCheck,
      title: "No risk to current offer",
      body: "Your current offer is always protected.",
    },
  ];

  return (
    <div className="relative flex w-full justify-center px-4 py-8 sm:py-12">
      {/* Ambient halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[560px] w-[820px] max-w-[98%] rounded-[60px] bg-[radial-gradient(closest-side,hsl(262_83%_62%/0.16),transparent_70%)] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[600px]"
      >
        <div
          className="relative overflow-hidden rounded-[30px] bg-white px-6 pb-9 pt-10 ring-1 ring-slate-200/70 sm:px-11 sm:pb-10 sm:pt-12"
          style={{
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.04), 0 26px 60px -22px rgba(124,58,237,0.28), 0 44px 100px -28px rgba(15,23,42,0.16)",
          }}
        >
          {/* Subtle lavender / mint corner tints */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[hsl(160_70%_75%/0.18)] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[hsl(262_83%_75%/0.14)] blur-3xl"
          />

          {/* Close X */}
          <button
            onClick={onKeep}
            aria-label="Close"
            className="absolute right-5 top-5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100/80 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Glowing AI icon */}
          <div className="relative flex justify-center">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div
                aria-hidden
                className="absolute inset-0 -m-7 rounded-full bg-[hsl(262_83%_62%/0.28)] blur-3xl"
              />
              <div
                aria-hidden
                className="absolute inset-0 -m-2 rounded-full bg-[hsl(262_83%_62%/0.18)] blur-xl"
              />
              <motion.span
                aria-hidden
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="absolute -left-9 top-2 h-1.5 w-1.5 rounded-full bg-[hsl(262_83%_62%/0.7)]"
              />
              <motion.span
                aria-hidden
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, delay: 0.4 }}
                className="absolute -right-9 top-3 h-1.5 w-1.5 rounded-full bg-[hsl(262_83%_62%/0.7)]"
              />
              <motion.span
                aria-hidden
                animate={{ opacity: [0.3, 0.9, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: 0.8 }}
                className="absolute -right-10 bottom-2 h-1 w-1 rounded-full bg-[hsl(262_83%_62%/0.6)]"
              />
              <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white text-[hsl(262_83%_55%)] shadow-[0_14px_36px_-10px_hsl(262_83%_58%/0.55)] ring-1 ring-[hsl(262_83%_62%/0.25)]">
                <Sparkles className="h-7 w-7" strokeWidth={2.2} fill="currentColor" />
              </div>
            </motion.div>
          </div>

          {/* Eyebrow */}
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.26em] text-[hsl(262_70%_50%)]">
            <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-[hsl(262_70%_60%)]" />
            Personal AI Appraisal Concierge
            <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-[hsl(262_70%_60%)]" />
          </p>

          {/* Headline — forced two lines */}
          <h2 className="mt-3 text-center text-[28px] font-bold leading-[1.18] tracking-tight text-slate-900 sm:text-[34px]">
            Get your strongest offer
            <br />
            with an <span className="text-[hsl(262_83%_55%)]">AI appraisal.</span>
          </h2>

          {/* Value payout — text-first, not boxed */}
          <p className="mx-auto mt-4 max-w-[460px] text-center text-[15.5px] leading-relaxed text-slate-500">
            A quick photo review may increase your offer by{" "}
            <span className="whitespace-nowrap font-bold text-emerald-600">
              {hasOffer ? `${fmt(minIncrease)}–${fmt(maxIncrease)}` : "2%–12%"}
            </span>
            .
          </p>

          {/* Time pill */}
          <div className="mt-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
              <Clock className="h-3.5 w-3.5" />
              Takes about 2 minutes
            </span>
          </div>

          {/* Benefits row */}
          <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white/80 shadow-[0_6px_24px_-12px_rgba(124,58,237,0.10)]">
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.06, duration: 0.35 }}
                  className="flex flex-col items-center px-3 py-4 text-center"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(262_83%_62%/0.10)] text-[hsl(262_70%_48%)]">
                    <b.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </div>
                  <p className="mt-2.5 text-[13.5px] font-semibold text-slate-900">
                    {b.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-slate-500">
                    {b.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 space-y-3">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.995 }}
              onClick={onStart}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[hsl(262_83%_64%)] to-[hsl(262_83%_48%)] px-6 py-[17px] text-[16px] font-semibold text-white shadow-[0_18px_40px_-12px_hsl(262_83%_58%/0.70),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all hover:from-[hsl(262_83%_60%)] hover:to-[hsl(262_83%_44%)]"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 opacity-0 transition-opacity group-hover:opacity-100"
              />
              <span className="relative inline-flex items-center justify-center gap-2">
                <Sparkles className="h-[18px] w-[18px]" />
                Add Photos for a Better Offer
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>

            <div className="text-center">
              <button
                onClick={onKeep}
                className="text-[14px] font-semibold text-[hsl(262_83%_55%)] underline-offset-4 transition-colors hover:underline"
              >
                Save Your Offer
              </button>
            </div>
          </div>

          {/* Reassurance */}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Keep your current offer if you'd rather decide later.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default StepBoostIntro;
