import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VehicleImage from "@/components/sell-form/VehicleImage";
import SlideToAccept from "@/components/SlideToAccept";
import { track } from "@/lib/analytics";

/**
 * Clarity-tier offer page — Apple/Porsche minimal white. Mirrors
 * ClarityTemplate.tsx typography (font-sans, tight tracking, zinc
 * palette) and easing (500ms cubic-bezier 0.16, 1, 0.3, 1).
 *
 * Mounted by OfferPage.tsx as a top-level dispatch when the dealer's
 * landing_template is "clarity". The legacy long-scroll OfferPage
 * stays the default for every other template, including the
 * "Legacy Hartecash" maximalist look.
 *
 * Scope of this scaffold: vehicle hero, big offer number, accept
 * slide, contact-info gate dialog, and a save-for-later link. Does
 * not yet include competitor comparison, inspection disclosure,
 * photo upload, schedule visit, or watch-my-car — those live in
 * the legacy OfferPage and will be ported template-by-template.
 */

const LOCKED_OFFER_STATUSES = new Set([
  "accepted",
  "info_collected",
  "appointment_scheduled",
  "appointment_confirmed",
  "appointment_completed",
  "docs_pending",
  "docs_uploaded",
  "docs_review",
  "docs_approved",
  "docs_title",
  "deal_finalized",
  "title_verified",
  "ownership_verified",
  "title_ownership_verified",
  "check_request_submitted",
  "purchase_complete",
]);

interface PortalSubmission {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  zip: string | null;
  mileage: string | null;
  exterior_color: string | null;
  overall_condition: string | null;
  offered_price: number | null;
  estimated_offer_high: number | null;
  estimated_offer_low: number | null;
  token: string;
  progress_status: string | null;
}

const CONDITION_LABEL: Record<string, string> = {
  excellent: "Excellent",
  very_good: "Very Good",
  good: "Good",
  fair: "Fair",
  Excellent: "Excellent",
  Good: "Good",
  Fair: "Fair",
  Rough: "Rough",
};

