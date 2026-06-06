// VehicleConditionStep — premium "Step 2": confirm + condition + color.
//
// The decoded vehicle is a persistent hero on a clean white background.
// The hero + identification NEVER unmount across the condition and color
// sub-views — only the lower panel swaps — so the image and top assets
// stay perfectly still (no jump / re-pull) as the customer advances:
//
//   condition (4-point) ──auto-advance──▶ color (Black Book swatches)
//        │ no colors? skip straight on            │ pick / skip
//        └────────────────────────────────────────┴──▶ onDone() → intent
//
// Clicking a condition swaps the panel in place to the color picker;
// clicking a color (or Skip) leaves Step 2 for the next page.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BBVehicle } from "@/components/sell-form/types";
import { bbVehicleLabel } from "./widgetData";
import { WIDGET_STEP_ORDER, type WidgetCondition } from "./widgetTypes";

const CONDITIONS: { value: WidgetCondition; label: string; desc: string }[] = [
  { value: "fair", label: "Fair", desc: "Noticeable wear and mechanical or cosmetic issues." },
  { value: "good", label: "Good", desc: "Average condition with normal wear." },
  { value: "very_good", label: "Very Good", desc: "Well maintained with minimal wear." },
  { value: "excellent", label: "Excellent", desc: "Exceptional condition and appearance." },
];

/** Mask the VIN to the final four, e.g. *****0FXV. */
function maskVin(vin?: string): string {
  const last4 = (vin || "").trim().slice(-4);
  return last4 ? `*****${last4}` : "";
}

/** Resolve a CSS color for a Black Book exterior-color swatch. */
function swatchColor(c: { hex?: string; rgb?: string }): string {
  if (c.hex) return c.hex.startsWith("#") ? c.hex : `#${c.hex}`;
  if (c.rgb) return `rgb(${c.rgb})`;
  return "#e4e4e7";
}

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
};

// Lower-panel swap — quick cross-fade/slide so the hero above reads as
// fixed while only the question below changes.
const panelSwap = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const },
};

