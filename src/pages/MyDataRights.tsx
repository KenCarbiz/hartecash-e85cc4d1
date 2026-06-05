// /my-data-rights — consumer privacy-rights center ("Your Privacy
// Choices"). Lets a customer exercise access / correction / deletion /
// opt-out rights directly from the website. The request is recorded in
// privacy_requests, scoped to the dealership whose site they're on, so
// only that dealership (or a platform super-admin) can action it.
//
// Reassurance framing per product direction: the customer owns and
// controls their information and can ask to delete it at any time; the
// dealership is the controller and AutoCurb is only its service provider.

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Check } from "lucide-react";
import SEO from "@/components/SEO";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

type ReqType = "access" | "correct" | "delete" | "optout";

const OPTIONS: { value: ReqType; label: string; desc: string }[] = [
  { value: "access", label: "Get a copy of my information", desc: "See what information has been collected about you." },
  { value: "correct", label: "Correct my information", desc: "Fix information that is inaccurate." },
  { value: "delete", label: "Delete my information", desc: "Request deletion of the information about you." },
  { value: "optout", label: "Do not sell or share / opt out", desc: "Opt out of any sale or sharing of your information." },
];

const MyDataRights = () => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const dealerName = (config.dealership_name || "").trim() || "the dealership";
  const contactEmail = (config.email || "").trim();
  const contactPhone = (config.phone || "").trim();

  const [type, setType] = useState<ReqType>("delete");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

          {done ? (
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
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">What would you like to do?</p>
                <div className="grid gap-2">
                  {OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setType(o.value)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${type === o.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    >
                      <span className="block text-sm font-semibold text-foreground">{o.label}</span>
                      <span className="block text-xs text-foreground/55">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
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
