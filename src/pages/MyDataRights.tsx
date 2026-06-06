// /my-data-rights — consumer privacy-rights center ("Your Privacy
// Choices"). Two ways to exercise a right:
//
//  1. Instant, phone-verified self-service for ACCESS (export) and
//     DELETE. The customer proves they control the phone number on file
//     via an SMS code, then the deletion/export runs immediately through
//     the OTP-gated self-service-data-action edge function. The customer
//     truly controls their own data — they can delete it themselves,
//     no staff involvement, no waiting.
//
//  2. A recorded request (privacy_requests) for correction / opt-out, or
//     when the customer prefers email — routed only to the owning
//     dealership's staff (or a platform super-admin); never another
//     dealership.
//
// Reassurance framing per product direction: the customer owns and
// controls their information and can delete it at any time; the
// dealership is the controller and AutoCurb is only its service provider.

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Check, Download } from "lucide-react";
import SEO from "@/components/SEO";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

type ReqType = "access" | "correct" | "delete" | "optout";

const OPTIONS: { value: ReqType; label: string; desc: string; instant: boolean }[] = [
  { value: "access", label: "Get a copy of my information", desc: "See what information has been collected about you.", instant: true },
  { value: "delete", label: "Delete my information", desc: "Request deletion of the information about you.", instant: true },
  { value: "correct", label: "Correct my information", desc: "Fix information that is inaccurate.", instant: false },
  { value: "optout", label: "Do not sell or share / opt out", desc: "Opt out of any sale or sharing of your information.", instant: false },
];

const fmtPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

