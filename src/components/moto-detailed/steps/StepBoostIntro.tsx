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
 * AI Photo Appraisal intro — premium concierge "moment".
 *
 * Soft glowing card, centered glowing AI icon, integrated 2–12% increase
 * range in the subheadline, calm 3-column benefit row, big purple CTA.
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
    <div className="relative flex w-full justify-center px-4 py-8 sm:py-14">
      {/* Soft ambient halo — lavender + mint behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[620px] w-[860px] max-w-[98%] rounded-[60px] bg-[radial-gradient(closest-side,hsl(262_83%_62%/0.28),hsl(262_83%_62%/0.10)_50%,transparent_75%)] blur-3xl" />
        <div className="absolute h-[460px] w-[700px] max-w-[92%] translate-x-[18%] translate-y-[12%] rounded-[60px] bg-[radial-gradient(closest-side,hsl(160_70%_60%/0.18),transparent_70%)] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[620px]"
      >
        {/* Card */}
        <div
          className="relative overflow-hidden rounded-[32px] px-6 pb-10 pt-12 ring-1 ring-[hsl(262_40%_90%/0.9)] sm:px-12 sm:pb-12 sm:pt-14"
          style={{
            background:
              "radial-gradient(120% 90% at 0% 0%, hsl(262 83% 96%) 0%, transparent 45%), radial-gradient(110% 85% at 100% 100%, hsl(160 70% 95%) 0%, transparent 50%), #ffffff",
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.04), 0 30px 70px -25px rgba(124,58,237,0.40), 0 50px 110px -30px rgba(15,23,42,0.22)",
          }}
        >
          {/* Close X — soft circular */}
          <button
            onClick={onKeep}
            aria-label="Close"
            className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100/80 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Glowing AI icon */}
          <div className="flex justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Outer halo */}
              <div
                aria-hidden
                className="absolute inset-0 -m-8 rounded-full bg-[hsl(262_83%_62%/0.32)] blur-3xl"
              />
              <div
                aria-hidden
                className="absolute inset-0 -m-3 rounded-full bg-[hsl(262_83%_62%/0.20)] blur-xl"
              />
              {/* Sparkle dots */}
              <motion.span
                aria-hidden
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="absolute -left-8 top-2 h-1 w-1 rounded-full bg-[hsl(262_83%_62%)]"
              />
              <motion.span
                aria-hidden
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, delay: 0.4 }}
                className="absolute -right-7 top-4 h-1.5 w-1.5 rounded-full bg-[hsl(262_83%_62%/0.7)]"
              />
              <motion.span
                aria-hidden
                animate={{ opacity: [0.3, 0.9, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: 0.8 }}
                className="absolute -right-9 bottom-3 h-1 w-1 rounded-full bg-[hsl(262_83%_62%/0.6)]"
              />
              <motion.span
                aria-hidden
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: 1.2 }}
                className="absolute -left-6 bottom-1 h-1 w-1 rounded-full bg-[hsl(262_83%_62%/0.55)]"
              />
              {/* Icon disc */}
              <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full bg-gradient-to-br from-white to-[hsl(262_83%_97%)] text-[hsl(262_83%_55%)] shadow-[0_14px_36px_-10px_hsl(262_83%_58%/0.55),inset_0_-2px_6px_rgba(124,58,237,0.08)] ring-1 ring-[hsl(262_83%_62%/0.25)]">
                <Sparkles className="h-9 w-9" strokeWidth={2.2} />
              </div>
            </motion.div>
          </div>

          {/* Eyebrow */}
          <p className="mt-7 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[hsl(262_70%_48%)]">
            Personal AI Appraisal Concierge
          </p>

          {/* Headline */}
          <h2 className="mt-3 text-center text-[28px] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-[34px]">
            Get your strongest offer with an{" "}
            <span className="text-[hsl(262_83%_55%)]">AI appraisal.</span>
          </h2>

          {/* Subheadline w/ integrated mint range */}
          <p className="mx-auto mt-4 max-w-[500px] text-center text-[16px] leading-relaxed text-slate-500">
            A quick photo review may increase your offer by{" "}
            <span className="font-semibold text-emerald-600">
              {hasOffer ? `${fmt(minIncrease)}–${fmt(maxIncrease)}` : "2–12%"}
            </span>
            .
          </p>

          {/* Time pill */}
          <div className="mt-5 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
              <Clock className="h-3.5 w-3.5" />
              Takes about 2 minutes
            </span>
          </div>

          {/* Benefit row — one soft glass card with 3 columns + dividers */}
          <div className="mt-7 rounded-2xl border border-white/80 bg-white/70 p-1 shadow-[0_6px_24px_-12px_rgba(124,58,237,0.18)] backdrop-blur-sm">
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.06, duration: 0.35 }}
                  className="px-3 py-5 text-center"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(262_83%_62%/0.10)] text-[hsl(262_70%_48%)] ring-1 ring-[hsl(262_83%_58%/0.18)]">
                    <b.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </div>
                  <p className="mt-3 text-[13px] font-semibold text-slate-900">
                    {b.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                    {b.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 space-y-3">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.995 }}
              onClick={onStart}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[hsl(262_83%_64%)] to-[hsl(262_83%_48%)] px-6 py-[18px] text-[16px] font-semibold text-white shadow-[0_18px_40px_-12px_hsl(262_83%_58%/0.70),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all hover:from-[hsl(262_83%_60%)] hover:to-[hsl(262_83%_44%)]"
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
                className="text-[13px] font-medium text-slate-500 underline-offset-4 transition-colors hover:text-slate-800 hover:underline"
              >
                Save Your Offer
              </button>
            </div>
          </div>

          {/* Reassurance */}
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[12px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Keep your current offer if you'd rather decide later.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default StepBoostIntro;
