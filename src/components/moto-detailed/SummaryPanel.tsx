import { motion } from "framer-motion";
import { ShieldCheck, TrendingUp, Sparkles, CheckCircle2, Calendar, Camera, Car, Lock, BadgeCheck } from "lucide-react";
import type { JourneyState } from "./types";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const strengthLabel = {
  soft: { text: "Soft demand", className: "bg-zinc-100 text-zinc-700" },
  balanced: { text: "Balanced market", className: "bg-amber-50 text-amber-700" },
  hot: { text: "Hot market", className: "bg-emerald-50 text-emerald-700" },
} as const;

/**
 * Right-rail vehicle + valuation summary. Evolves as the customer
 * progresses: pre-offer = range + market signal; post-offer =
 * firm number + accepted/boost state + checklist progress.
 */
const SummaryPanel = ({ state }: { state: JourneyState }) => {
  const { vehicle, valuation } = state;
  if (!vehicle) {
    return (
      <aside className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
        <p className="font-medium text-zinc-700">Your vehicle</p>
        <p className="mt-1">We'll show your estimated value here as soon as you find your car.</p>
      </aside>
    );
  }

  const strength = valuation ? strengthLabel[valuation.marketStrength] : null;
  const original = valuation?.firm ?? null;
  const boosted = state.boost.boostedFirm;
  const showFirm = state.offerUnlocked && original;
  const isAccepted = state.branch === "accept";
  const todosDone = state.todos.filter((t) => t.done).length;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="aspect-[16/10] w-full bg-gradient-to-br from-zinc-100 to-zinc-200">
          {vehicle.imageUrl ? (
            <img src={vehicle.imageUrl} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400 text-sm">Vehicle photo</div>
          )}
        </div>
        <div className="p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Your vehicle</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          {vehicle.trim && <p className="text-sm text-zinc-500">{vehicle.trim}</p>}
        </div>
      </div>

      {/* Pre-offer estimated range */}
      {valuation && !showFirm && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Estimated range</p>
            {strength && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${strength.className}`}>
                {strength.text}
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {fmt(valuation.low)} <span className="text-zinc-400">–</span> {fmt(valuation.high)}
          </p>

          <Sparkline data={valuation.trend} />

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              <span>Secure & private</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-600">
              <TrendingUp className="h-4 w-4" />
              <span>Live market data</span>
            </div>
            <div className="flex items-center gap-2 text-amber-700">
              <Sparkles className="h-4 w-4" />
              <span>{valuation.confidence === "high" ? "High" : valuation.confidence === "medium" ? "Medium" : "Building"} confidence</span>
            </div>
          </div>
        </div>
      )}

      {/* Post-offer firm number with original vs boosted */}
      {showFirm && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {boosted ? "Enhanced offer" : "Firm offer"}
          </p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900">{fmt(boosted ?? original!)}</p>

          {boosted && (
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-zinc-400 line-through">{fmt(original!)}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                +{fmt(boosted - original!)}
              </span>
            </div>
          )}

          {isAccepted && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Accepted
            </div>
          )}

          {state.appointment?.timeSlot && (
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <span>{state.appointment.mode === "pickup" ? "Pickup" : "Visit"} · {state.appointment.timeSlot}</span>
            </div>
          )}

          {state.boost.aiConfidence != null && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI confidence</span>
                <span className="font-medium text-zinc-700">{Math.round(state.boost.aiConfidence * 100)}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full bg-emerald-500" style={{ width: `${state.boost.aiConfidence * 100}%` }} />
              </div>
            </div>
          )}

          {state.boost.uploadedCategories.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Camera className="h-3.5 w-3.5" />
              {state.boost.uploadedCategories.length} photos analyzed
            </div>
          )}
        </motion.div>
      )}

      {/* Checklist progress when accepted */}
      {isAccepted && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Tasks</p>
            <span className="text-xs font-medium text-zinc-700">{todosDone}/{state.todos.length}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full bg-[hsl(262_83%_58%)] transition-[width] duration-300"
              style={{ width: `${(todosDone / state.todos.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </motion.aside>
  );
};

const Sparkline = ({ data }: { data: number[] }) => {
  if (!data?.length) return null;
  const w = 240;
  const h = 48;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-12 w-full">
      <polyline
        fill="none"
        stroke="hsl(262 83% 58%)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
};

export default SummaryPanel;