const MyDataRights = () => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const dealerName = (config.dealership_name || "").trim() || "the dealership";
  const contactEmail = (config.email || "").trim();
  const contactPhone = (config.phone || "").trim();

  const [type, setType] = useState<ReqType>("delete");

  // ── Instant verified path (access / delete) ──────────────────────
  type Phase = "choose" | "code" | "working" | "result";
  const [phase, setPhase] = useState<Phase>("choose");
  const [vphone, setVphone] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [verr, setVerr] = useState<string | null>(null);
  const [exportData, setExportData] = useState<unknown | null>(null);
  const [deleteCount, setDeleteCount] = useState<number | null>(null);

  // ── Recorded-request path (correct / optout / fallback) ──────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const instant = OPTIONS.find((o) => o.value === type)?.instant ?? false;

  const sendCode = async () => {
    if (vphone.replace(/\D/g, "").length !== 10) {
      setVerr("Enter the 10-digit mobile number on file.");
      return;
    }
    setBusy(true);
    setVerr(null);
    try {
      const { data, error: e } = await supabase.functions.invoke("send-customer-otp", {
        body: { phone: vphone.replace(/\D/g, ""), dealership_name: dealerName, purpose: "data_rights" },
      });
      if (e || !data?.challenge_id) {
        setVerr("We couldn't send a code. Check the number and try again.");
        return;
      }
      setChallengeId(data.challenge_id);
      setPhase("code");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async () => {
    if (!challengeId || otp.length !== 6) return;
    setBusy(true);
    setVerr(null);
    setPhase("working");
    try {
      const { data, error: e } = await supabase.functions.invoke("self-service-data-action", {
        body: { challenge_id: challengeId, code: otp, kind: type, dealership_id: tenant.dealership_id },
      });
      if (e || !data?.ok) {
        const reason = data?.error;
        setVerr(
          reason === "wrong_code" ? `Wrong code. ${data?.attempts_remaining ?? 0} attempts left.` :
          reason === "expired" ? "That code expired — request a new one." :
          reason === "already_used" ? "That code was already used. Please start over." :
          reason === "wrong_purpose" ? "Please request a fresh code from this page." :
          reason === "rate_limited" ? "Too many attempts. Please try again later." :
          "We couldn't complete that. Please try again.",
        );
        setPhase("code");
        return;
      }
      if (type === "access") {
        setExportData(data.result ?? {});
      } else {
        const r = data.result as { submissions_purged?: number } | undefined;
        setDeleteCount(r?.submissions_purged ?? 0);
      }
      setPhase("result");
    } finally {
      setBusy(false);
    }
  };

  const downloadExport = () => {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setError("Please provide an email or phone so we can verify and respond.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // privacy_requests isn't in the generated types until the migration
      // is applied; cast the client to insert against it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (supabase as any).from("privacy_requests").insert({
        dealership_id: tenant.dealership_id,
        request_type: type,
        name: name.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        details: details.trim() || null,
      });
      if (insErr) throw insErr;
      setDone(true);
    } catch {
      setError("We couldn't submit your request. Please try again, or contact us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetInstant = () => {
    setPhase("choose");
    setChallengeId(null);
    setOtp("");
    setVerr(null);
    setExportData(null);
    setDeleteCount(null);
  };

  const TypePicker = (
    <div>
      <p className="text-sm font-semibold text-foreground mb-2">What would you like to do?</p>
      <div className="grid gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => { setType(o.value); setDone(false); resetInstant(); }}
            className={`rounded-xl border px-4 py-3 text-left transition ${type === o.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          >
            <span className="block text-sm font-semibold text-foreground">{o.label}</span>
            <span className="block text-xs text-foreground/55">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(220 14% 98%)" }}>
      <SEO
        title={`Your Privacy Choices | ${dealerName}`}
        description={`Exercise your privacy rights with ${dealerName} — request access, correction, or deletion of your information.`}
        path="/my-data-rights"
        noindex
      />
      <main className="flex-1 px-5 py-12 lg:py-16">
        <div className="max-w-2xl mx-auto">
          <Link to="/" onClick={() => window.scrollTo(0, 0)} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>

          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-tight tracking-tight mb-3">
            Your privacy choices
          </h1>
          <p className="text-[15px] text-foreground/70 leading-relaxed mb-8">
            Your information belongs to you and is held by {dealerName}. You can ask to
            see it, correct it, or delete it at any time, and you can opt out of any
            sale or sharing. {dealerName} is the controller of your information; its
            technology provider, AutoCurb, only processes it on {dealerName}'s behalf
            and never sells it.
          </p>

          {/* INSTANT, VERIFIED: access / delete via SMS code */}
          {instant ? (
            <div className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 space-y-5">
              {TypePicker}

              {phase === "result" ? (
                <div>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 mb-3">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  {type === "access" ? (
                    <>
                      <h2 className="text-xl font-bold text-foreground mb-2">Here's your information</h2>
                      <p className="text-[15px] text-foreground/70 leading-relaxed mb-4">
                        Verified. Download a copy of everything {dealerName} holds about you.
                      </p>
                      <button onClick={downloadExport} className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold hover:bg-primary/95">
                        <Download className="w-4 h-4" /> Download my data (JSON)
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-foreground mb-2">Your information was deleted</h2>
                      <p className="text-[15px] text-foreground/70 leading-relaxed">
                        Verified and done. {deleteCount && deleteCount > 0
                          ? `${deleteCount} record${deleteCount === 1 ? "" : "s"} tied to your number ${deleteCount === 1 ? "was" : "were"} anonymized`
                          : "Any records tied to your number were anonymized"} so they can no longer
                        identify you. {dealerName} keeps only a minimal, de-identified audit trail as
                        the law allows.
                      </p>
                    </>
                  )}
                  <button onClick={resetInstant} className="mt-5 text-sm font-medium text-foreground/55 hover:text-foreground underline">
                    Done
                  </button>
                </div>
              ) : phase === "code" || phase === "working" ? (
                <div className="space-y-4">
                  <p className="text-sm text-foreground/70">
                    We texted a 6-digit code to {fmtPhone(vphone)}. Enter it to confirm it's you.
                  </p>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-full rounded-xl border border-border px-4 py-3 text-[15px] tracking-widest outline-none focus:border-primary"
                  />
                  {verr ? <p className="text-sm text-red-600">{verr}</p> : null}
                  <button
                    onClick={runAction}
                    disabled={busy || otp.length !== 6}
                    className="w-full rounded-xl bg-primary text-primary-foreground py-4 text-base font-semibold hover:bg-primary/95 disabled:opacity-50"
                  >
                    {phase === "working" ? "Working…" : type === "delete" ? "Confirm deletion" : "Verify & get my data"}
                  </button>
                  <button onClick={resetInstant} className="w-full text-center text-sm font-medium text-foreground/55 hover:underline">
                    Use a different number
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-foreground/70">
                    For your protection, {type === "delete" ? "deletion" : "access"} is confirmed by text
                    message. Enter the mobile number {dealerName} has on file and we'll send a code.
                  </p>
                  <input
                    value={vphone}
                    onChange={(e) => setVphone(fmtPhone(e.target.value))}
                    placeholder="Mobile number"
                    inputMode="tel"
                    className="w-full rounded-xl border border-border px-4 py-3 text-[15px] outline-none focus:border-primary"
                  />
                  {verr ? <p className="text-sm text-red-600">{verr}</p> : null}
                  <button
                    onClick={sendCode}
                    disabled={busy}
                    className="w-full rounded-xl bg-primary text-primary-foreground py-4 text-base font-semibold hover:bg-primary/95 disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Text me a code"}
                  </button>
                  <p className="text-xs text-foreground/50 text-center">
                    Prefer email, or don't have the number on file?{" "}
                    <button onClick={() => setType("correct")} className="text-primary underline-offset-4 hover:underline">
                      Submit a request instead
                    </button>.
                  </p>
                </div>
              )}
            </div>
          ) : done ? (
            <div className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 mb-3">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Request received</h2>
              <p className="text-[15px] text-foreground/70 leading-relaxed">
                Thank you. {dealerName} will verify your identity using the contact
                details you provided and respond within 45 days (extendable with notice
                as allowed by law). If you need to reach us sooner
                {contactPhone ? <>, call <strong className="text-foreground">{contactPhone}</strong></> : null}
                {contactEmail ? <> or email <a href={`mailto:${contactEmail}`} className="text-primary underline-offset-4 hover:underline">{contactEmail}</a></> : null}.
              </p>
              <p className="text-[13px] text-foreground/55 mt-3">
                If {dealerName} declines your request, you have the right to appeal — reply to our decision or
                contact us, and we will respond within 60 days. If your appeal is denied, Connecticut residents
                may submit a complaint to the Connecticut Attorney General at{" "}
                <a href="https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">portal.ct.gov/ag</a>.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 space-y-5">
              {TypePicker}
              <div className="grid sm:grid-cols-2 gap-4">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="rounded-xl border border-border px-4 py-3 text-[15px] outline-none focus:border-primary" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" className="rounded-xl border border-border px-4 py-3 text-[15px] outline-none focus:border-primary" />
              </div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full rounded-xl border border-border px-4 py-3 text-[15px] outline-none focus:border-primary" />
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything else we should know? (optional)" rows={3} className="w-full rounded-xl border border-border px-4 py-3 text-[15px] outline-none focus:border-primary" />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary text-primary-foreground py-4 text-base font-semibold hover:bg-primary/95 disabled:opacity-50 transition-colors">
                {submitting ? "Submitting…" : "Submit my request"}
              </button>
              <p className="text-xs text-foreground/50 text-center">
                We use the contact details above only to verify your identity and respond
                to this request. We will not deny service or charge you for exercising
                your rights.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default MyDataRights;
