// VehicleConditionStep — premium "Step 2 of 5" screen shown right after
// Black Book decodes the VIN. Confirms the vehicle (large image card +
// masked VIN) and collects condition in one focused, conversion-oriented
// view. Mirrors the Stevens Creek Toyota trade widget.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import MotoPrimaryButton from "@/components/moto/MotoPrimaryButton";
import type { BBVehicle } from "@/components/sell-form/types";
import { bbVehicleLabel } from "./widgetData";
import { WIDGET_STEP_ORDER, type WidgetCondition } from "./widgetTypes";

const CONDITIONS: { value: WidgetCondition; label: string; desc: string }[] = [
  { value: "fair", label: "Fair", desc: "Noticeable wear and mechanical or cosmetic issues." },
  { value: "good", label: "Good", desc: "Average condition with normal wear." },
  { value: "very_good", label: "Very Good", desc: "Well maintained with minimal wear." },
  { value: "excellent", label: "Excellent", desc: "Exceptional condition and appearance." },
];

/** Mask the VIN to the final four digits, e.g. ********1234. */
function maskVin(vin?: string): string {
  const last4 = (vin || "").trim().slice(-4);
  return last4 ? `********${last4}` : "";
}

export default function VehicleConditionStep({
  vehicle,
  imageUrl,
  condition,
  onSelect,
  onContinue,
  onReenter,
}: {
  vehicle: BBVehicle | null;
  imageUrl: string | null;
  condition: WidgetCondition | null;
  onSelect: (c: WidgetCondition) => void;
  onContinue: () => void;
  onReenter: () => void;
}) {
  const stepNumber = WIDGET_STEP_ORDER.indexOf("condition") + 1;
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => setImgLoaded(false), [imageUrl]);

  const title = vehicle ? bbVehicleLabel(vehicle) : "";
  const maskedVin = maskVin(vehicle?.vin);
  const ready = !!vehicle; // BB decoded — title/VIN available immediately

  return (
    <div className="pb-28">
      {/* Progress */}
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        Step {stepNumber} of {WIDGET_STEP_ORDER.length}
      </p>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {WIDGET_STEP_ORDER.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-all ${
              i < stepNumber - 1
                ? "w-5 bg-[hsl(var(--cta-offer))]"
                : i === stepNumber - 1
                ? "w-5 bg-[hsl(var(--cta-offer))]"
                : "w-1.5 bg-zinc-200"
            }`}
          />
        ))}
      </div>

      <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-zinc-900">
        We found your vehicle
      </h1>
      <p className="mt-1 text-center text-sm text-zinc-500">
        Please confirm this is the vehicle you'd like to value.
      </p>

      {/* Vehicle card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)]"
      >
        <div className="relative mx-auto aspect-[16/10] w-full max-w-[340px]">
          <AnimatePresence>
            {!(imageUrl && imgLoaded) && (
              <motion.div
                key="img-skel"
                exit={{ opacity: 0 }}
                className="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200"
              />
            )}
          </AnimatePresence>
          {/* Soft ground shadow under the (background-free) side profile. */}
          {imageUrl && imgLoaded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="pointer-events-none absolute inset-x-0 bottom-[8%] z-0 mx-auto h-3 w-[64%] rounded-[50%] bg-zinc-900/20 blur-md"
            />
          )}
          {imageUrl && (
            <motion.img
              src={imageUrl}
              alt={title}
              onLoad={() => setImgLoaded(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: imgLoaded ? 1 : 0 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 z-10 h-full w-full object-contain"
            />
          )}
        </div>

        {ready ? (
          <>
            <h2 className="mt-4 text-center text-lg font-bold leading-tight text-zinc-900">
              {title}
            </h2>
            <p className="mt-0.5 text-center text-[11px] italic text-zinc-400">
              *Image may not represent exact vehicle
            </p>
            {maskedVin && (
              <p className="mt-2 text-center font-mono text-[13px] tracking-wide text-zinc-600">
                VIN: {maskedVin}
              </p>
            )}
            <p className="mt-1 inline-flex w-full items-center justify-center gap-1 text-center text-[12px] font-semibold text-[hsl(var(--cta-offer))]">
              <Check className="h-3.5 w-3.5" /> Matched from your VIN
            </p>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="mx-auto h-5 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="mx-auto h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
          </div>
        )}
      </motion.div>

      <button
        type="button"
        onClick={onReenter}
        className="mx-auto mt-3 block text-center text-[13px] text-zinc-500"
      >
        Not your vehicle?{" "}
        <span className="font-semibold text-[hsl(var(--cta-offer))] hover:underline">
          Click here
        </span>{" "}
        to update your vehicle.
      </button>

      {/* Condition */}
      <h3 className="mt-7 text-base font-bold text-zinc-900">
        What's the condition of your vehicle?
      </h3>
      <p className="mt-0.5 text-sm text-zinc-500">
        Select the option that best describes your vehicle.
      </p>

      <div className="mt-3 grid gap-2.5">
        {CONDITIONS.map(({ value, label, desc }) => {
          const selected = condition === value;
          return (
            <motion.button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(value)}
              whileTap={{ scale: 0.99 }}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? "border-[hsl(var(--cta-offer))] bg-[hsl(var(--cta-offer)/0.06)] shadow-[0_6px_20px_-10px_hsl(var(--cta-offer)/0.6)]"
                  : "border-zinc-200 bg-white hover:border-[hsl(var(--cta-offer))] hover:shadow-sm"
              }`}
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-zinc-900">{label}</p>
                <p className="text-[13px] leading-snug text-zinc-500">{desc}</p>
              </div>
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                  selected
                    ? "border-[hsl(var(--cta-offer))] bg-[hsl(var(--cta-offer))]"
                    : "border-zinc-300"
                }`}
              >
                {selected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Check className="h-3.5 w-3.5 text-[color:var(--cta-offer-text)]" />
                  </motion.span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Sticky CTA + trust */}
      <div className="sticky bottom-0 left-0 right-0 mt-6 border-t border-zinc-100 bg-white/95 px-1 pb-4 pt-3 backdrop-blur">
        <MotoPrimaryButton
          disabled={!condition}
          onClick={onContinue}
          className="min-h-[52px]"
        >
          Continue
        </MotoPrimaryButton>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12px] text-zinc-400">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Your information is secure and only used to calculate your vehicle value.
        </p>
      </div>
    </div>
  );
}
