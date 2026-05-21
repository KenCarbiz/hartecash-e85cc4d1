import { motion } from "framer-motion";
import { ShieldCheck, Clock, MapPin, Sparkles, TrendingUp, Bookmark } from "lucide-react";
import type { StepContext } from "../types";
import { trackCtaClicked, trackOfferAccepted, trackOfferSaved } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * Redesigned firm-offer reveal — the decision moment.
 * Surfaces TWO primary actions: Accept Offer (locks deal, advances
 * to acceptance + scheduling) or Save My Offer (advances to the AI
 * Boost optimization loop).
 */
const StepOfferReady = ({ state, update, goTo }: StepContext) => {
  const v = state.valuation;
  const firm = v?.firm ?? (v ? Math.round((v.low + v.high) / 2) : 0);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const onAccept = () => {
    trackCtaClicked("offer", "Accept Offer");
    trackOfferAccepted(firm);
    update({ branch: "accept" });
    setTimeout(() => goTo("accepted"), 0);
  };

  const onSave = () => {
    trackCtaClicked("offer", "Save My Offer");
    trackOfferSaved(firm);
    update({ branch: "boost" });
    setTimeout(() => goTo("boost_intro"), 0);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-white to-amber-50/40 p-8 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.12)]"
      >
        <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <Sparkles className="h-3 w-3" /> No obligation
        </div>
        <p className="text-sm uppercase tracking-wide text-zinc-500">Your firm offer</p>
        <motion.p
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-2 text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl"
        >
          {fmt(firm)}
        </motion.p>
        <p className="mt-2 text-sm text-zinc-500">
          Locked through {expires.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Badge icon={<ShieldCheck className="h-4 w-4" />} label="Secure" />
          <Badge icon={<MapPin className="h-4 w-4" />} label="Pickup available" />
          <Badge icon={<Clock className="h-4 w-4" />} label="7-day price hold" />
        </div>
      </motion.div>

      {/* Decision moment — two primary CTAs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={onAccept}
          className="group flex flex-col items-start gap-2 rounded-2xl bg-[hsl(262_83%_58%)] p-5 text-left text-white shadow-[0_4px_16px_-6px_hsl(262_83%_58%/0.5)] transition-all hover:bg-[hsl(262_83%_52%)] hover:shadow-[0_8px_24px_-6px_hsl(262_83%_58%/0.6)]"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium">
            Recommended
          </div>
          <span className="text-lg font-semibold">Accept Offer</span>
          <span className="text-sm text-white/85">
            Lock in {fmt(firm)} and schedule your next step.
          </span>
        </motion.button>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={onSave}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-zinc-200 bg-white p-5 text-left transition-all hover:border-[hsl(262_83%_58%)] hover:shadow-md"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
            <TrendingUp className="h-3 w-3" /> Could be higher
          </div>
          <span className="text-lg font-semibold text-zinc-900">Save My Offer</span>
          <span className="text-sm text-zinc-500">
            Upload photos — our AI may boost your offer instantly.
          </span>
        </motion.button>
      </div>

      <button
        onClick={() => {
          trackCtaClicked("offer", "Bookmark for later");
          update({ saved: true });
        }}
        className="mx-auto flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900"
      >
        <Bookmark className="h-3.5 w-3.5" /> Save offer link to email
      </button>
    </div>
  );
};

const Badge = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
    <span className="text-emerald-600">{icon}</span>
    {label}
  </div>
);

export default StepOfferReady;
