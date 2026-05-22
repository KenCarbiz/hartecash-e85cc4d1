import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Truck, BadgeCheck, X, LockKeyhole, BookmarkCheck, ArrowRight, ArrowUpRight, Clock, Sparkles, Zap, Camera } from "lucide-react";

import type { StepContext } from "../types";
import { trackCtaClicked, trackOfferAccepted } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const DEALER_NAME = "Liberty Automotive";

/**
 * Firm-offer reveal — final decision moment.
 *
 * - "Accept Offer" locks in the firm offer.
 * - "Save My Offer" opens the AI Appraisal modal, giving customers
 *   a clear choice: add photos for a potential better offer, or
 *   simply save the current offer for later.
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

  const [showAiModal, setShowAiModal] = useState(false);

  const acceptOriginal = () => {
    trackCtaClicked("offer", "Accept Offer");
    trackOfferAccepted(firm);
    update({ branch: "accept" });
    setShowAiModal(false);
    setTimeout(() => goTo("accepted"), 0);
  };

  const onSaveMyOffer = () => {
    trackCtaClicked("offer", "Save My Offer");
    setShowAiModal(true);
  };

  const onAddPhotos = () => {
    trackCtaClicked("offer", "Add Photos for a Better Offer");
    update({ branch: "boost" });
    setShowAiModal(false);
    setTimeout(() => goTo("boost_intro"), 0);
  };

  const onSaveOfferFromModal = () => {
    trackCtaClicked("offer", "Save Your Offer");
    update({ saved: true });
    setShowAiModal(false);
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

        {/* Premium trust strip */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-y-2 rounded-[14px] border border-emerald-100/80 bg-[hsl(150_60%_97%)] px-4 py-2.5">
          <TrustItem icon={<ShieldCheck className="h-[14px] w-[14px]" />} label="No obligation" />
          <span className="hidden h-3 w-px bg-emerald-200/60 sm:block" aria-hidden="true" />
          <TrustItem icon={<LockKeyhole className="h-[14px] w-[14px]" />} label="Secure & private" />
          <span className="hidden h-3 w-px bg-emerald-200/60 sm:block" aria-hidden="true" />
          <TrustItem icon={<Truck className="h-[14px] w-[14px]" />} label="Free pickup" />
          <span className="hidden h-3 w-px bg-emerald-200/60 sm:block" aria-hidden="true" />
          <TrustItem icon={<BadgeCheck className="h-[14px] w-[14px]" />} label="Dealer verified" />
        </div>
      </motion.div>

      {/* Primary + secondary actions */}
      <div className="space-y-2">
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.995 }}
          onClick={acceptOriginal}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[hsl(262_83%_60%)] to-[hsl(262_83%_52%)] px-6 py-4 text-base font-semibold text-white shadow-[0_8px_24px_-10px_hsl(262_83%_58%/0.6)] transition-all hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_48%)]"
        >
          Accept Offer · {fmt(firm)} <ArrowRight className="h-4 w-4" />
        </motion.button>
        <button
          onClick={onSaveMyOffer}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          <BookmarkCheck className="h-4 w-4" /> Save My Offer
        </button>
        <p className="pt-1 text-center text-[12px] leading-relaxed text-slate-500">
          Your offer will be saved to your customer portal and available until it expires.
        </p>
      </div>

      {/* AI Appraisal modal */}
      <AnimatePresence>
        {showAiModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-md sm:items-center"
            onClick={() => setShowAiModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 1.01 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white p-8 shadow-[0_24px_60px_-16px_rgba(15,23,42,0.35)] sm:p-10"
            >
              {/* Close */}
              <button
                onClick={() => setShowAiModal(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>

              {/* Decorative top gradient line */}
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[hsl(262_83%_60%)] via-[hsl(262_70%_55%)] to-[hsl(190_80%_55%)]" />

              <div className="flex flex-col items-center text-center">
                {/* Icon badge */}
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ delay: 0.5, duration: 0.5, ease: "easeInOut" }}
                  className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(262_83%_96%)] to-[hsl(262_60%_94%)] text-[hsl(262_60%_45%)] shadow-[0_4px_16px_-6px_hsl(262_60%_45%/0.35)]"
                >
                  <Sparkles className="h-6 w-6" strokeWidth={1.8} />
                </motion.div>

                {/* Eyebrow */}
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(262_60%_45%)]">
                  AI Appraisal Option
                </p>

                {/* Headline */}
                <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[28px]">
                  Want to get more<br className="hidden sm:block" /> for your vehicle?
                </h2>

                {/* Body */}
                <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500">
                  Let our AI agent appraise it.<br className="hidden sm:block" />
                  Upload a few quick photos and we’ll review your vehicle’s condition and check whether you qualify for a better offer.
                </p>
              </div>

              {/* CTAs */}
              <div className="mt-8 space-y-3">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={onAddPhotos}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[hsl(262_83%_60%)] to-[hsl(262_83%_52%)] px-6 py-4 text-base font-semibold text-white shadow-[0_10px_32px_-10px_hsl(262_83%_58%/0.55)] transition-all hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_48%)]"
                >
                  Add Photos for a Better Offer <ArrowRight className="h-4 w-4" />
                </motion.button>

                <button
                  onClick={onSaveOfferFromModal}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
                >
                  Save Your Offer
                </button>
              </div>

              {/* Reassurance */}
              <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
                Your current offer is still available. No obligation.
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

const TrustItem = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[hsl(210_30%_28%)]">
    <span className="text-[hsl(160_55%_38%)]">{icon}</span>
    {label}
  </div>
);

export default StepOfferReady;
