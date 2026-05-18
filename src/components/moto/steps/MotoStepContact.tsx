import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { supabase } from "@/integrations/supabase/client";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import MotoStickyFooter from "../MotoStickyFooter";
import MotoVehicleHero from "../MotoVehicleHero";
import MotoFormField from "../MotoFormField";
import type { MotoFlowState } from "../types";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
};

const MotoStepContact = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const { config } = useSiteConfig();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(state.contact.firstName);
  const [lastName, setLastName] = useState(state.contact.lastName);
  const [email, setEmail] = useState(state.contact.email);
  const [phone, setPhone] = useState(state.contact.phone);
  const [mileage, setMileage] = useState(state.mileage);
  const [zip, setZip] = useState(state.contact.zip);
  const [trackValue, setTrackValue] = useState(state.trackValue);

  const [phase, setPhase] = useState<"form" | "verify">("form");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const formValid =
    firstName.trim() &&
    lastName.trim() &&
    isEmail(email) &&
    phone.replace(/\D/g, "").length === 10 &&
    Number(mileage.replace(/\D/g, "")) > 0 &&
    zip.replace(/\D/g, "").length >= 5;

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
        // Surface the actual server-side reason so support can tell
        // "our Twilio creds are wrong" apart from "customer typed a
        // bad number". Previously every error rendered the same
        // "Check the number and try again" message, which made
        // operator triage impossible.
        const reason = data?.error || (error ? "network" : "unknown");
        const description =
          reason === "rate_limited"  ? "Too many attempts. Please wait an hour and try again." :
          reason === "invalid_phone" ? "That phone number doesn't look right — please double-check." :
          reason === "store_failed"  ? "We couldn't save your verification request. Please refresh and try again — if it persists, contact the dealer." :
          reason === "send_failed"   ? "Our SMS provider couldn't deliver to that number. Try a different mobile number, or contact the dealer." :
          reason === "internal"      ? "Something went wrong on our end. Please refresh and try again." :
          reason === "network"       ? "Couldn't reach our servers. Check your connection and try again." :
                                       "Couldn't send the code. Please try again.";
        // Log to console so a power user or support can grep the
        // server logs by reason. Never include the user's phone.
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

  if (phase === "verify") {
    return (
      <>
        <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={mileage} />
        <MotoCard title="Phone Verification">
          <p className="mb-3 text-sm text-zinc-700">
            Code sent to <span className="font-semibold">{phone}</span>.{" "}
            <button
              type="button"
              onClick={() => setPhase("form")}
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
            placeholder="555-555-5555"
          />
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
          <label className="flex items-center gap-3 rounded-lg bg-[hsl(var(--cta-offer)/0.06)] px-3 py-2.5">
            <Switch checked={trackValue} onCheckedChange={setTrackValue} />
            <span className="text-sm text-zinc-700">Track my vehicle value monthly via email</span>
          </label>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            By tapping Verify you agree to receive a one-time SMS verification code at the number
            above. Standard message and data rates may apply. See our{" "}
            <a href="/privacy" className="font-medium text-[hsl(var(--cta-offer))] underline-offset-2 hover:underline">
              Privacy Policy
            </a>{" "}
            for how we use your information.
          </p>
        </div>
      </MotoCard>
      <MotoStickyFooter>
        <MotoPrimaryButton
          disabled={!formValid || sending}
          loading={sending}
          onClick={sendCode}
        >
          Verify Phone &amp; See Offer
        </MotoPrimaryButton>
      </MotoStickyFooter>
    </>
  );
};

export default MotoStepContact;
