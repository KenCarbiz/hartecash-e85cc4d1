import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import MotoStickyFooter from "../MotoStickyFooter";
import MotoVehicleHero from "../MotoVehicleHero";
import MotoFormField from "../MotoFormField";
import type { MotoFlowState } from "../types";
import {
  calculateAndPersistOffer,
  loadPricingRevealMode,
} from "../motoSubmission";
import { useFormConfig } from "@/hooks/useFormConfig";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type Phase = "form" | "range" | "verify";

const MotoStepContact = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const { formConfig } = useFormConfig();
  const { toast } = useToast();
  const requireVerify = formConfig.require_phone_verification !== false;

  const [firstName, setFirstName] = useState(state.contact.firstName);
  const [lastName, setLastName] = useState(state.contact.lastName);
  const [email, setEmail] = useState(state.contact.email);
  const [phone, setPhone] = useState(state.contact.phone);
  const [mileage, setMileage] = useState(state.mileage);
  const [zip, setZip] = useState(state.contact.zip);
  const [trackValue, setTrackValue] = useState(state.trackValue);

  const [phase, setPhase] = useState<Phase>("form");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Dealer pricing-reveal mode and computed range for `range_then_price`.
  const [revealMode, setRevealMode] = useState<
    "price_first" | "range_then_price" | "contact_first" | null
  >(null);
  const [computingRange, setComputingRange] = useState(false);
  const [rangeLow, setRangeLow] = useState<number | null>(state.offer.low);
  const [rangeHigh, setRangeHigh] = useState<number | null>(state.offer.high);

  useEffect(() => {
    let cancelled = false;
    loadPricingRevealMode(tenant.dealership_id).then((m) => {
      if (!cancelled) setRevealMode(m);
    });
    return () => {
      cancelled = true;
    };
  }, [tenant.dealership_id]);

  const formValid =
    firstName.trim() &&
    lastName.trim() &&
    isEmail(email) &&
    phone.replace(/\D/g, "").length === 10 &&
    Number(mileage.replace(/\D/g, "")) > 0 &&
    zip.replace(/\D/g, "").length >= 5;

  const persistContactToState = () => ({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    phone,
    phoneVerified: false,
    zip,
  });

  // For range-mode dealers: compute the estimate + create the submission
  // BEFORE we send the OTP, so we can render the KBB-style range page.
  const goToRange = async () => {
    setComputingRange(true);
    try {
      // If we already computed this once, skip the round-trip.
      if (state.submissionToken && state.offer.low && state.offer.high) {
        setRangeLow(state.offer.low);
        setRangeHigh(state.offer.high);
        setPhase("range");
        return;
      }
      // Build a transient state with the in-progress contact info so
      // motoSubmission can persist the row with name/email/phone.
      const transient: MotoFlowState = {
        ...state,
        contact: persistContactToState(),
        mileage: mileage.replace(/\D/g, ""),
      };
      const result = await calculateAndPersistOffer(transient, tenant.dealership_id);
      setRangeLow(result.estimate?.low ?? null);
      setRangeHigh(result.estimate?.high ?? null);
      onNext({
        submissionId: result.submissionId,
        submissionToken: result.submissionToken,
        offer: {
          low: result.estimate?.low ?? null,
          high: result.estimate?.high ?? null,
          firm: result.firm,
          aiBumped: false,
        },
      });
      setPhase("range");
    } catch (e) {
      toast({
        title: "Couldn't calculate your range",
        description: (e as Error)?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setComputingRange(false);
    }
  };

  const sendCode = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-customer-otp", {
        body: {
          phone: phone.replace(/\D/g, ""),
          dealership_name: config.dealership_name,
        },
      });
      if (error || data?.error || !data?.challenge_id) {
        const reason = data?.error || (error ? "network" : "unknown");
        const description =
          reason === "rate_limited"  ? "Too many attempts. Please wait an hour and try again." :
          reason === "invalid_phone" ? "That phone number doesn't look right — please double-check." :
          reason === "store_failed"  ? "We couldn't save your verification request. Please refresh and try again — if it persists, contact the dealer." :
          reason === "send_failed"   ? "Our SMS provider couldn't deliver to that number. Try a different mobile number, or contact the dealer." :
          reason === "internal"      ? "Something went wrong on our end. Please refresh and try again." :
          reason === "network"       ? "Couldn't reach our servers. Check your connection and try again." :
                                       "Couldn't send the code. Please try again.";
        console.warn("[MotoStepContact] sendCode failed:", { reason, error_message: error?.message });
        toast({
          title: "Couldn't send code",
          description,
          variant: "destructive",
        });
        return;
      }
      setChallengeId(data.challenge_id);
      setPhase("verify");
    } finally {
      setSending(false);
    }
  };

  // Advance straight to the offer step, skipping OTP entirely.
  // Used when the dealer has turned off "Require phone verification".
  const advanceWithoutVerify = () => {
    onNext({
      contact: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone,
        phoneVerified: false,
        zip,
      },
      mileage: mileage.replace(/\D/g, ""),
      trackValue,
      step: "offer",
    });
  };

  // From the form: range dealers go to the range page first;
  // everyone else (price_first / contact_first) jumps straight to OTP
  // — unless the dealer has disabled phone verification, in which
  // case we skip OTP entirely and reveal the firm offer.
  const submitForm = async () => {
    if (revealMode === "range_then_price") {
      await goToRange();
    } else if (requireVerify) {
      await sendCode();
    } else {
      advanceWithoutVerify();
    }
  };

  const verify = async () => {
    if (!challengeId) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-customer-otp", {
        body: { challenge_id: challengeId, code },
      });
      if (error || !data?.ok) {
        toast({
          title: "Verification failed",
          description: data?.error === "wrong_code"
            ? `Wrong code. ${data?.attempts_remaining ?? 0} attempts remaining.`
            : data?.error === "expired"
              ? "Code expired. Tap Resend Code."
              : "Try again.",
          variant: "destructive",
        });
        return;
      }
      onNext({
        contact: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone,
          phoneVerified: true,
          zip,
        },
        mileage: mileage.replace(/\D/g, ""),
        trackValue,
        step: "offer",
      });
    } finally {
      setVerifying(false);
    }
  };

  // ── Phase: RANGE ──────────────────────────────────────────────
  // KBB-style range reveal. Dealer has opted into range_then_price.
  if (phase === "range") {
    return (
      <>
        <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={mileage} />
        <MotoCard>
          {rangeLow != null && rangeHigh != null ? (
            <>
              <p className="text-center text-3xl font-bold text-zinc-900 sm:text-4xl">
                {usd(rangeLow)} – {usd(rangeHigh)}
              </p>
              <p className="mt-1 text-center text-xs text-zinc-500">
                Here is your trade-in value range
              </p>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-zinc-600">
              We need a little more info to price this one.
            </p>
          )}

          <div className="my-5 h-px bg-zinc-200" />

          <h3 className="text-center text-base font-semibold text-zinc-900">
            Ready to Sell or Trade Your Vehicle?
          </h3>
          <div className="mt-4">
            <MotoPrimaryButton
              className="py-3 opacity-100 hover:opacity-100 active:opacity-100"
              loading={sending}
              disabled={sending}
              onClick={requireVerify ? sendCode : advanceWithoutVerify}
            >
              Get Firm Offer
            </MotoPrimaryButton>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
            {requireVerify ? (
              <>We'll send a one-time code to <span className="font-semibold">{phone}</span> to
              verify your number before revealing your firm offer.{" "}</>
            ) : (
              <>Your firm offer will appear on the next screen.{" "}</>
            )}
            <button
              type="button"
              onClick={() => setPhase("form")}
              className="font-medium text-[hsl(var(--cta-offer))] underline-offset-2 hover:underline"
            >
              Wrong number?
            </button>
          </p>
        </MotoCard>
      </>
    );
  }

  // ── Phase: VERIFY ─────────────────────────────────────────────
  // For range dealers we keep the range card visible above the code
  // entry — matches the user's screenshot.
  if (phase === "verify") {
    return (
      <>
        <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={mileage} />
        {revealMode === "range_then_price" && rangeLow != null && rangeHigh != null && (
          <MotoCard className="mb-4">
            <p className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl">
              {usd(rangeLow)} – {usd(rangeHigh)}
            </p>
            <p className="mt-1 text-center text-xs text-zinc-500">
              Here is your trade-in value range
            </p>
          </MotoCard>
        )}
        <MotoCard title="Phone Verification">
          <p className="mb-3 text-sm text-zinc-700">
            Code sent to <span className="font-semibold">{phone}</span>.{" "}
            <button
              type="button"
              onClick={() => setPhase(revealMode === "range_then_price" ? "range" : "form")}
              className="font-medium text-[hsl(var(--cta-offer))] underline-offset-2 hover:underline"
            >
              Wrong number?
            </button>
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              Enter the 6-digit verification code
            </span>
            <div className="flex items-center gap-2">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-3 text-base tracking-[0.4em] outline-none focus:border-[hsl(var(--cta-offer))] focus:ring-2 focus:ring-[hsl(var(--cta-offer)/0.15)]"
              />
              <button
                type="button"
                disabled={code.length !== 6 || verifying}
                onClick={verify}
                className="rounded-md bg-[hsl(var(--cta-offer))] px-4 py-3 text-sm font-semibold text-[color:var(--cta-offer-text)] disabled:opacity-50"
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
          </label>
          <button
            type="button"
            onClick={sendCode}
            disabled={sending}
            className="mt-3 text-sm font-medium text-[hsl(var(--cta-offer))] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {sending ? "Sending…" : "Resend Code"}
          </button>
        </MotoCard>
      </>
    );
  }

  // ── Phase: FORM ───────────────────────────────────────────────
  const ctaLabel =
    revealMode === "range_then_price" ? "See My Value Range" : "Verify Phone & See Offer";
  const ctaLoading = sending || computingRange;

  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={mileage} />
      <MotoCard title="Your Contact Info">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MotoFormField label="First Name*" value={firstName} onChange={(e) => setFirstName(e.target.value)} filled={!!firstName} />
            <MotoFormField label="Last Name*" value={lastName} onChange={(e) => setLastName(e.target.value)} filled={!!lastName} />
          </div>
          <MotoFormField
            label="Email*"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            filled={!!email}
          />
          <MotoFormField
            label="Phone Number*"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            filled={!!phone}
          />
          <div className="grid grid-cols-2 gap-3">
            <MotoFormField
              label="Estimated Miles*"
              inputMode="numeric"
              value={mileage}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setMileage(digits ? Number(digits).toLocaleString() : "");
              }}
            />
            <MotoFormField
              label="Zip Code"
              inputMode="numeric"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              maxLength={5}
            />
          </div>
          <label className="flex items-center gap-3 rounded-lg bg-[hsl(var(--cta-offer)/0.06)] px-3 py-2.5">
            <Switch checked={trackValue} onCheckedChange={setTrackValue} />
            <span className="text-sm text-zinc-700">Track my vehicle value monthly via email</span>
          </label>
          <div className="hidden sm:block">
            <MotoPrimaryButton
              className="py-2 opacity-100 hover:opacity-100 active:opacity-100"
              disabled={!formValid || ctaLoading}
              loading={ctaLoading}
              onClick={submitForm}
            >
              {ctaLabel}
            </MotoPrimaryButton>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            By tapping {ctaLabel} you agree to receive a one-time SMS verification code at the
            number above. Standard message and data rates may apply. See our{" "}
            <a href="/privacy" className="font-medium text-[hsl(var(--cta-offer))] underline-offset-2 hover:underline">
              Privacy Policy
            </a>{" "}
            for how we use your information.
          </p>
        </div>
      </MotoCard>
      <MotoStickyFooter className="sm:hidden">
        <MotoPrimaryButton
          className="py-2 opacity-100 hover:opacity-100 active:opacity-100"
          disabled={!formValid || ctaLoading}
          loading={ctaLoading}
          onClick={submitForm}
        >
          {ctaLabel}
        </MotoPrimaryButton>
      </MotoStickyFooter>
    </>
  );
};

export default MotoStepContact;
