import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Camera, ShieldCheck, TrendingUp, Lock, BadgeCheck, ArrowRight, MessageCircle, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";
import { trackCtaClicked, trackEnhancedOfferAccepted } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const DEALER_NAME = "Harte Auto Group";

/**
 * Updated Offer reveal — customer-facing copy only (no AI/boost/algorithm).
 * After acceptance, transitions in-place to a success confirmation with a
 * clear "Go to My Offer Portal" CTA. No "Save & Return Later".
 */
const StepBoostResult = ({ state, update }: StepContext) => {
  const navigate = useNavigate();
  const original = state.valuation?.firm ?? 0;
  const requiredPhotoReviewComplete = state.boost.analyzed && state.boost.uploadedCategories.length >= 6;
  const boosted = state.boost.boostedFirm;
  const enhanced = requiredPhotoReviewComplete && boosted != null && boosted > original;
  const delta = enhanced ? boosted! - original : 0;
  const photoCount = state.boost.uploadedCategories.length;
  const finalOffer = enhanced ? boosted! : original;

  const [accepted, setAccepted] = useState(false);
  const [acceptedAmount, setAcceptedAmount] = useState<number>(finalOffer);

  const vehicleLabel = state.vehicle
    ? `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`
    : "Your vehicle";

  const accept = (amount: number, label: "Updated" | "Original") => {
    trackCtaClicked("boost_result", `Accept ${label} Offer`);
    if (label === "Updated" && enhanced) {
      trackEnhancedOfferAccepted(original, boosted!);
    }
    update({ branch: "accept", finalized: true });
    setAcceptedAmount(amount);
    setAccepted(true);
  };

  const goToPortal = () => {
    trackCtaClicked("boost_success", "Go to My Offer Portal");
    navigate("/my-submission");
  };

  // ── Success / confirmation state ────────────────────────────────────
  if (accepted) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          {/* Hero confirmation */}
          <motion.div
            initial={{ scale: 0.97 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.35 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.35)]"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
            >
              <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
            </motion.div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Your updated offer has been accepted.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 sm:text-base">
              We saved your offer to your customer portal. You can track next steps, upload documents, message the dealer, and review pickup details there.
            </p>

            {/* Confirmation card */}
            <div className="mt-6 rounded-xl border-2 border-emerald-300 bg-white p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Updated Offer</p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                {fmt(acceptedAmount)}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Row label="Vehicle" value={vehicleLabel} />
                <Row label="Dealer" value={DEALER_NAME} />
                <Row label="Status" value="Ready to Move Forward" status />
                <Row label="Photos reviewed" value={`${photoCount} photo${photoCount === 1 ? "" : "s"}`} />
              </div>
            </div>

            {/* Trust strip */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Trust icon={<BadgeCheck className="h-3.5 w-3.5" />} label="No obligation" />
              <Trust icon={<Lock className="h-3.5 w-3.5" />} label="Secure & private" />
              <Trust icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Dealer notified" />
            </div>
          </motion.div>

          {/* Portal CTA */}
          <div className="space-y-2">
            <PrimaryCTA onClick={goToPortal}>
              Go to My Offer Portal <ArrowRight className="ml-1 inline h-4 w-4" />
            </PrimaryCTA>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={goToPortal}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50"
              >
                <MessageCircle className="h-4 w-4" /> Message Dealer
              </button>
              <button
                onClick={goToPortal}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50"
              >
                <Calendar className="h-4 w-4" /> Schedule Pickup
              </button>
            </div>
            <p className="pt-1 text-center text-xs text-zinc-500">
              Your offer is available until the expiration date.
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Reveal / decision state ─────────────────────────────────────────
  return (
    <div className="space-y-5">
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
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Original Firm Offer</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-500 line-through">{fmt(original)}</p>
            </div>

            <div className="flex items-center justify-center">
              <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="sm:hidden flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
            </div>

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
          title="Review Complete"
          body="Photos reviewed for clarity and condition"
        />
        <DetailCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          title="Market adjustment"
          body={enhanced ? "Updated using current market demand" : "No adjustment needed at this time"}
        />
      </div>

      {/* CTAs */}
      <div className="space-y-2 pt-1">
        <PrimaryCTA onClick={() => accept(enhanced ? boosted! : original, "Updated")}>
          {enhanced ? `Accept Updated Offer · ${fmt(boosted!)} →` : `Accept Offer · ${fmt(original)} →`}
        </PrimaryCTA>
        {enhanced && (
          <button
            onClick={() => accept(original, "Original")}
            className="w-full rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50"
          >
            Keep Original Offer
          </button>
        )}
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

const Row = ({ label, value, status }: { label: string; value: string; status?: boolean }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
    <span className={`mt-0.5 text-sm font-semibold ${status ? "text-emerald-700" : "text-zinc-900"}`}>
      {status && "● "}{value}
    </span>
  </div>
);

const Trust = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-100 bg-white px-2.5 py-2 text-[11px] font-medium text-zinc-700">
    <span className="text-emerald-600">{icon}</span>
    {label}
  </div>
);

export default StepBoostResult;
