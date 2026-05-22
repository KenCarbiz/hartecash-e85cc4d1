import { motion } from "framer-motion";
import { Camera, Sparkles, ScanSearch, TrendingUp, ArrowRight, ShieldCheck } from "lucide-react";
import type { StepContext } from "../types";
import { trackAiBoostStarted, trackCtaClicked } from "../analytics";

/**
 * AI Photo Appraisal intro — a premium hero moment framing the photo
 * capture as an opportunity to unlock a stronger offer. Never shows a
 * speculative new total; only communicates an average uplift range.
 * Current firm offer remains safe and available via the right rail.
 */
const StepBoostIntro = ({ goTo, update }: StepContext) => {
  const onStart = () => {
    trackCtaClicked("photo_review", "Start AI Photo Appraisal");
    trackAiBoostStarted();
    goTo("boost_upload");
  };

  const onKeep = () => {
    trackCtaClicked("photo_review", "Keep My Current Offer");
    update({ branch: "accept" });
    goTo("accepted");
  };

  const steps = [
    { n: 1, icon: Camera, title: "Take 6–10 photos", body: "Snap quick shots of your vehicle." },
    { n: 2, icon: ScanSearch, title: "AI reviews condition", body: "Our agent verifies your vehicle in seconds." },
    { n: 3, icon: TrendingUp, title: "We check for a stronger offer", body: "Eligible vehicles get a market re-rate." },
  ];

  const photoTypes = ["Front", "Rear", "Driver side", "Passenger side", "Interior", "Odometer"];

  return (
    <div className="space-y-6">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_60px_-28px_rgba(15,23,42,0.2)] sm:p-10"
      >
        {/* decorative gradient orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-[hsl(262_83%_70%/0.18)] via-[hsl(262_83%_60%/0.10)] to-transparent blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-gradient-to-tr from-[hsl(199_89%_60%/0.12)] to-transparent blur-2xl"
        />

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(262_83%_58%/0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(262_60%_45%)] ring-1 ring-[hsl(262_83%_58%/0.18)]">
            <Sparkles className="h-3 w-3" /> AI Photo Appraisal
          </div>

          <h2 className="mt-4 max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-[36px]">
            Unlock your strongest offer with photos.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-500 sm:text-base">
            Our AI agent can review your vehicle photos and check whether you qualify for a stronger offer.
          </p>

          {/* value statement */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white px-5 py-4 shadow-[0_8px_24px_-14px_rgba(16,185,129,0.45)]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">
                Average uplift
              </p>
              <p className="text-lg font-semibold tracking-tight text-emerald-800 sm:text-xl">
                $250 – $2,375 after photo review
              </p>
            </div>
          </motion.div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            Your current offer remains available while we review your photos.
          </p>
        </div>
      </motion.div>

      {/* HOW IT WORKS */}
      <div>
        <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          How it works
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.35 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:shadow-[0_10px_28px_-18px_rgba(15,23,42,0.18)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(262_83%_58%/0.08)] text-[hsl(262_60%_45%)] ring-1 ring-[hsl(262_83%_58%/0.15)]">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider text-slate-300">
                  0{s.n}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* PHOTO TYPES */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Photos you'll need</p>
            <p className="text-xs text-slate-500">Takes about 2 minutes · Secure upload</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {photoTypes.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-3 pt-1">
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.995 }}
          onClick={onStart}
          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[hsl(262_83%_62%)] to-[hsl(262_83%_50%)] px-6 py-5 text-base font-semibold text-white shadow-[0_12px_32px_-12px_hsl(262_83%_58%/0.7)] transition-all hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_46%)]"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity group-hover:opacity-100"
          />
          <span className="relative inline-flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            Start AI Photo Appraisal
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </motion.button>

        <div className="text-center">
          <button
            onClick={onKeep}
            className="text-sm font-medium text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
          >
            Keep My Current Offer
          </button>
          <p className="mt-2 text-[11px] text-slate-400">
            Your current offer is still available. No obligation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StepBoostIntro;
