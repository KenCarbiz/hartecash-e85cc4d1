import { motion } from "framer-motion";
import { Sparkles, TrendingUp, ShieldCheck } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";
import { trackCtaClicked, trackEnhancedOfferAccepted, trackOfferSaved } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * AI Boost result reveal. Shows original vs enhanced side-by-side
 * with an animated +$ delta, then offers three terminal actions.
 * The original offer is never overwritten — both numbers persist
 * in state for the portal handoff.
 */
const StepBoostResult = ({ state, update, goTo }: StepContext) => {
  const original = state.valuation?.firm ?? 0;
  const boosted = state.boost.boostedFirm ?? original;
  const delta = state.boost.delta ?? 0;
  const confidence = Math.round((state.boost.aiConfidence ?? 0.85) * 100);

  const acceptEnhanced = () => {
    trackCtaClicked("boost_result", "Accept Enhanced Offer");
    trackEnhancedOfferAccepted(original, boosted);
    update({ branch: "accept", finalized: true });
    goTo("accepted");
  };

  const keepOriginal = () => {
    trackCtaClicked("boost_result", "Keep Original Offer");
    update({
      branch: "accept",
      finalized: true,
      boost: { ...state.boost, boostedFirm: null, delta: null },
    });
    goTo("accepted");
  };

  const saveForLater = () => {
    trackCtaClicked("boost_result", "Save & Return Later");
    trackOfferSaved(boosted);
    update({ saved: true });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 p-7"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
          <Sparkles className="h-3 w-3" /> AI Enhanced
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Your offer just went up.
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Original</p>
            <p className="mt-1 text-xl font-semibold text-zinc-500 line-through">{fmt(original)}</p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-emerald-300 bg-emerald-50 p-4"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">AI Enhanced</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{fmt(boosted)}</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm"
        >
          <TrendingUp className="h-4 w-4" /> +{fmt(delta)}
        </motion.div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">AI confidence</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-zinc-900">{confidence}%</span>
            <span className="text-xs text-emerald-700">High</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${confidence}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="h-full bg-emerald-500"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Photos analyzed</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{state.boost.uploadedCategories.length}</p>
          <p className="mt-1 text-xs text-zinc-500">Used for condition + valuation refinement.</p>
        </div>
      </div>

      <div className="space-y-2">
        <PrimaryCTA onClick={acceptEnhanced}>Accept Enhanced Offer · {fmt(boosted)}</PrimaryCTA>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={keepOriginal}
            className="w-full rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50"
          >
            Keep Original · {fmt(original)}
          </button>
          <button
            onClick={saveForLater}
            className="w-full rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50"
          >
            Save & Return Later
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-800">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Both offers are saved to your portal. You can change your mind any time before expiration.</span>
      </div>
    </div>
  );
};

export default StepBoostResult;
