import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Zap, TrendingUp, Camera } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";
import { trackAiBoostStarted, trackCtaClicked } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * Intro screen for the AI Boost loop. Sets expectations, builds
 * trust, and primes the customer for a 2-minute photo capture
 * that might increase their offer.
 */
const StepBoostIntro = ({ state, goTo, update }: StepContext) => {
  const firm = state.valuation?.firm ?? 0;
  const previewBoost = Math.round(firm * 0.04);

  const onStart = () => {
    trackCtaClicked("boost_intro", "Boost My Offer");
    trackAiBoostStarted();
    goTo("boost_upload");
  };

  const onKeep = () => {
    trackCtaClicked("boost_intro", "Keep Current Offer");
    update({ branch: "accept" });
    goTo("accepted");
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-[hsl(262_83%_58%)]/5 via-white to-amber-50/40 p-7"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(262_83%_58%)]/10 px-3 py-1 text-xs font-medium text-[hsl(262_83%_42%)]">
          <Sparkles className="h-3 w-3" /> AI-powered appraisal
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Unlock your highest possible offer.
        </h2>
        <p className="mt-2 text-base text-zinc-600">
          Our AI reviews your photos and can boost your appraisal — instantly, with no waiting.
        </p>

        {/* Animated growth visualization */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Current offer</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{fmt(firm)}</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Potential</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">
              up to {fmt(firm + previewBoost)}
            </p>
          </motion.div>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Benefit
          icon={<TrendingUp className="h-4 w-4" />}
          title="Stronger offer"
          body="Photos help us value beyond averages."
        />
        <Benefit
          icon={<Zap className="h-4 w-4" />}
          title="Faster approval"
          body="Fewer inspection adjustments at pickup."
        />
        <Benefit
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Higher confidence"
          body="More data, more accurate valuation."
        />
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
        <div className="flex items-start gap-3">
          <Camera className="mt-0.5 h-5 w-5 text-zinc-500" />
          <div>
            <p className="text-sm font-medium text-zinc-900">~2 minutes · 6–10 photos</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Encrypted upload. Used only to refine your appraisal — never shared.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PrimaryCTA onClick={onStart}>Boost My Offer</PrimaryCTA>
        <button
          onClick={onKeep}
          className="w-full rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-base font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 sm:w-auto sm:min-w-[200px]"
        >
          Keep Current Offer
        </button>
      </div>
    </div>
  );
};

const Benefit = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(262_83%_58%)]/10 text-[hsl(262_83%_42%)]">
      {icon}
    </div>
    <p className="mt-2 text-sm font-medium text-zinc-900">{title}</p>
    <p className="mt-0.5 text-xs text-zinc-500">{body}</p>
  </div>
);

export default StepBoostIntro;
