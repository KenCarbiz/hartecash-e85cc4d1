import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Camera,
  ShieldCheck,
  ArrowRight,
  Clock,
  X,
  TrendingUp,
} from "lucide-react";
import type { StepContext } from "../types";
import { trackAiBoostStarted, trackCtaClicked } from "../analytics";

/**
 * AI Photo Appraisal intro — premium concierge modal.
 *
 * Refined to match approved target: compact premium modal, exact AI Photo
 * Appraisal hierarchy, polished payout box, tight 3-up benefit panel, CTA.
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
      body: "We analyze your photos in seconds.",
    },
    {
      icon: Camera,
      title: "Guided photo capture",
      body: "We'll show you exactly what to snap.",
    },
    {
      icon: ShieldCheck,
      title: "Current offer protected",
      body: "Your offer stays safe while we review.",
    },
  ];

  return (
    <div className="relative flex w-full justify-center px-4 py-4 sm:py-6">
      {/* Ambient halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[480px] w-[680px] max-w-[95%] rounded-[56px] bg-[radial-gradient(closest-side,hsl(262_83%_62%/0.14),transparent_70%)] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[580px]"
      >
        <div
          className="relative max-h-[86vh] overflow-y-auto rounded-[28px] bg-white px-5 pb-6 pt-7 ring-1 ring-slate-200/75 sm:px-8 sm:pb-7 sm:pt-8"
          style={{
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.04), 0 22px 52px -24px rgba(124,58,237,0.30), 0 36px 82px -34px rgba(15,23,42,0.18)",
          }}
        >
          {/* Subtle lavender / mint corner tints */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-[hsl(160_70%_75%/0.16)] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-[hsl(262_83%_75%/0.13)] blur-3xl"
          />

          {/* Close X */}
          <button
            onClick={onKeep}
            aria-label="Close"
            className="absolute right-5 top-5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/75 text-slate-500 ring-1 ring-slate-200/70 transition-colors hover:bg-slate-200 hover:text-slate-800"
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
              <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-[hsl(262_83%_55%)] shadow-[0_13px_32px_-11px_hsl(262_83%_58%/0.55)] ring-1 ring-[hsl(262_83%_62%/0.25)]">
                <Sparkles className="h-[27px] w-[27px]" strokeWidth={2.2} fill="currentColor" />
              </div>
            </motion.div>
          </div>

          {/* Eyebrow */}
          <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(262_83%_50%)]">
            AI Photo Appraisal
          </p>

          {/* Headline — forced two lines */}
          <h2 className="mt-2 text-center text-[28px] font-bold leading-[1.12] text-slate-950 sm:text-[40px]">
            Get your strongest offer
            <br />
            with a <span className="text-[hsl(262_83%_52%)]">photo review.</span>
          </h2>

          <p className="mx-auto mt-4 max-w-[400px] text-center text-[15.5px] leading-relaxed text-slate-600">
            Our AI agent reviews your vehicle photos to
            <br className="hidden sm:block" /> check whether your offer can improve.
          </p>

          {/* Value payout */}
          <div className="mx-auto mt-4 max-w-[420px] overflow-hidden rounded-[18px] border border-[hsl(262_83%_74%/0.34)] bg-[linear-gradient(180deg,hsl(262_83%_99%/0.92),hsl(262_83%_96%/0.72))] px-5 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_14px_34px_-24px_hsl(262_83%_50%/0.55)]">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 ring-1 ring-[hsl(262_83%_74%/0.26)]">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(262_83%_62%/0.12)] text-[hsl(262_83%_52%)]">
                <TrendingUp className="h-3 w-3" strokeWidth={2.8} />
              </span>
              Photo-reviewed offer boost
            </div>
            <div className="mt-3 flex flex-col items-center justify-center">
              <p className="whitespace-nowrap text-center text-[34px] font-bold leading-none text-[hsl(262_83%_50%)] sm:text-[40px]">
                {hasOffer ? `${fmt(minIncrease)}–${fmt(maxIncrease)}` : "2%–12%"}
              </p>
              <p className="mt-2 text-center text-[12.5px] font-medium leading-tight text-slate-500">
                Potential increase based on a 2%–12% photo review range
              </p>
            </div>
          </div>

          {/* Time pill */}
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
              <Clock className="h-3.5 w-3.5" />
              Takes about 2 minutes
            </span>
          </div>

          {/* Benefits row */}
          <div className="mt-4 rounded-[18px] border border-slate-200/80 bg-white/90 shadow-[0_8px_26px_-22px_rgba(15,23,42,0.28)]">
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.06, duration: 0.35 }}
                  className="flex flex-col items-center px-3.5 py-3.5 text-center"
                >
                  <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[hsl(262_83%_62%/0.11)] text-[hsl(262_70%_48%)] ring-1 ring-[hsl(262_83%_72%/0.22)]">
                    <b.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </div>
                  <p className="mt-2 text-[13px] font-bold leading-tight text-slate-950">
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
          <div className="mt-4 space-y-2.5">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.995 }}
              onClick={onStart}
              className="group relative w-full overflow-hidden rounded-[14px] bg-gradient-to-b from-[hsl(262_83%_64%)] to-[hsl(262_83%_48%)] px-6 py-[14px] text-[16px] font-semibold text-white shadow-[0_16px_34px_-16px_hsl(262_83%_50%/0.78),inset_0_1px_0_rgba(255,255,255,0.20)] transition-all hover:from-[hsl(262_83%_60%)] hover:to-[hsl(262_83%_44%)]"
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
                className="text-[14px] font-semibold text-[hsl(262_83%_50%)] underline-offset-4 transition-colors hover:underline"
              >
                Save Your Offer
              </button>
            </div>
          </div>

          {/* Reassurance */}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Your current offer remains available while you decide.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default StepBoostIntro;
