import { motion } from "framer-motion";
import { ShieldCheck, TrendingUp, Camera, Zap, ArrowUpRight, Check } from "lucide-react";
import type { StepContext } from "../types";
import { trackAiBoostStarted, trackCtaClicked } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * Photo Review intro — frames the photo capture as condition
 * verification with a potential market adjustment. Customer-facing
 * copy never mentions AI or "boost"; the current firm offer is
 * always presented as safe and available.
 */
const StepBoostIntro = ({ state, goTo, update }: StepContext) => {
  const firm = state.valuation?.firm ?? 0;
  const potentialDelta = Math.round((firm * 0.04) / 10) * 10;
  const potentialOffer = firm + potentialDelta;

  const onStart = () => {
    trackCtaClicked("photo_review", "Add Photos & Improve My Offer");
    trackAiBoostStarted();
    goTo("boost_upload");
  };

  const onKeep = () => {
    trackCtaClicked("photo_review", "Keep Current Offer");
    update({ branch: "accept" });
    goTo("accepted");
  };

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-22px_rgba(15,23,42,0.15)]"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(262_83%_58%/0.1)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(262_60%_45%)]">
          <Camera className="h-3 w-3" /> Photo Review
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
          A few photos may improve your offer.
        </h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-500">
          Photos help us confirm your vehicle's condition before pickup. If everything checks out,
          we may be able to increase your firm offer.
        </p>

        {/* Offer comparison */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Current Offer
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{fmt(firm)}</p>
            <p className="mt-1 text-xs text-slate-500">Available now · No obligation</p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18 }}
            className="relative rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50/40 p-5 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.35)]"
          >
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <ArrowUpRight className="h-3 w-3" /> +{fmt(potentialDelta)}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Potential Updated Offer
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-700">
              Up to {fmt(potentialOffer)}
            </p>
            <p className="mt-1 text-xs font-medium text-emerald-700/80">
              Potential increase · pending photo review
            </p>
          </motion.div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Final amount depends on photo review and vehicle condition.
        </p>
      </motion.div>

      {/* Benefits row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Benefit
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Verified condition"
          body="Photos help confirm your vehicle's condition before pickup."
        />
        <Benefit
          icon={<TrendingUp className="h-4 w-4" />}
          title="Potentially stronger offer"
          body="A verified vehicle may qualify for an updated market adjustment."
        />
        <Benefit
          icon={<Zap className="h-4 w-4" />}
          title="Faster final review"
          body="Clear photos help reduce follow-up questions later."
        />
      </div>

      {/* Photo requirement box */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[hsl(262_60%_45%)] ring-1 ring-slate-200">
            <Camera className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className="text-sm font-semibold text-slate-900">Takes about 2 minutes</p>
              <p className="text-sm text-slate-500">6–10 simple photos</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Secure upload. Used only to review your vehicle and finalize your offer.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Front", "Rear", "Driver side", "Passenger side", "Odometer", "Interior"].map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  <Check className="h-2.5 w-2.5 text-emerald-600" /> {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="space-y-2.5">
        <p className="text-center text-xs text-slate-500">
          Your current offer is still available.
        </p>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.995 }}
          onClick={onStart}
          className="w-full rounded-xl bg-gradient-to-b from-[hsl(262_83%_60%)] to-[hsl(262_83%_52%)] px-6 py-4 text-base font-semibold text-white shadow-[0_8px_24px_-10px_hsl(262_83%_58%/0.6)] transition-all hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_48%)]"
        >
          Add Photos &amp; Improve My Offer →
        </motion.button>
        <button
          onClick={onKeep}
          className="block w-full rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
        >
          Keep Current Offer
        </button>
        <p className="text-center text-[11px] text-slate-400">
          Adding photos now can help finalize your strongest offer before pickup.
        </p>
      </div>
    </div>
  );
};

const Benefit = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(262_83%_58%/0.1)] text-[hsl(262_60%_45%)]">
      {icon}
    </div>
    <p className="mt-2.5 text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
  </div>
);

export default StepBoostIntro;
