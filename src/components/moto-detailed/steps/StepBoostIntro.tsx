import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Camera,
  ShieldCheck,
  ArrowRight,
  X,
} from "lucide-react";
import type { StepContext } from "../types";
import { trackAiBoostStarted, trackCtaClicked } from "../analytics";

/**
 * AI Photo Appraisal intro — premium "modal-style" hero moment.
 *
 * Visual goal: feels like a centered, elevated white card with a soft
 * purple ambient halo, sitting on a dimmed page. Toned-down premium,
 * not neon. Communicates a dynamic uplift *range* derived from the
 * customer's current firm offer (2% – 12%), never a speculative total.
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
      body: "Your current offer stays safe while we review.",
    },
  ];

  return (
    <div className="relative flex w-full justify-center px-4 py-6 sm:py-10">
      {/* Soft purple ambient halo behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[520px] w-[760px] max-w-[95%] rounded-[48px] bg-[radial-gradient(closest-side,hsl(262_83%_62%/0.22),hsl(262_83%_62%/0.08)_55%,transparent_75%)] blur-2xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[680px]"
      >
        {/* Card */}
        <div
          className="relative rounded-[28px] bg-white px-6 pb-8 pt-10 ring-1 ring-slate-200/80 sm:px-10 sm:pb-10 sm:pt-12"
          style={{
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.04), 0 20px 50px -20px rgba(124,58,237,0.35), 0 40px 90px -30px rgba(15,23,42,0.25)",
          }}
        >
          {/* Close X */}
          <button
            onClick={onKeep}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Glowing AI icon */}
          <div className="flex justify-center">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div
                aria-hidden
                className="absolute inset-0 -m-3 rounded-full bg-[hsl(262_83%_62%/0.35)] blur-xl"
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(262_83%_62%)] to-[hsl(262_83%_48%)] text-white shadow-[0_8px_24px_-6px_hsl(262_83%_58%/0.6)] ring-1 ring-white/40">
                <Sparkles className="h-6 w-6" />
              </div>
            </motion.div>
          </div>

          {/* Eyebrow */}
          <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(262_60%_45%)]">
            AI Photo Appraisal
          </p>

          {/* Headline */}
          <h2 className="mt-3 text-center text-[26px] font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-[30px]">
            Get your strongest offer with a photo review.
          </h2>

          {/* Subheadline */}
          <p className="mx-auto mt-3 max-w-[520px] text-center text-[15px] leading-relaxed text-slate-500">
            Our AI agent reviews your vehicle photos to check whether your offer can improve.
          </p>

          {/* Value callout box */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            className="mx-auto mt-7 max-w-[520px] overflow-hidden rounded-2xl border border-[hsl(262_83%_58%/0.18)] bg-gradient-to-br from-[hsl(262_83%_62%/0.06)] via-white to-[hsl(262_83%_62%/0.04)] px-5 py-5 text-center"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Photo-reviewed offers may increase by
            </p>
            <p className="mt-2 bg-gradient-to-r from-[hsl(262_83%_50%)] to-[hsl(262_83%_38%)] bg-clip-text text-[28px] font-semibold tracking-tight text-transparent sm:text-[32px]">
              {hasOffer ? `${fmt(minIncrease)} – ${fmt(maxIncrease)}` : "Up to 12% more"}
            </p>

            <div className="mt-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Takes about 2 minutes
              </span>
            </div>
          </motion.div>

          {/* Benefit columns */}
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 + i * 0.05, duration: 0.35 }}
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-4 text-center"
              >
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(262_83%_58%/0.08)] text-[hsl(262_60%_45%)] ring-1 ring-[hsl(262_83%_58%/0.15)]">
                  <b.icon className="h-4 w-4" />
                </div>
                <p className="mt-2.5 text-[13px] font-semibold text-slate-900">
                  {b.title}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                  {b.body}
                </p>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 space-y-3">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.995 }}
              onClick={onStart}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[hsl(262_83%_62%)] to-[hsl(262_83%_48%)] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_14px_32px_-12px_hsl(262_83%_58%/0.65)] transition-all hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_44%)]"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity group-hover:opacity-100"
              />
              <span className="relative inline-flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" />
                Add Photos for a Better Offer
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>

            <div className="text-center">
              <button
                onClick={onKeep}
                className="text-[13px] font-medium text-slate-500 underline-offset-4 transition-colors hover:text-slate-800 hover:underline"
              >
                Save Your Offer
              </button>
            </div>
          </div>

          {/* Reassurance */}
          <p className="mt-5 text-center text-[11.5px] text-slate-400">
            Your current offer remains available while you decide.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default StepBoostIntro;
