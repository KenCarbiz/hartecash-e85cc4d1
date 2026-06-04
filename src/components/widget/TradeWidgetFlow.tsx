// Watered-down moto flow for the embeddable Trade/Sell widget.
//
// SCOPE (framing): this is the lean stepper skeleton. It reuses the
// moto design primitives (MotoCard / MotoPrimaryButton / MotoFormField)
// so it's visually identical to the landing flow, but deliberately
// strips everything that's "explanation of process" or disclosure:
//   • NO TCPA/SMS consent wall (StepFinalize)
//   • NO 8-question damage matrix (collapsed to a 3-point condition)
//   • NO multi-slot photo capture / AI boost upsell
//   • NO scheduling / ownership / color steps
//   • NO MotoDisclosureBar (host page owns chrome; ?embed=true)
//
// WIRING TODOs (next pass, not this framing):
//   [ ] step "vehicle":  call the Black Book lookup used by
//       MotoStepVehicleSearch (src/components/moto/steps/) to resolve
//       VIN/plate/YMM → BBVehicle.
//   [ ] step "offer":    call calculateAndPersistOffer() from
//       src/components/moto/motoSubmission.ts to insert the submission,
//       compute the firm offer (offer_settings.auto_firm_offer_pct), and
//       return the token. Stamp embed_source / embed_vehicle_label /
//       embed_vehicle_msrp from sessionStorage (set by WidgetTrade page).
//   [ ] persist the returned token to the embed localStorage key so the
//       floating button + a later VDP visit can resume (handled by the
//       parent embed.js once we postMessage hartecash-state-change).

import { useState } from "react";
import { Check } from "lucide-react";
import MotoCard from "@/components/moto/MotoCard";
import MotoPrimaryButton from "@/components/moto/MotoPrimaryButton";
import MotoFormField from "@/components/moto/MotoFormField";
import { WIDGET_STEP_ORDER, type FirmOffer, type WidgetIntent, type WidgetStep } from "./widgetTypes";