const OfferPageClarity = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const { toast } = useToast();

  const [submission, setSubmission] = useState<PortalSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Contact-gate dialog state — opens when accept is tapped without
  // contact on file (offer-first or stale link). Mirrors the legacy
  // page's gate so the deal moves into /deal/:token cleanly.
  const [showContactGate, setShowContactGate] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", zip: "" });
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [contactSaving, setContactSaving] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Invalid link.");
        setLoading(false);
        return;
      }
      // Fire-and-forget portal-view increment so the dealer's
      // engagement counters stay in sync with the legacy page.
      (supabase as any).rpc("increment_portal_view", { _token: token }).then(() => {}, () => {});
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_submission_portal", { _token: token });
        if (cancelled) return;
        if (rpcErr || !data || (data as unknown[]).length === 0) {
          setError("Offer not found.");
          setLoading(false);
          return;
        }
        setSubmission((data as PortalSubmission[])[0]);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || "Couldn't load your offer.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" aria-hidden="true" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900 px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Offer Not Available</h1>
          <p className="text-sm text-zinc-500">{error || "We couldn't find that offer."}</p>
          <Button
            onClick={() => navigate("/")}
            className="rounded-full px-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white"
          >
            Back to {config.dealership_name || "home"}
          </Button>
        </div>
      </div>
    );
  }

  const s = submission;
  const isAccepted = !!s.progress_status && LOCKED_OFFER_STATUSES.has(s.progress_status);
  const cashOffer =
    (isAccepted ? s.offered_price : s.offered_price ?? s.estimated_offer_high) ??
    s.estimated_offer_high ??
    0;
  const acceptUrl = `/deal/${token}`;
  const isMissingContact = !s.name || !s.email || !s.phone;

  const handleAcceptAttempt = () => {
    track("offer_accepted", { amount: cashOffer });
    if (isMissingContact) {
      setContactForm({
        name: s.name || "",
        email: s.email || "",
        phone: s.phone || "",
        zip: s.zip || "",
      });
      setContactErrors({});
      setShowContactGate(true);
    } else {
      window.location.href = acceptUrl;
    }
  };

  const handleContactSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!contactForm.name.trim()) errors.name = "Name is required";
    if (!contactForm.email.trim() || !/\S+@\S+\.\S+/.test(contactForm.email)) errors.email = "Valid email is required";
    const phoneDigits = contactForm.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) errors.phone = "Valid phone number is required";
    if (!contactForm.zip.trim() || contactForm.zip.replace(/\D/g, "").length < 5) errors.zip = "Valid ZIP is required";
    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      return;
    }
    setContactSaving(true);
    try {
      await supabase
        .from("submissions")
        .update({
          name: contactForm.name.trim(),
          email: contactForm.email.trim(),
          phone: contactForm.phone.trim(),
          zip: contactForm.zip.trim(),
          sms_opt_in: smsOptIn,
        } as any)
        .eq("token", token!);

      if (smsOptIn) {
        try {
          await supabase.from("consent_log").insert({
            customer_phone: contactForm.phone.trim(),
            customer_email: contactForm.email.trim(),
            consent_type: "sms_calls_email",
            consent_text: "Customer accepted offer and consented to receive SMS, calls, and emails about their vehicle.",
          } as any);
        } catch { /* non-fatal */ }
      }

      // Fire staff + customer acceptance notifications. Same pattern
      // as the legacy OfferPage so dealers' BDC alerts still trigger.
      try {
        if (s.id) {
          const ctx = { from: "OfferPageClarity.contactGate", submission_id: s.id } as const;
          safeInvoke("send-notification", {
            body: { trigger_key: "staff_customer_accepted", submission_id: s.id },
            context: ctx,
          });
          safeInvoke("send-notification", {
            body: { trigger_key: "customer_offer_accepted", submission_id: s.id },
            context: ctx,
          });
        }
      } catch { /* non-fatal */ }

      setShowContactGate(false);
      window.location.href = acceptUrl;
    } catch {
      toast({ title: "Error", description: "Failed to save your info. Please try again.", variant: "destructive" });
    }
    setContactSaving(false);
  };

  const offerLockDays = config.price_guarantee_days || 8;
  const conditionLabel = CONDITION_LABEL[s.overall_condition || ""] || s.overall_condition || "";

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* ── Header — dealer logo left, "save offer" link right ── */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-[960px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {config.logo_url ? (
              <img
                src={config.logo_url}
                alt={config.dealership_name}
                className="h-7 w-auto object-contain"
              />
            ) : (
              <span className="text-sm font-semibold tracking-tight truncate text-zinc-900">
                {config.dealership_name}
              </span>
            )}
          </div>
          {config.phone && (
            <a
              href={`tel:${config.phone}`}
              className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {config.phone}
            </a>
          )}
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-5 md:px-8 py-10 md:py-16 space-y-12">
        {/* ── Vehicle hero — big bold model line, photo below ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {s.name ? `Hi ${s.name.split(" ")[0]}, your offer is ready` : "Your offer is ready"}
          </p>
          <h1 className="font-sans text-[36px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
            {s.vehicle_year} {s.vehicle_make} {s.vehicle_model}
          </h1>
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 overflow-hidden">
            <div className="aspect-[16/9]">
              <VehicleImage
                year={s.vehicle_year || ""}
                make={s.vehicle_make || ""}
                model={s.vehicle_model || ""}
                selectedColor={s.exterior_color || ""}
                imageAngle="three_quarter"
                hideColorLabel
              />
            </div>
          </div>
        </motion.section>

        {/* ── Offer reveal card — the moment of truth ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Your cash offer
          </p>
          <p className="font-sans text-[64px] md:text-[88px] font-bold tracking-[-0.035em] leading-[1] text-zinc-900 tabular-nums">
            ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-wider">
            {conditionLabel && (
              <span className="px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-600">
                {conditionLabel} condition
              </span>
            )}
            {s.mileage && (
              <span className="px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-600">
                {Number(s.mileage).toLocaleString()} mi
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-600 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Locks for {offerLockDays} days
            </span>
          </div>
        </motion.section>

        {/* ── Accept block ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          {isAccepted ? (
            <div className="w-full py-4 flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 text-white font-bold text-base">
              <CheckCircle className="w-5 h-5" aria-hidden="true" />
              Offer Accepted
            </div>
          ) : (
            <>
              <div className="lg:hidden">
                <SlideToAccept
                  onAccept={handleAcceptAttempt}
                  label={`Slide to Accept $${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                />
              </div>
              <div className="hidden lg:block">
                <Button
                  onClick={handleAcceptAttempt}
                  className="w-full h-16 rounded-full text-lg font-semibold bg-zinc-900 hover:bg-zinc-800 text-white"
                  style={
                    config.landing_cta_color
                      ? {
                          background: config.landing_cta_color,
                          color: config.landing_cta_text_color || "#ffffff",
                        }
                      : undefined
                  }
                >
                  Accept ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  <ArrowRight className="w-5 h-5 ml-2" aria-hidden="true" />
                </Button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate(`/save-offer/${token}`)}
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Save offer for later
                </button>
              </div>
            </>
          )}
        </motion.section>

        {/* ── Trust line — short and quiet, the Clarity language ── */}
        <p className="text-center text-[11px] text-zinc-400 leading-relaxed">
          {config.dealership_name || "We"} purchases vehicles directly from
          consumers. {offerLockDays}-day price guarantee · No obligation ·
          Final pricing confirmed at pickup.
        </p>
      </main>

      {/* ── Contact-info gate — shown when accept is tapped without
            name / email / phone / zip on file. Same persistence
            behavior as the legacy OfferPage so dealer alerts fire. */}
      <Dialog open={showContactGate} onOpenChange={setShowContactGate}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-bold tracking-tight text-center mb-1">
            One last thing
          </DialogTitle>
          <p className="text-sm text-zinc-500 text-center mb-5">
            We'll send your acceptance confirmation and pickup details here.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cg-name" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Full name</Label>
              <Input
                id="cg-name"
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                autoComplete="name"
              />
              {contactErrors.name && <p className="text-xs text-red-600">{contactErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cg-phone" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Cell phone</Label>
              <Input
                id="cg-phone"
                type="tel"
                inputMode="tel"
                value={contactForm.phone}
                onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                autoComplete="tel"
              />
              {contactErrors.phone && <p className="text-xs text-red-600">{contactErrors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cg-email" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Email</Label>
              <Input
                id="cg-email"
                type="email"
                inputMode="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                autoComplete="email"
              />
              {contactErrors.email && <p className="text-xs text-red-600">{contactErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cg-zip" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">ZIP</Label>
              <Input
                id="cg-zip"
                inputMode="numeric"
                value={contactForm.zip}
                onChange={(e) => setContactForm((p) => ({ ...p, zip: e.target.value }))}
                autoComplete="postal-code"
              />
              {contactErrors.zip && <p className="text-xs text-red-600">{contactErrors.zip}</p>}
            </div>
            <label className="flex items-start gap-2 text-xs text-zinc-500 leading-relaxed">
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Text me status updates about my deal. Reply STOP any time. Msg & data rates apply.
              </span>
            </label>
            <Button
              onClick={handleContactSubmit}
              disabled={contactSaving}
              className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
            >
              {contactSaving ? "Saving…" : "Confirm and continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfferPageClarity;
