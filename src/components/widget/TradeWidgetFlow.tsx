// Watered-down MotoAcquire-style trade/sell flow for the embeddable
// widget. Visual + step parity with the Stevens Creek Toyota slide-out:
//
//   vehicle (VIN/plate + state) → confirm (detected vehicle + image)
//   → condition (Fair/Good/Very Good/Excellent) → intent (trade/sell)
//   → contact (name/email/phone/miles/zip + track-value toggle)
//   → value (KBB-style range + "Get Firm Offer")
//   → [kept OTP] verify → firm offer
//
// Stripped vs. the full moto flow: TCPA consent wall, 8-question damage
// matrix, photo capture / boost upsell, ownership/color/scheduling.
//
// WIRING TODOs (framing — data is stubbed):
//   [ ] vehicle: Black Book VIN/plate decode (MotoStepVehicleSearch) →
//       detected Y/M/M + trim, feeds the confirm screen + image.
//   [ ] value:   estimated range from offerCalculator + condition.
//   [ ] firm:    on verified "Get Firm Offer", calculateAndPersistOffer()
//       (motoSubmission.ts) → token + offered_price; stamp embed_source /
//       embed_vehicle_label / embed_vehicle_msrp (EmbedLanding stashes
//       them in sessionStorage).

import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import MotoCard from "@/components/moto/MotoCard";
import MotoPrimaryButton from "@/components/moto/MotoPrimaryButton";
import MotoFormField from "@/components/moto/MotoFormField";
import {
  WIDGET_STEP_ORDER,
  type FirmOffer,
  type WidgetCondition,
  type WidgetIntent,
  type WidgetStep,
} from "./widgetTypes";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const CONDITIONS: { value: WidgetCondition; label: string; blurb: string }[] = [
  { value: "fair", label: "Fair", blurb: "Some cosmetic or mechanical issues." },
  { value: "good", label: "Good", blurb: "Normal wear, runs well." },
  { value: "very_good", label: "Very Good", blurb: "Minor wear, well maintained." },
  { value: "excellent", label: "Excellent", blurb: "Like new, no notable flaws." },
];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

type VehicleStage = "entry" | "confirm";
type ValueStage = "range" | "verify" | "firm";

interface FlowData {
  entryMode: "vin" | "plate";
  vehicleId: string; // VIN or plate
  state: string;
  condition: WidgetCondition | null;
  intent: WidgetIntent;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  miles: string;
  zip: string;
  trackValue: boolean;
  otp: string;
}

