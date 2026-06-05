// Watered-down MotoAcquire-style trade/sell flow — now wired to the real
// engine (bb-lookup → offer calc/persist → SMS OTP → firm offer).
//
//   vehicle (VIN/plate + state) → confirm (BB vehicle + image)
//   → condition (Fair/Good/Very Good/Excellent) → intent (trade/sell)
//   → contact (name/email/phone/miles/zip + track-value toggle)
//   → value (real KBB-style range → OTP verify → firm offer)
//
// Lead is captured at "See my value" (persistWidgetOffer inserts the
// submissions row, stamped with embed attribution); the firm number is
// gated behind SMS verification (kept per product decision).

import { useEffect, useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";
import MotoCard from "@/components/moto/MotoCard";
import MotoPrimaryButton from "@/components/moto/MotoPrimaryButton";
import MotoFormField from "@/components/moto/MotoFormField";
import { MotoOutlinedInput, MotoOutlinedSelect } from "@/components/moto/MotoOutlinedField";
import { fetchModelsForMakeYear, MAKE_OPTIONS, YEAR_OPTIONS } from "@/components/moto/ymmData";
import { cn } from "@/lib/utils";
import { useVehicleImage } from "@/hooks/useVehicleImage";
import tenantHeroVehicle from "@/assets/tenant-hero-vehicle.webp";
import HowItWorksLean from "@/components/moto-sections/HowItWorksLean";
import ValueTrackerCard from "@/components/moto-sections/ValueTrackerCard";
import FAQLean from "@/components/moto-sections/FAQLean";
import type { BBVehicle } from "@/components/sell-form/types";
import VehicleConditionStep from "./VehicleConditionStep";
import {
  bbVehicleLabel,
  computeWidgetEstimate,
  decodeVehicle,
  markApplied,
  persistWidgetOffer,
  sendWidgetOtp,
  verifyWidgetOtp,
  type WidgetFlowData,
} from "./widgetData";
import {
  WIDGET_STEP_ORDER,
  type VdpContext,
  type WidgetCondition,
  type WidgetIntent,
  type WidgetStep,
} from "./widgetTypes";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Progressive (xxx) xxx-xxxx formatting; downstream strips non-digits. */
function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length > 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length > 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length > 0) return `(${d}`;
  return "";
}

type VehicleStage = "entry" | "confirm";
// range → (verify) → firm → (boost → reeval) → done. verify is skipped
// when require_phone_verification is off; boost/reeval only when the
// dealer enables AI photos; done is the accept confirmation.
type ValueStage = "range" | "verify" | "firm" | "boost" | "reeval" | "done";

