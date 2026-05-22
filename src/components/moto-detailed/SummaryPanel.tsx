import { motion } from "framer-motion";
import { ShieldCheck, TrendingUp, CheckCircle2, Calendar, Camera, Car, Lock, BadgeCheck, Circle } from "lucide-react";
import type { JourneyState } from "./types";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const REQUIRED_PHOTO_IDS = ["front", "rear", "driver", "passenger", "interior", "odometer"];

const strengthLabel = {
  soft: { text: "Soft Market", className: "bg-slate-100 text-slate-700" },
  balanced: { text: "Balanced Market", className: "bg-[hsl(262_83%_58%/0.1)] text-[hsl(262_60%_45%)]" },
  hot: { text: "Hot Market", className: "bg-emerald-50 text-emerald-700" },
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
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <p className="font-semibold text-slate-800">Your vehicle</p>
        <p className="mt-1">We'll show your estimated value here as soon as you find your car.</p>
      </aside>
    );
  }

  const strength = valuation ? strengthLabel[valuation.marketStrength] : null;
  const original = valuation?.firm ?? null;
  const requiredPhotoReviewComplete =
    state.boost.analyzed && REQUIRED_PHOTO_IDS.every((id) => state.boost.uploadedCategories.includes(id));
  const boosted = requiredPhotoReviewComplete ? state.boost.boostedFirm : null;
  const showFirm = state.offerUnlocked && original;
  const isAccepted = state.branch === "accept";
  const todosDone = state.todos.filter((t) => t.done).length;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Unified Offer Profile card (pre-offer) */}
      {!showFirm && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.12)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Offer Profile
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(262_83%_58%/0.08)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(262_60%_45%)]">
              Building your offer
            </span>
          </div>

          {/* Vehicle image */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-[hsl(262_83%_58%/0.08)]">
            {vehicle.imageUrl ? (
              <img
                src={vehicle.imageUrl}
                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-slate-50 via-white to-[hsl(215_40%_96%)]" />
                <div
                  className="absolute inset-0 opacity-[0.35]"
                  style={{
                    backgroundImage:
                      "radial-gradient(hsl(215 20% 65% / 0.35) 1px, transparent 1px)",
                    backgroundSize: "14px 14px",
                  }}
                />
                <div className="relative flex h-full flex-col items-center justify-center">
                  <Car
                    className="h-14 w-14 text-[hsl(262_60%_45%)] opacity-60"
                    strokeWidth={1.25}
                  />
                  <p className="mt-2 text-[11px] font-medium text-slate-400">
                    Vehicle image pending
                  </p>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white to-transparent" />
              </>
            )}
          </div>

          {/* Vehicle name */}
          <div className="px-5 pt-4">
            <p className="text-base font-semibold text-slate-900">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
            {vehicle.trim && <p className="text-sm text-slate-500">{vehicle.trim}</p>}
            {state.contact.mileage && (
              <p className="mt-0.5 text-xs text-slate-500">
                {Number(state.contact.mileage).toLocaleString("en-US")} mi
              </p>
            )}
          </div>

          {/* Estimated range */}
          {valuation && (
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Estimated Range
                </p>
                {strength && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${strength.className}`}>
                    {strength.text}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {fmt(valuation.low)} <span className="text-slate-300">–</span> {fmt(valuation.high)}
              </p>
              <Sparkline data={valuation.trend} />
            </div>
          )}

          {/* Progress checklist */}
          <div className="mt-4 border-t border-slate-100 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Building your offer
            </p>
            <ProfileChecklist state={state} inline />
          </div>

          {/* Trust items */}
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="grid grid-cols-1 gap-1.5 text-[12px]">
              <div className="flex items-center gap-2 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Secure &amp; private</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <TrendingUp className="h-3.5 w-3.5 text-[hsl(262_60%_45%)]" />
                <span>Live market data</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>No obligation</span>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1 text-[11px] leading-relaxed text-slate-400">
              <Lock className="h-3 w-3" /> Estimate improves as you continue.
            </p>
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
            {boosted ? "Updated Offer" : "Firm offer"}
          </p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900">{fmt(boosted ?? original!)}</p>

          {boosted && (
            <>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-zinc-400 line-through">{fmt(original!)}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  +{fmt(boosted - original!)}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium text-emerald-700">Photo review complete</p>
            </>
          )}

          {isAccepted && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Review Complete
            </div>
          )}

          {state.appointment?.timeSlot && (
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <span>{state.appointment.mode === "pickup" ? "Pickup" : "Visit"} · {state.appointment.timeSlot}</span>
            </div>
          )}

          {state.boost.uploadedCategories.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Camera className="h-3.5 w-3.5" />
              {state.boost.uploadedCategories.length} photos reviewed
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
  const h = 56;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return { x, y };
  });
  const linePts = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPts = `0,${h} ${linePts} ${w},${h}`;
  const gradId = "spark-fill";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-14 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(262 83% 58%)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(262 83% 58%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Faint baseline grid */}
      <line x1="0" x2={w} y1={h - 1} y2={h - 1} stroke="hsl(215 20% 92%)" strokeWidth="1" />
      <polygon points={areaPts} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke="hsl(262 83% 58%)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={linePts}
      />
    </svg>
  );
};

const ProfileChecklist = ({ state, inline = false }: { state: JourneyState; inline?: boolean }) => {
  const items = [
    { label: "Vehicle identified", done: !!state.vehicle },
    { label: "Market data connected", done: !!state.valuation },
    { label: "Condition", done: !!state.condition },
    { label: "Usage selected", done: !!state.usage },
    { label: "Mileage added", done: !!state.contact.mileage },
    { label: "Ownership status", done: !!state.contact.ownership },
    { label: "Contact info", done: !!(state.contact.firstName && state.contact.email && state.contact.phone) },
  ];
  const activeIdx = items.findIndex((i) => !i.done);
  const list = (
    <ul className={`${inline ? "mt-2.5" : "mt-3"} space-y-2`}>
      {items.map((it, i) => {
        const isActive = i === activeIdx;
        return (
          <li key={it.label} className="flex items-center gap-2.5 text-[13px]">
            {it.done ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2.75} />
              </span>
            ) : isActive ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(262_83%_58%)] text-white ring-[3px] ring-[hsl(262_83%_58%/0.15)]">
                <Circle className="h-1.5 w-1.5 fill-current" />
              </span>
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                <Circle className="h-1 w-1 fill-slate-300 text-slate-300" />
              </span>
            )}
            <span
              className={
                it.done
                  ? "text-slate-600"
                  : isActive
                    ? "font-medium text-slate-900"
                    : "text-slate-400"
              }
            >
              {it.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
  if (inline) return list;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Profile progress
      </p>
      {list}
    </div>
  );
};

export default SummaryPanel;
