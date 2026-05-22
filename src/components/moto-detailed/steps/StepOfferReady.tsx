import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Truck, BadgeCheck, Camera, X, Lock } from "lucide-react";
import type { StepContext } from "../types";
import { trackCtaClicked, trackOfferAccepted } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const DEALER_NAME = "Liberty Automotive";

/**
 * Firm-offer reveal — final decision moment.
 *
 * - No "Save Offer" button.
 * - No customer-facing AI Boost copy.
 * - "I'm not ready" opens a photo-review invitation modal only.
 *   No increased dollar amount is revealed unless the customer
 *   completes the photo review flow.
 */
const StepOfferReady = ({ state, update, goTo }: StepContext) => {
  const v = state.valuation;
  const firm = v?.firm ?? (v ? Math.round((v.low + v.high) / 2) : 0);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiresLabel = expires.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const vehicle = state.vehicle;
  const mileage = state.contact.mileage
    ? `${Number(state.contact.mileage).toLocaleString("en-US")} mi`
    : null;

  const [showRetention, setShowRetention] = useState(false);

  const acceptOriginal = () => {
    trackCtaClicked("offer", "Accept Offer");
    trackOfferAccepted(firm);
    update({ branch: "accept" });
    setShowRetention(false);
    setTimeout(() => goTo("accepted"), 0);
  };

  const onNotReady = () => {
    trackCtaClicked("offer", "I'm not ready");
    setShowRetention(true);
  };

  const onAddPhotos = () => {
    trackCtaClicked("offer", "Add Photos & Review Offer");
    update({ branch: "boost" });
    setShowRetention(false);
    setTimeout(() => goTo("boost_intro"), 0);
  };

  return (
    <div className="space-y-5">
      {/* Main firm offer card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-20px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(262_60%_45%)]">
              Firm Offer
            </p>
            <motion.p
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="mt-1 text-5xl font-semibold tracking-tight text-slate-900 sm:text-[56px]"
            >
              {fmt(firm)}
            </motion.p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <ShieldCheck className="h-3 w-3" /> No obligation
          </span>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm sm:grid-cols-2">
          <Row label="Vehicle" value={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "—"} />
          <Row label="Dealer" value={DEALER_NAME} />
          {mileage && <Row label="Mileage" value={mileage} />}
          <Row label="Offer expires" value={expiresLabel} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Trust icon={<BadgeCheck className="h-3.5 w-3.5" />} label="No obligation" />
          <Trust icon={<Lock className="h-3.5 w-3.5" />} label="Secure & private" />
          <Trust icon={<Truck className="h-3.5 w-3.5" />} label="Free pickup" />
          <Trust icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Dealer verified" />
        </div>
      </motion.div>

      {/* Primary + secondary actions */}
      <div className="space-y-3">
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.995 }}
          onClick={acceptOriginal}
          className="w-full rounded-xl bg-gradient-to-b from-[hsl(262_83%_60%)] to-[hsl(262_83%_52%)] px-6 py-4 text-base font-semibold text-white shadow-[0_8px_24px_-10px_hsl(262_83%_58%/0.6)] transition-all hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_48%)]"
        >
          Accept Offer
        </motion.button>
        <button
          onClick={onNotReady}
          className="block w-full rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          I'm not ready
        </button>
      </div>

      {/* Retention modal — hidden Updated Market Offer */}
      <AnimatePresence>
        {showRetention && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setShowRetention(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <button
                onClick={() => setShowRetention(false)}
                className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(262_83%_58%/0.1)] px-2.5 py-1 text-[11px] font-semibold text-[hsl(262_60%_45%)]">
                <Sparkles className="h-3 w-3" /> Updated Market Offer
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
                Before you go, we found an updated market adjustment.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Based on current market demand, we may be able to improve your offer.
              </p>

              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-slate-500">Original offer</span>
                  <span className="text-sm text-slate-500 line-through">{fmt(firm)}</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(262_60%_45%)]">
                    Updated offer
                  </span>
                  <span className="text-3xl font-semibold tracking-tight text-slate-900">
                    {fmt(updatedOffer)}
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  +{fmt(updatedOffer - firm)} market adjustment
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <motion.button
                  whileTap={{ scale: 0.995 }}
                  onClick={() => acceptAt(updatedOffer, "updated")}
                  className="w-full rounded-xl bg-gradient-to-b from-[hsl(262_83%_60%)] to-[hsl(262_83%_52%)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_hsl(262_83%_58%/0.6)] transition-all hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_48%)]"
                >
                  Accept Updated Offer
                </motion.button>
                <button
                  onClick={() => setShowRetention(false)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
                >
                  Still not ready
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] text-slate-400">
                No obligation. Your information stays secure.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
    <span className="mt-0.5 text-sm font-semibold text-slate-900">{value}</span>
  </div>
);

const Trust = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-700">
    <span className="text-emerald-600">{icon}</span>
    {label}
  </div>
);

export default StepOfferReady;
