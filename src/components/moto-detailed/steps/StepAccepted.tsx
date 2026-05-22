import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Calendar, MapPin, Check, Circle } from "lucide-react";
import type { StepContext, JourneyAppointment } from "../types";
import { trackCtaClicked } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * Post-acceptance confirmation + scheduling + personalized checklist.
 * Modal-quality moment — celebrates the lock-in, then immediately
 * gives the customer a next action without overwhelming.
 */
const StepAccepted = ({ state, update }: StepContext) => {
  const requiredPhotoReviewComplete = state.boost.analyzed && state.boost.uploadedCategories.length >= 6;
  const firm = requiredPhotoReviewComplete && state.boost.boostedFirm
    ? state.boost.boostedFirm
    : state.valuation?.firm ?? 0;
  const [pickedSlot, setPickedSlot] = useState<string | null>(state.appointment?.timeSlot ?? null);
  const [mode, setMode] = useState<JourneyAppointment["mode"]>(state.appointment?.mode ?? "appointment");

  const slots = useMemo(() => {
    const out: { date: string; label: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
      out.push({
        date: d.toISOString(),
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    return out;
  }, []);

  const toggleTodo = (id: string) => {
    update({
      todos: state.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    });
  };

  const setSlot = (date: string, label: string) => {
    setPickedSlot(label);
    update({ appointment: { mode, date, timeSlot: label } });
    trackCtaClicked("accepted", `slot:${label}`);
  };

  const completed = state.todos.filter((t) => t.done).length;
  const pct = Math.round((completed / state.todos.length) * 100);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-7"
      >
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Your offer is locked in.
        </h2>
        <p className="mt-2 text-base text-zinc-600">
          {fmt(firm)} secured — we're ready for the next step.
        </p>
      </motion.div>

      {/* Mode picker */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-medium text-zinc-900">How would you like to complete this?</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["appointment", "pickup"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  if (pickedSlot && state.appointment?.date) {
                    update({ appointment: { ...state.appointment, mode: m } });
                  }
                }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-all ${
                  active
                    ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%)]/5 text-[hsl(262_83%_42%)]"
                    : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                }`}
              >
                {m === "appointment" ? <Calendar className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                <span className="font-medium">{m === "appointment" ? "Visit our store" : "Schedule pickup"}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Pick a {mode === "pickup" ? "pickup" : "visit"} day
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((s) => {
            const active = pickedSlot === s.label;
            return (
              <button
                key={s.date}
                onClick={() => setSlot(s.date, s.label)}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                  active
                    ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%)] text-white"
                    : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Checklist */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-900">Required before {mode === "pickup" ? "pickup" : "your visit"}</p>
          <span className="text-xs text-zinc-500">{completed} of {state.todos.length}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <motion.div
            className="h-full bg-[hsl(262_83%_58%)]"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <ul className="mt-4 divide-y divide-zinc-100">
          {state.todos.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => toggleTodo(t.id)}
                className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-zinc-50/60"
              >
                {t.done ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <Circle className="h-6 w-6 text-zinc-300" />
                )}
                <span
                  className={`text-sm ${
                    t.done ? "text-zinc-400 line-through" : "text-zinc-800"
                  }`}
                >
                  {t.label}
                </span>
                {t.required && !t.done && (
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-amber-700">
                    Required
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default StepAccepted;