export default function VehicleConditionStep({
  vehicle,
  imageUrl,
  condition,
  colorCode,
  onSelectCondition,
  onSelectColor,
  onDone,
  onReenter,
}: {
  vehicle: BBVehicle | null;
  imageUrl: string | null;
  condition: WidgetCondition | null;
  colorCode: string;
  onSelectCondition: (c: WidgetCondition) => void;
  onSelectColor: (c: { code: string; name: string; hex: string }) => void;
  /** Leave Step 2 for the next page (intent). */
  onDone: () => void;
  onReenter: () => void;
}) {
  const colors = vehicle?.exterior_colors ?? [];
  const hasColors = colors.length > 0;

  // Sub-view: condition first, then color (in place). Active dot tracks it.
  const [view, setView] = useState<"condition" | "color">("condition");
  // Color is a sub-view of this same step, so both views share the
  // "condition" position in the progress (no phantom extra step).
  const stepNumber = WIDGET_STEP_ORDER.indexOf("condition") + 1;

  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => setImgLoaded(false), [imageUrl]);

  // Pick a condition → swap the panel to color (or leave Step 2 when the
  // vehicle has no factory colors). Brief delay lets the highlight register.
  const advanceTimer = useRef<number | null>(null);
  useEffect(() => () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); }, []);

  const pickCondition = (c: WidgetCondition) => {
    onSelectCondition(c);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      if (hasColors) setView("color");
      else onDone();
    }, 220);
  };

  const pickColor = (c: { code: string; name: string; hex: string }) => {
    onSelectColor(c);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(onDone, 200);
  };

  const skipColor = () => {
    onSelectColor({ code: "", name: "", hex: "" });
    onDone();
  };

  const ready = !!vehicle;
  const title = vehicle ? bbVehicleLabel(vehicle) : "";
  const maskedVin = maskVin(vehicle?.vin);

  return (
    <div className="w-full">
      {/* Progress — minimal dots (advances when the panel switches to color) */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Step {stepNumber} of {WIDGET_STEP_ORDER.length}
        </p>
        <div className="flex items-center gap-2">
          {WIDGET_STEP_ORDER.map((s, i) => (
            <span
              key={s}
              className={`h-2 w-2 rounded-full transition ${
                i <= stepNumber - 1 ? "bg-[hsl(var(--cta-offer))]" : "bg-zinc-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Persistent vehicle hero — never unmounts between sub-views, so
          the image + assets below stay perfectly still. ── */}
      <div className="relative mx-auto mt-4 h-[34vh] max-h-[300px] w-full max-w-[380px]">
        <AnimatePresence>
          {!(imageUrl && imgLoaded) && (
            <motion.div
              key="skel"
              exit={{ opacity: 0 }}
              className="absolute inset-0 m-auto h-[70%] w-[88%] animate-pulse rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200"
            />
          )}
        </AnimatePresence>
        {imageUrl && imgLoaded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="pointer-events-none absolute inset-x-0 bottom-[6%] z-0 mx-auto h-3.5 w-[66%] rounded-[50%] bg-zinc-900/20 blur-md"
          />
        )}
        {imageUrl && (
          <motion.img
            src={imageUrl}
            alt={title}
            onLoad={() => setImgLoaded(true)}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: imgLoaded ? 1 : 0, scale: imgLoaded ? 1 : 0.98 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-10 h-full w-full object-contain"
          />
        )}
      </div>

      {/* Identification — persistent */}
      <div className="mt-4 text-center">
        {ready ? (
          <motion.div {...fade}>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-zinc-900">{title}</h1>
            {maskedVin && (
              <p className="mt-1 font-mono text-[13px] tracking-wide text-zinc-500">VIN: {maskedVin}</p>
            )}
            <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-[hsl(var(--cta-offer))]">
              <Check className="h-4 w-4" /> {maskedVin ? "Matched from your VIN" : "We matched your vehicle"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <div className="mx-auto h-5 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="mx-auto h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
          </div>
        )}
        <button
          type="button"
          onClick={onReenter}
          className="mt-2 text-[12px] text-zinc-400 hover:text-zinc-600"
        >
          Not your vehicle? <span className="font-semibold text-[hsl(var(--cta-offer))]">Update</span>
        </button>
      </div>

      {/* ── Swapping panel: condition ⇄ color (hero above stays put) ── */}
      <div className="mt-7 min-h-[260px]">
        <AnimatePresence mode="wait" initial={false}>
          {view === "condition" ? (
            <motion.div key="condition" {...panelSwap}>
              <h2 className="text-[17px] font-bold text-zinc-900">What's the condition of your vehicle?</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Select the option that best describes your vehicle.</p>

              <div className="mt-3 grid gap-2.5">
                {(ready ? CONDITIONS : []).map(({ value, label, desc }) => {
                  const selected = condition === value;
                  return (
                    <motion.button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => pickCondition(value)}
                      whileTap={{ scale: 0.99 }}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                        selected
                          ? "border-[hsl(var(--cta-offer))] bg-[hsl(var(--cta-offer)/0.06)] shadow-[0_6px_20px_-10px_hsl(var(--cta-offer)/0.6)]"
                          : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:border-[hsl(var(--cta-offer)/0.6)] hover:shadow-sm"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-zinc-900">{label}</p>
                        <p className="text-[13px] leading-snug text-zinc-500">{desc}</p>
                      </div>
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                          selected ? "border-[hsl(var(--cta-offer))] bg-[hsl(var(--cta-offer))]" : "border-zinc-300"
                        }`}
                      >
                        {selected && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                            <Check className="h-3.5 w-3.5 text-[color:var(--cta-offer-text)]" />
                          </motion.span>
                        )}
                      </span>
                    </motion.button>
                  );
                })}
                {!ready &&
                  [0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-zinc-100" />
                  ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="color" {...panelSwap}>
              <h2 className="text-[17px] font-bold text-zinc-900">Pick your vehicle's color</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Factory color options for your {vehicle?.year} {vehicle?.make} {vehicle?.model}.
              </p>

              {/* Black Book swatches — each a formatted, clickable box. */}
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {colors.map((c) => {
                  const swatch = swatchColor(c);
                  const selected = colorCode === c.code;
                  return (
                    <button
                      key={c.code || c.name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => pickColor({ code: c.code, name: c.name, hex: swatch })}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-2.5 text-center transition",
                        selected
                          ? "border-[hsl(var(--cta-offer))] bg-[hsl(var(--cta-offer)/0.06)] shadow-sm"
                          : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:border-[hsl(var(--cta-offer)/0.6)] hover:shadow-sm",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="h-10 w-10 rounded-full border border-black/10 shadow-inner"
                        style={{ background: swatch }}
                      />
                      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-zinc-700">
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={skipColor}
                className="mt-5 block w-full text-center text-xs font-medium text-zinc-500 hover:underline"
              >
                Skip color selection
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Track Your Vehicle Value — persistent secondary ── */}
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
          <TrendIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-zinc-700">Track Your Vehicle Value</p>
          <p className="text-[11.5px] leading-snug text-zinc-500">
            Get notified when your vehicle's market value changes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("hartecash-open-tracker"))}
          className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold text-zinc-500 hover:text-[hsl(var(--cta-offer))]"
        >
          Learn More <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Trust ── */}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-zinc-400">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Your information is secure and only used to calculate your vehicle value.
      </p>
    </div>
  );
}

/** Tiny upward trend chart for the value-tracking feature. */
function TrendIcon() {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" fill="none" aria-hidden="true">
      <path
        d="M2 16 L8 11 L13 13 L24 3"
        stroke="hsl(var(--cta-offer))"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="3" r="2.4" fill="hsl(var(--cta-offer))" />
    </svg>
  );
}