export default function TradeWidgetFlow({
  initialIntent,
  resolvedOffer,
}: {
  initialIntent: WidgetIntent;
  /** Existing firm offer resolved from a resume token, if any. */
  resolvedOffer: FirmOffer | null;
}) {
  const [step, setStep] = useState<WidgetStep>(resolvedOffer ? "value" : "vehicle");
  const [vehicleStage, setVehicleStage] = useState<VehicleStage>("entry");
  const [valueStage, setValueStage] = useState<ValueStage>(
    resolvedOffer && resolvedOffer.amount > 0 ? "firm" : "range",
  );
  const [data, setData] = useState<FlowData>({
    entryMode: "vin",
    vehicleId: "",
    state: "",
    condition: null,
    intent: initialIntent,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    miles: "",
    zip: "",
    trackValue: false,
    otp: "",
  });
  const set = (patch: Partial<FlowData>) => setData((d) => ({ ...d, ...patch }));

  const goNext = () => {
    const i = WIDGET_STEP_ORDER.indexOf(step);
    if (i < WIDGET_STEP_ORDER.length - 1) setStep(WIDGET_STEP_ORDER[i + 1]);
  };

  // TODO: replace with the real BB-decoded vehicle from the lookup.
  const detectedVehicle = data.vehicleId
    ? `${data.entryMode === "vin" ? "VIN" : "Plate"} ${data.vehicleId.toUpperCase()}`
    : "your vehicle";

  const contactComplete =
    data.firstName.trim() &&
    data.lastName.trim() &&
    data.email.trim() &&
    data.phone.trim() &&
    data.miles.trim() &&
    data.zip.trim();

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-5">
      <StepProgress current={step} />

      {/* ── 1. VEHICLE: entry → confirm ───────────────────────────── */}
      {step === "vehicle" && vehicleStage === "entry" && (
        <MotoCard title="What are you trading in?">
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(["vin", "plate"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ entryMode: m })}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  data.entryMode === m
                    ? "border-[hsl(var(--cta-offer))] ring-2 ring-[hsl(var(--cta-offer)/0.15)]"
                    : "border-zinc-300 hover:border-zinc-400"
                }`}
              >
                {m === "vin" ? "VIN" : "License plate"}
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            <MotoFormField
              label={data.entryMode === "vin" ? "VIN" : "License plate"}
              value={data.vehicleId}
              onChange={(e) => set({ vehicleId: e.target.value })}
            />
            {data.entryMode === "plate" && (
              <select
                value={data.state}
                onChange={(e) => set({ state: e.target.value })}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-[hsl(var(--cta-offer))] focus:ring-2 focus:ring-[hsl(var(--cta-offer)/0.15)]"
              >
                <option value="">State</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4">
            {/* TODO: run the BB decode here, then go to confirm. */}
            <MotoPrimaryButton
              disabled={
                !data.vehicleId.trim() || (data.entryMode === "plate" && !data.state)
              }
              onClick={() => setVehicleStage("confirm")}
            >
              Next
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "vehicle" && vehicleStage === "confirm" && (
        <MotoCard title="Is this your vehicle?">
          {/* TODO: real detected Y/M/M + cached image (useVehicleImage). */}
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-24 shrink-0 place-items-center rounded-md bg-zinc-100 text-[10px] text-zinc-400">
              vehicle photo
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{detectedVehicle}</p>
              <p className="text-xs text-zinc-500">We matched this to your entry.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVehicleStage("entry")}
            className="mt-3 text-xs font-medium text-[hsl(var(--cta-offer))] hover:underline"
          >
            Not your vehicle? Re-enter
          </button>
          <div className="mt-4">
            <MotoPrimaryButton onClick={goNext}>Yes, continue</MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {/* ── 2. CONDITION (4-point) ────────────────────────────────── */}
      {step === "condition" && (
        <MotoCard title="What's its condition?">
          <div className="grid gap-2">
            {CONDITIONS.map(({ value, label, blurb }) => (
              <button
                key={value}
                type="button"
                onClick={() => set({ condition: value })}
                className={`rounded-md border px-4 py-3 text-left transition ${
                  data.condition === value
                    ? "border-[hsl(var(--cta-offer))] ring-2 ring-[hsl(var(--cta-offer)/0.15)]"
                    : "border-zinc-300 hover:border-zinc-400"
                }`}
              >
                <span className="block text-sm font-semibold text-zinc-900">{label}</span>
                <span className="block text-xs text-zinc-500">{blurb}</span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <MotoPrimaryButton disabled={!data.condition} onClick={goNext}>
              Next
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {/* ── 3. INTENT ─────────────────────────────────────────────── */}
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
            <MotoPrimaryButton onClick={goNext}>Next</MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {/* ── 4. CONTACT (+ track-value toggle) ─────────────────────── */}
      {step === "contact" && (
        <MotoCard title="Where do we send your value?">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <MotoFormField
                label="First name"
                value={data.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
              />
              <MotoFormField
                label="Last name"
                value={data.lastName}
                onChange={(e) => set({ lastName: e.target.value })}
              />
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <MotoFormField
                label="Estimated miles"
                inputMode="numeric"
                value={data.miles}
                onChange={(e) => set({ miles: e.target.value.replace(/\D/g, "") })}
              />
              <MotoFormField
                label="ZIP code"
                inputMode="numeric"
                maxLength={5}
                value={data.zip}
                onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              />
            </div>
          </div>

          {/* Marketing opt-in — defaults OFF, like MotoAcquire. */}
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={data.trackValue}
              onChange={(e) => set({ trackValue: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 accent-[hsl(var(--cta-offer))]"
            />
            Track my vehicle value monthly via email
          </label>

          <div className="mt-4">
            <MotoPrimaryButton disabled={!contactComplete} onClick={goNext}>
              See my value
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {/* ── 5. VALUE: range → verify (OTP) → firm offer ───────────── */}
      {step === "value" && valueStage === "range" && (
        <MotoCard title="Your estimated trade-in value">
          {/* TODO: real estimated_offer_low/high from offerCalculator. */}
          <p className="text-4xl font-bold leading-none tabular-nums text-zinc-900">
            $1,090 <span className="font-semibold text-zinc-400">–</span> $1,915
          </p>
          <p className="mt-2 text-sm text-zinc-500">{detectedVehicle}</p>
          <button
            type="button"
            onClick={() => setStep("vehicle")}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--cta-offer))] hover:underline"
          >
            <Pencil className="h-3 w-3" /> Edit mileage
          </button>
          <p className="mt-3 text-[11px] leading-snug text-zinc-400">
            Estimated range based on market data and the condition you selected. Final value
            depends on inspection and current market factors.
          </p>
          <div className="mt-4">
            {/* MotoAcquire's red CTA — kicks off the kept-OTP gate. */}
            <MotoPrimaryButton onClick={() => setValueStage("verify")}>
              Get Firm Offer
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "value" && valueStage === "verify" && (
        <MotoCard title="Verify your number">
          {/* OTP kept (product decision) — gates the firm offer. TODO:
              wire to the moto contact-verify path; on success call
              calculateAndPersistOffer() and go to "firm". */}
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
            <MotoPrimaryButton disabled={data.otp.length !== 6} onClick={() => setValueStage("firm")}>
              Verify &amp; get firm offer
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "value" && valueStage === "firm" && (
        <MotoCard title="Your firm offer">
          {resolvedOffer && resolvedOffer.amount > 0 ? (
            <>
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
            </>
          ) : (
            // TODO: render the freshly-computed firm offer from
            // calculateAndPersistOffer(); placeholder skeleton for now.
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--cta-offer))]" />
              Building your firm number…
            </div>
          )}
        </MotoCard>
      )}
    </div>
  );
}

/** Minimal dotted step indicator — no labels, keeps the panel compact. */
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
