import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Camera, ShieldCheck, TrendingUp } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";
import { trackCtaClicked, trackEnhancedOfferAccepted } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * Updated Offer reveal. Customer-facing language only — no AI/boost/algorithm.
 * Two presentations:
 *  1. Enhanced — boostedFirm > original. Side-by-side reveal with +delta.
 *  2. Confirmed — no adjustment. Photos verified the existing firm offer.
 */
const StepBoostResult = ({ state, update, goTo }: StepContext) => {
  const original = state.valuation?.firm ?? 0;
  const boosted = state.boost.boostedFirm;
  const enhanced = boosted != null && boosted > original;
  const delta = state.boost.delta ?? 0;
  const photoCount = state.boost.uploadedCategories.length;

  const acceptEnhanced = () => {
    trackCtaClicked("boost_result", "Accept Updated Offer");
    trackEnhancedOfferAccepted(original, boosted!);
    update({ branch: "accept", finalized: true });
    goTo("accepted");
  };

  const keepOriginal = () => {
    trackCtaClicked("boost_result", "Keep Original Offer");
    update({ branch: "accept", finalized: true });
    goTo("accepted");
  };

  const notReady = () => {
    trackCtaClicked("boost_result", "Not ready");
    // Soft exit — no state mutation, customer can return.
  };

  const finalOffer = enhanced ? boosted! : original;

  return (
    <div className="space-y-5">
      {/* Hero reveal card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.35)]"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> Photo Review Complete
        </div>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {enhanced ? "Your offer increased." : "Your offer is confirmed."}
        </h2>
        <p className="mt-1.5 text-sm text-zinc-600">
          {enhanced
            ? "Your photos helped verify the vehicle's condition and unlock an updated market adjustment."
            : "Your photos verified your vehicle's condition. Your firm offer is ready to accept."}
        </p>

        {enhanced ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1.15fr] sm:items-center">
            {/* Original */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Original Firm Offer</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-500 line-through">{fmt(original)}</p>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="sm:hidden flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
            </div>

            {/* Updated */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="relative rounded-xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.55)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Updated Market Offer</p>
              <motion.p
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 200 }}
                className="mt-1 text-3xl font-bold tracking-tight text-emerald-700 sm:text-4xl"
              >
                {fmt(boosted!)}
              </motion.p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                <TrendingUp className="h-3 w-3" /> +{fmt(delta)} increase
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border-2 border-emerald-300 bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Your Firm Offer</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{fmt(original)}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Photos verified
            </div>
          </div>
        )}
      </motion.div>

      {/* Detail cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <DetailCard
          icon={<Camera className="h-4 w-4 text-[hsl(262_83%_58%)]" />}
          title="Photos reviewed"
          body={`${photoCount} photo${photoCount === 1 ? "" : "s"} added`}
        />
        <DetailCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          title="Condition verified"
          body="Photos reviewed for clarity and vehicle condition"
        />
        <DetailCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          title="Market adjustment"
          body={enhanced ? "Updated using current market demand" : "No adjustment needed at this time"}
        />
      </div>

      {/* CTAs */}
      <div className="space-y-2 pt-1">
        <PrimaryCTA onClick={acceptEnhanced}>
          {enhanced ? `Accept Updated Offer · ${fmt(boosted!)} →` : `Accept Offer · ${fmt(original)} →`}
        </PrimaryCTA>
        {enhanced && (
          <button
            onClick={keepOriginal}
            className="w-full rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50"
          >
            Keep Original Offer · {fmt(original)}
          </button>
        )}
        <div className="flex items-center justify-center pt-1">
          <button
            onClick={notReady}
            className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline"
          >
            I'm not ready yet
          </button>
        </div>
      </div>

      {/* Trust note */}
      <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-800">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>No obligation. Your updated offer is available until it expires.</span>
      </div>
    </div>
  );
};

const DetailCard = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50">{icon}</div>
    <p className="mt-2.5 text-sm font-semibold text-zinc-900">{title}</p>
    <p className="mt-0.5 text-xs text-zinc-500">{body}</p>
  </div>
);

export default StepBoostResult;