export default function TradeWidgetFlow({
  initialIntent,
  dealershipId,
  dealershipName,
  vdp,
  requireVerify,
  aiPhotosEnabled,
  defaultZip = "",
}: {
  initialIntent: WidgetIntent;
  dealershipId: string;
  dealershipName?: string;
  /** VDP the customer is on (drives the "apply toward this car" target). */
  vdp: VdpContext | null;
  /** Dealer toggle: gate the firm offer behind an SMS code. */
  requireVerify: boolean;
  /** Dealer toggle: offer the AI photo boost / re-evaluation. */
  aiPhotosEnabled: boolean;
  /** Customer ZIP from the embed context — prefilled into the form. */
  defaultZip?: string;
}) {
  const [step, setStep] = useState<WidgetStep>("vehicle");
  const [vehicleStage, setVehicleStage] = useState<VehicleStage>("entry");
  const [valueStage, setValueStage] = useState<ValueStage>("range");
  const [boosted, setBoosted] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bb, setBb] = useState<BBVehicle | null>(null);
  // All trims the VIN/plate decoded to — the customer picks the exact one.
  const [candidates, setCandidates] = useState<BBVehicle[]>([]);
  const [estimate, setEstimate] = useState<{ low: number | null; high: number | null } | null>(null);
  const [firm, setFirm] = useState<number | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  // The submissions row is written exactly once (on firm-offer reveal),
  // so editing mileage / re-running the range never duplicates a lead.
  const persistedToken = useRef<string | null>(null);

  const [data, setData] = useState<WidgetFlowData & { otp: string }>({
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
    zip: defaultZip,
    trackValue: false,
    colorCode: "",
    colorName: "",
    otp: "",
  });
  const set = (patch: Partial<typeof data>) => setData((d) => ({ ...d, ...patch }));

  // YMM progressive fallback (mirrors MotoStepVehicleSearch on the landing
  // page): Year → Make → Model → optional Trim, plus a VIN field under an
  // OR divider. Either path (full YMM or 17-char VIN) enables Next.
  const [ymmYear, setYmmYear] = useState("");
  const [ymmMake, setYmmMake] = useState("");
  const [ymmModel, setYmmModel] = useState("");
  const [ymmTrim, setYmmTrim] = useState("");
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!ymmYear || !ymmMake) {
      setModelOptions([]);
      return;
    }
    setModelsLoading(true);
    fetchModelsForMakeYear(ymmMake, ymmYear).then((opts) => {
      if (cancelled) return;
      setModelOptions(opts);
      setModelsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ymmYear, ymmMake]);

  const vinClean = data.entryMode === "vin" ? data.vehicleId.trim().toUpperCase() : "";
  const plateClean = data.entryMode === "plate" ? data.vehicleId.trim().toUpperCase() : "";
  const vinReady = vinClean.length === 17;
  const ymmReady = !!ymmYear && !!ymmMake && !!ymmModel;
  const plateReady = plateClean.length >= 2 && !!data.state;
  const canSubmitEntry =
    data.entryMode === "vin" ? vinReady || ymmReady : plateReady;

  // Decoded-vehicle image for the Step 2 card. Real photo first — Black
  // Book (EVOX) by the exact uvc → Wikipedia/internet → AI render — as a
  // clean side profile (no background; the card adds the under-vehicle
  // shadow). studioOnly=false enables the BB/internet path.
  const heroUrl = useVehicleImage(
    bb?.year, bb?.make, bb?.model, bb?.vin, undefined, bb?.uvc, false, "side",
  );
  // Re-rendered hero once the customer picks a factory color. Forces a
  // clean studio render in the chosen color so the intent step shows
  // *their* car (not the stock photo).
  const coloredHeroUrl = useVehicleImage(
    bb?.year, bb?.make, bb?.model, bb?.vin, undefined, bb?.uvc,
    !!data.colorName, "side", data.colorName || undefined,
  );
  const intentHeroUrl = (data.colorName && coloredHeroUrl) || heroUrl;

  const goNext = () => {
    const i = WIDGET_STEP_ORDER.indexOf(step);
    if (i < WIDGET_STEP_ORDER.length - 1) setStep(WIDGET_STEP_ORDER[i + 1]);
  };

  const detectedVehicle = bb
    ? bbVehicleLabel(bb)
    : data.vehicleId
    ? `${data.entryMode.toUpperCase()} ${data.vehicleId.toUpperCase()}`
    : "your vehicle";

  const contactComplete =
    !!data.firstName.trim() &&
    !!data.lastName.trim() &&
    /.+@.+\..+/.test(data.email) &&
    data.phone.replace(/\D/g, "").length === 10 &&
    !!data.miles.trim() &&
    data.zip.length === 5;

  // Accept-CTA copy — names the VDP vehicle when trading toward it.
  const applyLabel =
    data.intent === "trade"
      ? vdp
        ? `Apply toward this ${vdp.vehicleLabel}`
        : "Apply toward a vehicle"
      : "Lock in this offer";

  // ── async actions ──────────────────────────────────────────────
  const decode = async () => {
    setBusy(true);
    setError(null);
    // YMM fallback: no VIN/plate decode call — build a stub BBVehicle
    // (same pattern as the landing page) and advance to the condition
    // step. Real pricing fills in once mileage + condition are known.
    if (data.entryMode === "vin" && !vinReady && ymmReady) {
      const stub: BBVehicle = {
        uvc: "", vin: "",
        year: ymmYear, make: ymmMake, model: ymmModel, series: ymmTrim,
        style: "", class_name: "",
        msrp: 0, price_includes: "",
        drivetrain: "", transmission: "", engine: "", fuel_type: "",
        exterior_colors: [],
        mileage_adj: 0, regional_adj: 0, base_whole_avg: 0,
        add_deduct_list: [],
        wholesale: { xclean: 0, clean: 0, avg: 0, rough: 0 },
        tradein: { clean: 0, avg: 0, rough: 0 },
        retail: { xclean: 0, clean: 0, avg: 0, rough: 0 },
        _nhtsa: true,
      };
      setBusy(false);
      setBb(stub);
      setCandidates([stub]);
      setStep("condition");
      return;
    }
    const { vehicles, error: err } = await decodeVehicle(data, dealershipId);
    setBusy(false);
    if (!vehicles.length) {
      setError(err || "We couldn't find that vehicle.");
      return;
    }
    setCandidates(vehicles);
    if (vehicles.length === 1) {
      // Single match → straight to condition. Color picker comes AFTER
      // condition (only if Black Book returned factory color options).
      setBb(vehicles[0]);
      setStep("condition");
    } else {
      // Multiple trims → make the customer pick first.
      setBb(null);
      setVehicleStage("confirm");
    }
  };

  // Compute the range only — no DB write yet (so editing mileage can't
  // duplicate a lead). The row is persisted once on firm-offer reveal.
  const seeValue = async () => {
    setBusy(true);
    setError(null);
    try {
      const est = await computeWidgetEstimate(data, bb, dealershipId);
      setEstimate({ low: est.low, high: est.high });
      setFirm(est.firm);
      setStep("value");
      setValueStage("range");
    } catch {
      setError("We couldn't calculate your value. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Insert the submissions row exactly once (lead capture at firm-offer
  // reveal, matching the main flow). Best-effort: a failed write doesn't
  // block showing the number the customer was promised.
  const persistOnce = async () => {
    if (persistedToken.current) return;
    try {
      const result = await persistWidgetOffer(data, bb, dealershipId);
      persistedToken.current = result.submissionToken;
      if (result.firm != null) setFirm(result.firm);
    } catch (e) {
      console.warn("[widget] persist failed:", e);
    }
  };

  const revealFirm = async () => {
    setValueStage("firm");
    await persistOnce();
  };

  const getFirm = async () => {
    // Dealer toggle: when phone verification is off, reveal the firm
    // offer immediately — no SMS code (same as the main flow).
    if (!requireVerify) {
      await revealFirm();
      return;
    }
    setBusy(true);
    setError(null);
    const { challengeId: cid, error: err } = await sendWidgetOtp(data.phone, dealershipName);
    setBusy(false);
    if (!cid) {
      setError(err === "rate_limited" ? "Too many attempts — try again later." : "Couldn't send the code.");
      return;
    }
    setChallengeId(cid);
    setValueStage("verify");
  };

  // AI photo boost — same idea as the main flow's "Save My Offer →
  // upload photos → AI re-inspects → new value". Stubbed re-eval for now
  // (TODO: reuse the MotoStepPhotos upload + AI inspection pipeline and
  // re-run the waterfall with the photo-derived condition).
  const submitBoost = async () => {
    setBusy(true);
    setError(null);
    // TODO: upload photos, run AI inspection, re-run calculateAndPersistOffer.
    await new Promise((r) => setTimeout(r, 600));
    setBoosted(firm != null ? Math.round(firm * 1.06) : null);
    setBusy(false);
    setValueStage("reeval");
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    const { challengeId: cid, error: err } = await sendWidgetOtp(data.phone, dealershipName);
    setBusy(false);
    if (!cid) {
      setError(err === "rate_limited" ? "Too many attempts — try again later." : "Couldn't resend the code.");
      return;
    }
    setChallengeId(cid);
    set({ otp: "" });
  };

  const verify = async () => {
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    const { ok, error: err, attemptsRemaining } = await verifyWidgetOtp(challengeId, data.otp);
    setBusy(false);
    if (!ok) {
      setError(
        err === "wrong_code"
          ? `Wrong code. ${attemptsRemaining ?? 0} attempts left.`
          : err === "expired"
          ? "Code expired — resend it."
          : "Verification failed. Try again.",
      );
      return;
    }
    await revealFirm();
  };

  // Customer accepts / applies the offer. Records the trade target (which
  // inventory car, on a VDP) and tells the parent so the floating button
  // flips to "view your accepted offer".
  const accept = async () => {
    setBusy(true);
    await persistOnce();
    await markApplied(persistedToken.current, data.intent, vdp);
    try {
      window.parent.postMessage(
        {
          type: "hartecash-state-change",
          token: persistedToken.current,
          status: "deal_accepted",
          offer: boosted ?? firm ?? 0,
        },
        "*",
      );
    } catch {
      /* not in an iframe — ignore */
    }
    setBusy(false);
    setValueStage("done");
  };

  return (
    <>
    <div id="sell-car-form" className="mx-auto w-full max-w-[540px] px-7 py-6">
      {/* First screen leads with a headline; the premium Step 2 renders its
          own progress; the rest show the compact progress dots. */}
      {step === "vehicle" && vehicleStage === "entry" ? (
        <div className="mb-5">
          <h1 className="text-[32px] font-bold leading-[1.12] tracking-tight text-zinc-900">
            Get an{" "}
            <span className="text-[hsl(var(--cta-offer))]">Instant Vehicle Valuation</span>
          </h1>
          <p className="mt-2.5 text-[15px] leading-snug text-zinc-500">
            Get an instant value — then add a few details to lock in your firm offer.
          </p>
        </div>
      ) : step === "condition" ? null : (
        <StepProgress current={step} />
      )}

      {/* ── 1. VEHICLE: entry → confirm ───────────────────────────── */}
      {step === "vehicle" && vehicleStage === "entry" && (
        <>
        <MotoCard className="p-6">
          {/* Vehicle Search / License Plate tabs — same purple pill chip
              and zinc-100 track as the landing page (MotoStepVehicleSearch). */}
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1 text-sm font-semibold">
            {([
              { id: "vin", label: "Vehicle Search" },
              { id: "plate", label: "License Plate" },
            ] as const).map((t) => {
              const active = data.entryMode === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set({ entryMode: t.id, vehicleId: "" })}
                  className={cn(
                    "rounded-md px-3 py-2.5 transition",
                    active ? "shadow-sm" : "text-zinc-700 hover:text-zinc-900",
                  )}
                  style={active ? { background: "#6D28D9", color: "#fff" } : undefined}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {data.entryMode === "vin" && (
            <div className="space-y-4">
              <MotoOutlinedSelect
                label="Vehicle Year"
                placeholder="Vehicle Year"
                value={ymmYear}
                onChange={(e) => {
                  setYmmYear(e.target.value);
                  setYmmMake("");
                  setYmmModel("");
                  setYmmTrim("");
                }}
                options={YEAR_OPTIONS}
              />
              {ymmYear && (
                <MotoOutlinedSelect
                  label="Vehicle Make"
                  value={ymmMake}
                  onChange={(e) => {
                    setYmmMake(e.target.value);
                    setYmmModel("");
                    setYmmTrim("");
                  }}
                  options={MAKE_OPTIONS}
                />
              )}
              {ymmYear && ymmMake && (
                <MotoOutlinedSelect
                  label={modelsLoading ? "Vehicle Model (loading…)" : "Vehicle Model"}
                  value={ymmModel}
                  onChange={(e) => {
                    setYmmModel(e.target.value);
                    setYmmTrim("");
                  }}
                  options={modelOptions}
                  disabled={modelsLoading || modelOptions.length === 0}
                />
              )}
              {ymmYear && ymmMake && ymmModel && (
                <MotoOutlinedInput
                  label="Vehicle Trim"
                  value={ymmTrim}
                  onChange={(e) => setYmmTrim(e.target.value)}
                  placeholder="e.g. EX-L, Sport, Premium Luxury"
                />
              )}
              <div className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
                OR
              </div>
              <MotoOutlinedInput
                label="VIN"
                value={data.vehicleId}
                onChange={(e) => set({ vehicleId: e.target.value.toUpperCase() })}
                maxLength={17}
                autoComplete="off"
                placeholder="VIN"
              />
            </div>
          )}

          {data.entryMode === "plate" && (
            <div className="grid grid-cols-2 gap-3">
              <MotoOutlinedInput
                label="License Plate*"
                value={data.vehicleId}
                onChange={(e) => set({ vehicleId: e.target.value.toUpperCase() })}
                autoComplete="off"
              />
              <MotoOutlinedSelect
                label="State*"
                value={data.state}
                onChange={(e) => set({ state: e.target.value })}
                options={US_STATES.map((s) => ({ value: s, label: s }))}
              />
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-6">
            {/* Thin, pill-shaped Next CTA. Greyed out until inputs are valid;
                fills with the dealer's CTA color the moment they are. */}
            <MotoPrimaryButton
              className={cn(
                "w-full rounded-full py-2.5 text-sm transition-colors",
                !canSubmitEntry && "bg-zinc-100 text-zinc-500 hover:bg-zinc-100",
              )}
              loading={busy}
              disabled={!canSubmitEntry}
              onClick={decode}
            >
              Next
            </MotoPrimaryButton>
          </div>
        </MotoCard>
        {/* Reassurance banner + hero vehicle image, stacked under the form
            (the main-page hero, rearranged for the narrow panel). */}
        <div className="mt-4 rounded-lg bg-[hsl(var(--cta-offer))] px-4 py-3 text-center text-[15px] font-semibold text-[color:var(--cta-offer-text)]">
          Get a valuation in less than 30 seconds!
        </div>
        <img
          src={tenantHeroVehicle}
          alt=""
          aria-hidden="true"
          className="mx-auto mt-6 w-full max-w-[440px] object-contain"
        />
        </>
      )}

      {step === "vehicle" && vehicleStage === "confirm" && (
        <MotoCard title={candidates.length > 1 ? "Please confirm your vehicle" : "Is this your vehicle?"}>
          {candidates.length > 1 ? (
            // Black Book returned multiple trims for this VIN/plate — the
            // customer picks the exact one (drives the right UVC + value).
            <div className="grid gap-2">
              {candidates.map((c) => {
                const selected = bb?.uvc === c.uvc;
                return (
                  <button
                    key={c.uvc}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setBb(c)}
                    className={`flex items-center gap-2.5 rounded-md border px-3 py-3 text-left text-sm transition ${
                      selected
                        ? "border-[hsl(var(--cta-offer))] ring-2 ring-[hsl(var(--cta-offer)/0.15)]"
                        : "border-zinc-300 hover:border-zinc-400"
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                        selected ? "border-[hsl(var(--cta-offer))]" : "border-zinc-400"
                      }`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-[hsl(var(--cta-offer))]" />}
                    </span>
                    <span className="text-zinc-900">{bbVehicleLabel(c)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-md bg-zinc-100">
                {heroUrl ? (
                  <img src={heroUrl} alt={detectedVehicle} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-zinc-400">vehicle</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900">{detectedVehicle}</p>
                <p className="text-xs text-zinc-500">We matched this to your entry.</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setBb(null);
              setCandidates([]);
              setVehicleStage("entry");
            }}
            className="mt-3 text-xs font-medium text-[hsl(var(--cta-offer))] hover:underline"
          >
            Not your vehicle? Re-enter
          </button>
          <div className="mt-4">
            <MotoPrimaryButton
              disabled={!bb}
              onClick={() => setStep("condition")}
            >
              Yes, continue
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {/* ── 2b. COLOR (factory choices from Black Book) ───────────────
          Comes AFTER condition. Auto-skips to "intent" when Black Book
          didn't return any factory color options (YMM fallback, older
          vehicles, etc.). */}
      {step === "color" && (
        bb?.exterior_colors?.length ? (
          <MotoCard title="Pick your vehicle's color">
            <p className="mb-4 text-sm text-zinc-500">
              Factory color options for your {bb.year} {bb.make} {bb.model}.
            </p>
            <div className="grid grid-cols-4 gap-x-3 gap-y-5">
              {bb.exterior_colors.map((c) => {
                const selected = data.colorCode === c.code;
                const swatch = c.hex
                  ? c.hex.startsWith("#") ? c.hex : `#${c.hex}`
                  : c.rgb
                  ? `rgb(${c.rgb})`
                  : "#e4e4e7";
                return (
                  <button
                    key={c.code || c.name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      set({ colorCode: c.code, colorName: c.name });
                      goNext();
                    }}
                    className="flex flex-col items-center gap-1.5 text-center transition"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-12 w-12 rounded-full border shadow-sm transition",
                        selected
                          ? "border-[hsl(var(--cta-offer))] ring-2 ring-[hsl(var(--cta-offer)/0.25)] ring-offset-2"
                          : "border-zinc-300 hover:border-zinc-400",
                      )}
                      style={{ background: swatch }}
                    />
                    <span className="line-clamp-2 text-[11px] leading-tight text-zinc-700">
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                set({ colorCode: "", colorName: "" });
                goNext();
              }}
              className="mt-6 block w-full text-center text-xs font-medium text-zinc-500 hover:underline"
            >
              Skip color selection
            </button>
          </MotoCard>
        ) : (
          <ColorAutoSkip onSkip={goNext} />
        )
      )}


      {/* ── 2. CONDITION (4-point) ────────────────────────────────── */}
      {/* ── 2. CONFIRM + CONDITION (premium Step 2) ───────────────── */}
      {step === "condition" && (
        <VehicleConditionStep
          vehicle={bb}
          imageUrl={heroUrl}
          condition={data.condition}
          onSelect={(c) => set({ condition: c })}
          onContinue={goNext}
          onReenter={() => {
            setBb(null);
            setCandidates([]);
            setVehicleStage("entry");
            setStep("vehicle");
          }}
        />
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
                aria-pressed={data.intent === value}
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
              inputMode="tel"
              value={data.phone}
              onChange={(e) => set({ phone: formatPhone(e.target.value) })}
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

          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={data.trackValue}
              onChange={(e) => set({ trackValue: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 accent-[hsl(var(--cta-offer))]"
            />
            Track my vehicle value monthly via email
          </label>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4">
            <MotoPrimaryButton loading={busy} disabled={!contactComplete} onClick={seeValue}>
              See my value
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {/* ── 5. VALUE: range → verify (OTP) → firm offer ───────────── */}
      {step === "value" && valueStage === "range" && (
        <MotoCard title="Your estimated trade-in value">
          <p className="text-4xl font-bold leading-none tabular-nums text-zinc-900">
            {estimate?.low != null && estimate?.high != null
              ? <>{usd(estimate.low)} <span className="font-semibold text-zinc-400">–</span> {usd(estimate.high)}</>
              : "Estimate ready"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">{detectedVehicle}</p>
          <button
            type="button"
            onClick={() => setStep("contact")}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--cta-offer))] hover:underline"
          >
            <Pencil className="h-3 w-3" /> Edit mileage
          </button>
          <p className="mt-3 text-[11px] leading-snug text-zinc-400">
            Estimated range based on market data and the condition you selected. Final value
            depends on inspection and current market factors.
          </p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4">
            <MotoPrimaryButton loading={busy} onClick={getFirm}>
              Get Firm Offer
            </MotoPrimaryButton>
          </div>
        </MotoCard>
      )}

      {step === "value" && valueStage === "verify" && (
        <MotoCard title="Verify your number">
          <p className="mb-3 text-sm text-zinc-500">
            We texted a 6-digit code to {data.phone || "your phone"}.
          </p>
          <MotoFormField
            label="6-digit code"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            value={data.otp}
            onChange={(e) => set({ otp: e.target.value.replace(/\D/g, "").slice(0, 6) })}
          />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4">
            <MotoPrimaryButton loading={busy} disabled={data.otp.length !== 6} onClick={verify}>
              Verify &amp; get firm offer
            </MotoPrimaryButton>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={resend}
            className="mt-3 w-full text-center text-sm font-medium text-zinc-500 hover:underline disabled:opacity-50"
          >
            Didn't get it? Resend code
          </button>
        </MotoCard>
      )}

      {step === "value" && valueStage === "firm" && (
        <MotoCard title="Your firm offer">
          {firm != null && firm > 0 ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {data.intent === "trade" ? "Trade-in offer" : "Cash offer"}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-zinc-900">{usd(firm)}</p>
              <p className="mt-1 text-sm text-zinc-500">for your {detectedVehicle}</p>
              <div className="mt-4">
                <MotoPrimaryButton loading={busy} onClick={accept}>
                  {applyLabel}
                </MotoPrimaryButton>
              </div>
              {aiPhotosEnabled && (
                <button
                  type="button"
                  onClick={() => setValueStage("boost")}
                  className="mt-3 w-full text-center text-sm font-medium text-[hsl(var(--cta-offer))] hover:underline"
                >
                  Add photos for a possible higher offer
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--cta-offer))]" />
              Finalizing your number…
            </div>
          )}
        </MotoCard>
      )}

      {/* AI photo boost (dealer-toggled) — mirrors the main flow's
          "upload photos → AI re-inspects → new value → accept/save". */}
      {step === "value" && valueStage === "boost" && (
        <MotoCard title="Boost your offer with photos">
          <p className="text-sm text-zinc-500">
            Upload a few quick photos and our AI re-inspects your {detectedVehicle} — a better
            condition read can raise your offer.
          </p>
          {/* TODO: real multi-slot capture (reuse MotoStepPhotos). */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["Front", "Rear", "Interior"].map((slot) => (
              <div
                key={slot}
                className="grid h-16 place-items-center rounded-md border border-dashed border-zinc-300 text-[11px] text-zinc-400"
              >
                {slot}
              </div>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4 grid gap-2">
            <MotoPrimaryButton loading={busy} onClick={submitBoost}>
              Re-evaluate with photos
            </MotoPrimaryButton>
            <button
              type="button"
              onClick={() => setValueStage("firm")}
              className="text-center text-sm font-medium text-zinc-500 hover:underline"
            >
              Keep my current offer
            </button>
          </div>
        </MotoCard>
      )}

      {step === "value" && valueStage === "reeval" && (
        <MotoCard title="Your updated offer">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {data.intent === "trade" ? "Trade-in offer" : "Cash offer"} · after photo review
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-zinc-900">
            {boosted != null ? usd(boosted) : firm != null ? usd(firm) : "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">for your {detectedVehicle}</p>
          <div className="mt-4 grid gap-2">
            <MotoPrimaryButton loading={busy} onClick={accept}>
              {applyLabel}
            </MotoPrimaryButton>
            <button
              type="button"
              onClick={() => setValueStage("firm")}
              className="text-center text-sm font-medium text-zinc-500 hover:underline"
            >
              Save for later
            </button>
          </div>
        </MotoCard>
      )}

      {/* ── Accept confirmation ───────────────────────────────────── */}
      {step === "value" && valueStage === "done" && (
        <MotoCard title="You're all set">
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--cta-offer)/0.12)]">
            <Check className="h-5 w-5 text-[hsl(var(--cta-offer))]" aria-hidden="true" />
          </div>
          <p className="text-sm text-zinc-600">
            Your {usd(boosted ?? firm ?? 0)}{" "}
            {data.intent === "trade" ? "trade-in" : "cash"} offer is saved
            {data.intent === "trade" && vdp ? ` toward the ${vdp.vehicleLabel}` : ""}. A
            specialist will reach out to finalize the details.
          </p>
          <p className="mt-2 text-[11px] text-zinc-400">
            We sent a copy to {data.email || "your email"}.
          </p>
        </MotoCard>
      )}
    </div>

    {/* Below-fold marketing assets — full-bleed, shown only on the hero
        (entry) screen so deeper steps stay focused. Same sections as the
        main moto landing page. */}
    {step === "vehicle" && vehicleStage === "entry" && (
      <>
        <HowItWorksLean />
        <ValueTrackerCard />
        <FAQLean />
      </>
    )}
    </>
  );
}

/** Renders nothing; auto-advances past the color step when Black Book
 *  didn't return factory color options for the decoded vehicle. */
function ColorAutoSkip({ onSkip }: { onSkip: () => void }) {
  useEffect(() => {
    onSkip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
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
