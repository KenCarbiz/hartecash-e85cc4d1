import { motion } from "framer-motion";
import { ShieldCheck, Clock, MapPin, Sparkles } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const StepOfferReady = ({ state }: StepContext) => {
  const v = state.valuation;
  const firm = v?.firm ?? (v ? Math.round((v.low + v.high) / 2) : 0);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
        <p className="text-sm uppercase tracking-wide text-zinc-500">Your estimated offer</p>
        <motion.p
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-2 text-5xl font-semibold tracking-tight text-zinc-900"
        >
          {fmt(firm)}
        </motion.p>
        <p className="mt-2 text-sm text-zinc-500">
          Valid through {expires.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Badge icon={<ShieldCheck className="h-4 w-4" />} label="Secure" />
          <Badge icon={<MapPin className="h-4 w-4" />} label="Pickup available" />
          <Badge icon={<Clock className="h-4 w-4" />} label="7-day price hold" />
        </div>
      </motion.div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-base font-semibold text-zinc-900">What happens next?</p>
        <ol className="mt-3 space-y-2 text-sm text-zinc-600">
          <li>1. We'll text & email you the full offer breakdown.</li>
          <li>2. A specialist reviews your details and confirms a firm number.</li>
          <li>3. Pick a time for pickup — we handle the rest.</li>
        </ol>
      </div>

      <PrimaryCTA onClick={() => { /* hand off to customer portal */ }}>
        View Full Offer
      </PrimaryCTA>
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
