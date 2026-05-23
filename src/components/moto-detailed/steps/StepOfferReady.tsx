import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Truck, BadgeCheck, X, LockKeyhole, BookmarkCheck, ArrowRight, ArrowUpRight, Clock, Sparkles, Zap, Camera } from "lucide-react";

import type { StepContext } from "../types";
import { trackCtaClicked, trackOfferAccepted } from "../analytics";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * Firm-offer reveal — final decision moment.
 *
 * - "Accept Offer" locks in the firm offer.
 * - "Save My Offer" opens the AI Appraisal modal, giving customers
 *   a clear choice: add photos for a potential better offer, or
 *   simply save the current offer for later.
 */
const StepOfferReady = ({ state, update, goTo }: StepContext) => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim() || "Our Dealership";
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
    // Skip the boost_intro pitch page — the modal IS the pitch. Go
    // straight to the photo capture / phone handoff task screen.
    setTimeout(() => goTo("boost_upload"), 0);
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
          <Row label="Dealer" value={dealerName} />
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

      {/* AI Photo Appraisal modal — premium upsell shown when customer
          chooses "Save My Offer" instead of "Accept Offer". */}
      <AnimatePresence>
        {showAiModal && (() => {
          const minIncrease = Math.max(0, Math.round(firm * 0.02));
          const maxIncrease = Math.max(0, Math.round(firm * 0.12));
          const hasOffer = firm > 0;
          const benefits = [
            { icon: Zap, title: "Fast AI review", body: "We analyze your photos in seconds.", tint: "violet" },
            { icon: Camera, title: "Guided photo capture", body: "We'll show you exactly what to snap.", tint: "indigo" },
            { icon: ShieldCheck, title: "Current offer protected", body: "Your offer stays safe while we review.", tint: "emerald" },
          ] as const;
          const tintClasses: Record<string, string> = {
            violet: "bg-[hsl(262_83%_62%/0.10)] text-[hsl(262_70%_48%)] ring-[hsl(262_83%_58%/0.20)]",
            indigo: "bg-[hsl(232_83%_62%/0.10)] text-[hsl(232_70%_50%)] ring-[hsl(232_83%_58%/0.20)]",
            emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200/70",
          };

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-4 backdrop-blur-md sm:items-center"
              onClick={() => setShowAiModal(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-appraisal-title"
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.99 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-[90%] max-w-[660px]"
              >
                {/* Soft ambient purple glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,hsl(262_83%_62%/0.28),hsl(262_83%_62%/0.08)_55%,transparent_75%)] blur-2xl"
                />

                <div
                  className="relative rounded-[28px] bg-white px-6 pb-8 pt-10 ring-1 ring-[hsl(262_30%_92%)] sm:px-9 sm:pb-8 sm:pt-10"
                  style={{
                    boxShadow:
                      "0 1px 2px rgba(15,23,42,0.04), 0 20px 50px -20px rgba(124,58,237,0.35), 0 40px 90px -30px rgba(15,23,42,0.25)",
                  }}
                >
                  {/* Close X */}
                  <button
                    onClick={() => setShowAiModal(false)}
                    aria-label="Close"
                    className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* AI icon — white circle, purple sparkle, diffused halo */}
                  <div className="flex justify-center">
                    <motion.div
                      initial={{ scale: 0.88, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="relative"
                    >
                      <div aria-hidden className="absolute inset-0 -m-4 rounded-full bg-[hsl(262_83%_62%/0.30)] blur-2xl" />
                      <span aria-hidden className="absolute -left-6 top-1 h-1 w-1 rounded-full bg-[hsl(262_83%_62%/0.55)]" />
                      <span aria-hidden className="absolute -right-5 top-3 h-1.5 w-1.5 rounded-full bg-[hsl(262_83%_62%/0.45)]" />
                      <span aria-hidden className="absolute -right-7 bottom-2 h-1 w-1 rounded-full bg-[hsl(262_83%_62%/0.45)]" />
                      <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-[hsl(262_83%_55%)] shadow-[0_10px_30px_-10px_hsl(262_83%_58%/0.55)] ring-1 ring-[hsl(262_83%_62%/0.20)]">
                        <Sparkles className="h-7 w-7" strokeWidth={2.2} />
                      </div>
                    </motion.div>
                  </div>

                  {/* Eyebrow */}
                  <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(262_70%_48%)]">
                    AI Photo Appraisal
                  </p>

                  {/* Headline */}
                  <h2
                    id="ai-appraisal-title"
                    className="mt-3 text-center text-[26px] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-[32px]"
                  >
                    Get your strongest offer with a{" "}
                    <span className="text-[hsl(262_83%_55%)]">photo review.</span>
                  </h2>

                  {/* Body */}
                  <p className="mx-auto mt-3 max-w-[520px] text-center text-[15px] leading-relaxed text-slate-500">
                    Our AI agent reviews your vehicle photos to check whether your offer can improve.
                  </p>

                  {/* Value callout */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.4 }}
                    className="mx-auto mt-6 flex max-w-[540px] items-center gap-4 rounded-2xl border border-[hsl(262_83%_58%/0.18)] bg-gradient-to-br from-[hsl(262_83%_62%/0.08)] via-[hsl(262_83%_62%/0.04)] to-white px-5 py-4 text-left sm:px-6 sm:py-5"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[hsl(262_83%_55%)] shadow-sm ring-1 ring-[hsl(262_83%_62%/0.25)]">
                      <ArrowUpRight className="h-5 w-5" strokeWidth={2.4} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-slate-600">
                        Photo-reviewed offers may increase by
                      </p>
                      <p className="mt-0.5 bg-gradient-to-r from-[hsl(262_83%_55%)] to-[hsl(262_83%_42%)] bg-clip-text text-[26px] font-bold tracking-tight text-transparent sm:text-[30px]">
                        {hasOffer ? `${fmt(minIncrease)} – ${fmt(maxIncrease)}` : "Up to 12% more"}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-slate-500">
                        Based on 2%–12% increase range
                      </p>
                    </div>
                  </motion.div>

                  {/* Time pill */}
                  <div className="mt-4 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                      <Clock className="h-3.5 w-3.5" />
                      Takes about 2 minutes
                    </span>
                  </div>

                  {/* Benefits */}
                  <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/40 p-3 sm:grid-cols-3">
                    {benefits.map((b, i) => (
                      <motion.div
                        key={b.title}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.22 + i * 0.05, duration: 0.35 }}
                        className="rounded-xl bg-white px-3 py-4 text-center"
                      >
                        <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ring-1 ${tintClasses[b.tint]}`}>
                          <b.icon className="h-5 w-5" strokeWidth={2.2} />
                        </div>
                        <p className="mt-3 text-[13px] font-semibold text-slate-900">{b.title}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{b.body}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* CTAs */}
                  <div className="mt-7 space-y-3">
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.995 }}
                      onClick={onAddPhotos}
                      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[hsl(262_83%_62%)] to-[hsl(262_83%_48%)] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_14px_32px_-12px_hsl(262_83%_58%/0.65)] transition-all hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_44%)]"
                      style={{ minHeight: 56 }}
                    >
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
                      <span className="relative inline-flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Add Photos for a Better Offer
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </motion.button>

                    <div className="text-center">
                      <button
                        onClick={onSaveOfferFromModal}
                        className="text-[13px] font-medium text-[hsl(262_60%_45%)] underline-offset-4 transition-colors hover:text-[hsl(262_83%_40%)] hover:underline"
                      >
                        Save Your Offer
                      </button>
                    </div>
                  </div>

                  {/* Reassurance */}
                  <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[12px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Your current offer remains available while you decide.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
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