interface FlowData {
  vehicleQuery: string; // VIN / plate / "year make model"
  condition: "great" | "good" | "rough" | null;
  intent: WidgetIntent;
  firstName: string;
  email: string;
  phone: string;
  otp: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export default function TradeWidgetFlow({
  initialIntent,
  resolvedOffer,
}: {
  initialIntent: WidgetIntent;
  /** Existing firm offer resolved from a resume token, if any. */
  resolvedOffer: FirmOffer | null;
}) {
  // If the customer already has an offer, jump them straight to it.
  const [step, setStep] = useState<WidgetStep>(resolvedOffer ? "offer" : "vehicle");
  const [data, setData] = useState<FlowData>({
    vehicleQuery: "",
    condition: null,
    intent: initialIntent,
    firstName: "",
    email: "",
    phone: "",
    otp: "",
  });
  const set = (patch: Partial<FlowData>) => setData((d) => ({ ...d, ...patch }));

  const goNext = () => {
    const i = WIDGET_STEP_ORDER.indexOf(step);
    if (i < WIDGET_STEP_ORDER.length - 1) setStep(WIDGET_STEP_ORDER[i + 1]);
  };

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-5">
      <StepProgress current={step} />

      {step === "vehicle" && (
        <MotoCard title="What are you driving?">
          {/* TODO: swap for the real BB lookup (VIN/plate/YMM) used by
              MotoStepVehicleSearch — this is a placeholder input. */}
          <MotoFormField
            label="VIN, plate, or year make model"
            value={data.vehicleQuery}
            onChange={(e) => set({ vehicleQuery: e.target.value })}
          />
          <div className="mt-4">
            <MotoPrimaryButton disabled={!data.vehicleQuery.trim()} onClick={goNext}>
              Continue
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "condition" && (
        <MotoCard title="How's its condition?">
          <div className="grid gap-2">
            {(
              [
                ["great", "Great — clean, no major issues"],
                ["good", "Good — normal wear"],
                ["rough", "Rough — needs work"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => set({ condition: value })}
                className={`rounded-md border px-4 py-3 text-left text-sm transition ${
                  data.condition === value
                    ? "border-[hsl(var(--cta-offer))] ring-2 ring-[hsl(var(--cta-offer)/0.15)]"
                    : "border-zinc-300 hover:border-zinc-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <MotoPrimaryButton disabled={!data.condition} onClick={goNext}>
              Continue
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "intent" && (
        <MotoCard title="Trade it in or sell it?">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["trade", "Trade toward a car"],
                ["sell", "Just sell it"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => set({ intent: value })}
                className={`rounded-md border px-4 py-3 text-center text-sm font-medium transition ${
                  data.intent === value
                    ? "border-[hsl(var(--cta-offer))] ring-2 ring-[hsl(var(--cta-offer)/0.15)]"
                    : "border-zinc-300 hover:border-zinc-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <MotoPrimaryButton onClick={goNext}>Continue</MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "contact" && (
        <MotoCard title="Where do we send your offer?">
          {/* Lean contact: name + email + phone only. No ZIP/mileage/loan,
              no OTP wall, no TCPA checkbox (watered down on purpose). */}
          <div className="grid gap-3">
            <MotoFormField
              label="First name"
              value={data.firstName}
              onChange={(e) => set({ firstName: e.target.value })}
            />
            <MotoFormField
              label="Email"
              type="email"
              value={data.email}
              onChange={(e) => set({ email: e.target.value })}
            />
            <MotoFormField
              label="Mobile phone"
              type="tel"
              value={data.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </div>
          <div className="mt-4">
            {/* Contact-first (forced): next step is SMS verification, not
                the offer. TODO: send the OTP here. */}
            <MotoPrimaryButton
              disabled={!data.firstName.trim() || !data.email.trim() || !data.phone.trim()}
              onClick={goNext}
            >
              Text me a code
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "otp" && (
        <MotoCard title="Verify your number">
          {/* OTP kept (product decision) — the offer only reveals after a
              successful SMS verify. TODO: wire to the moto contact-verify
              path (MotoStepContact OTP) → on success call
              calculateAndPersistOffer() and advance to "offer". */}
          <p className="mb-3 text-sm text-zinc-500">
            We texted a 6-digit code to {data.phone || "your phone"}.
          </p>
          <MotoFormField
            label="6-digit code"
            inputMode="numeric"
            maxLength={6}
            value={data.otp}
            onChange={(e) => set({ otp: e.target.value.replace(/\D/g, "").slice(0, 6) })}
          />
          <div className="mt-4">
            <MotoPrimaryButton disabled={data.otp.length !== 6} onClick={goNext}>
              Verify &amp; see my offer
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "offer" && (
        <MotoCard title={resolvedOffer ? "Your offer" : "Crunching your offer…"}>
          {resolvedOffer && resolvedOffer.amount > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {data.intent === "trade" ? "Trade-in offer" : "Cash offer"}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-zinc-900">
                {usd(resolvedOffer.amount)}
              </p>
              {resolvedOffer.vehicleLabel && (
                <p className="mt-1 text-sm text-zinc-500">for your {resolvedOffer.vehicleLabel}</p>
              )}
              <div className="mt-4">
                <MotoPrimaryButton>
                  {data.intent === "trade" ? "Apply toward this vehicle" : "Lock in this offer"}
                </MotoPrimaryButton>
              </div>
            </div>
          ) : (
            // TODO: render the freshly-computed offer from
            // calculateAndPersistOffer(); placeholder skeleton for now.
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--cta-offer))]" />
              Building your number…
            </div>
          )}
        </MotoCard>
      )}
    </div>
  );
}

/** Minimal dotted step indicator — no labels, keeps the widget compact. */
function StepProgress({ current }: { current: WidgetStep }) {
  const currentIndex = WIDGET_STEP_ORDER.indexOf(current);
  return (
    <div className="mb-4 flex items-center gap-1.5">
      {WIDGET_STEP_ORDER.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <span
            key={s}
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition ${
              done
                ? "bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)]"
                : active
                ? "border-2 border-[hsl(var(--cta-offer))] text-[hsl(var(--cta-offer))]"
                : "border border-zinc-300 text-zinc-400"
            }`}
          >
            {done ? <Check className="h-3 w-3" /> : i + 1}
          </span>
        );
      })}
    </div>
  );
}
