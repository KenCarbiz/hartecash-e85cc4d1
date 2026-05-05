import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle, ShieldCheck, Loader2, DollarSign, TrendingUp, Printer, Info, Sparkles } from "lucide-react";
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
import SaveOfferButton from "@/components/offer/SaveOfferButton";
import { track } from "@/lib/analytics";
import { getTaxRateFromZip, calcTradeInValue, STATE_NAMES } from "@/lib/salesTax";

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
  bb_tradein_avg: number | null;
  bb_wholesale_avg: number | null;
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
  // Sell vs Trade-In tab — Trade-In adds the customer's state sales-tax
  // rate to the cash offer so they can see what the offer is "worth"
  // applied against another vehicle purchase. Mirrors the legacy
  // OfferPage tab toggle behavior.
  const [activeTab, setActiveTab] = useState<"sell" | "trade">("sell");

  // Edit-details dialog — only the two fields that meaningfully
  // change the offer (mileage, condition). VIN / color / powertrain
  // don't move the price so we don't expose them. Dialog mirrors
  // the legacy InlineEdit pattern but compressed to one panel.
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [editMileage, setEditMileage] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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
        setSubmission((data as unknown as PortalSubmission[])[0]);
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
            className="rounded-full px-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100"
          >
            Back to {config.dealership_name || "home"}
          </Button>
        </div>
      </div>
    );
  }

  const s = submission;
  const isAccepted = !!s.progress_status && LOCKED_OFFER_STATUSES.has(s.progress_status);
  // Demo-mode fallback. When site_config.demo_mode is on, every
  // customer-facing offer clamps to demo_offer_amount — including
  // submissions that were created BEFORE demo mode was switched on
  // (those rows have null offered_price). Lets the dealer drop a
  // single dealership into demo for a sales presentation without
  // backfilling old leads.
  const isDemoMode = (config as any)?.demo_mode === true;
  const demoOfferAmount = Number((config as any)?.demo_offer_amount ?? 23599) || 23599;

  // Cash-offer fallback chain — demo mode wins outright when on.
  // Otherwise: manual offer → estimated → BB trade-in avg → BB
  // wholesale avg. Last resort 0 → "awaiting appraisal" state.
  const cashOffer = isDemoMode
    ? demoOfferAmount
    : (s.offered_price ??
       s.estimated_offer_high ??
       s.bb_tradein_avg ??
       s.bb_wholesale_avg ??
       0);
  const offerPending = cashOffer <= 0;

  // Trade-in calculation — uses the customer's ZIP to look up their
  // state sales-tax rate, then adds that as a "tax credit" since
  // trading instead of selling for cash defers sales tax on the
  // replacement purchase. CT default at 6.35% if no zip on file.
  const zipResult = getTaxRateFromZip(s.zip || "");
  const taxRate = zipResult.state ? zipResult.rate : 0.0635;
  const taxSavings = cashOffer * taxRate;
  const tradeInValue = calcTradeInValue(cashOffer, taxRate);
  const displayedAmount = activeTab === "trade" ? tradeInValue : cashOffer;

  const acceptUrl = `/deal/${token}${activeTab === "trade" ? "?mode=trade" : ""}`;
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

  /** Save mileage + condition edits — same pattern as legacy
   *  InlineEdit. Re-fetch the submission so the offer recomputes
   *  from the fresh values via the same fallback chain. */
  const handleSaveDetails = async () => {
    if (!s) return;
    setEditSaving(true);
    try {
      const cleanMileage = editMileage.replace(/[^0-9]/g, "");
      await supabase
        .from("submissions")
        .update({
          mileage: cleanMileage || null,
          overall_condition: editCondition || null,
        } as any)
        .eq("token", token!);
      // Re-fetch so the displayed offer reflects any backend recompute.
      const { data } = await supabase.rpc("get_submission_portal", { _token: token });
      if (data && (data as unknown[]).length > 0) {
        setSubmission((data as unknown as PortalSubmission[])[0]);
      } else {
        // Optimistic fallback if the RPC didn't return.
        setSubmission({ ...s, mileage: cleanMileage || null, overall_condition: editCondition || null });
      }
      setShowEditDetails(false);
      toast({ title: "Updated", description: "Your details have been saved." });
    } catch (e) {
      toast({
        title: "Couldn't save",
        description: (e as Error).message || "Please try again.",
        variant: "destructive",
      });
    }
    setEditSaving(false);
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
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="max-w-[960px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {config.logo_url ? (
              <img
                src={config.logo_url}
                alt={config.dealership_name}
                className="h-12 md:h-14 w-auto object-contain"
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
          {/* Quiet inline detail line in place of a full Vehicle
              Summary card. Mileage / color / condition with an
              inline edit affordance — opens a small dialog with
              just the two fields that move the price. */}
          <div className="text-sm text-zinc-500 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {s.mileage && (
              <>
                <span className="tabular-nums">{Number(s.mileage).toLocaleString()} mi</span>
                <span className="text-zinc-300" aria-hidden="true">·</span>
              </>
            )}
            {s.exterior_color && (
              <>
                <span>{s.exterior_color}</span>
                <span className="text-zinc-300" aria-hidden="true">·</span>
              </>
            )}
            {conditionLabel && (
              <>
                <span>{conditionLabel} condition</span>
                <span className="text-zinc-300" aria-hidden="true">·</span>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setEditMileage(s.mileage || "");
                setEditCondition(s.overall_condition || "");
                setShowEditDetails(true);
              }}
              className="font-semibold text-zinc-900 hover:text-zinc-600 transition-colors print:hidden"
            >
              Edit details
            </button>
          </div>
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

        {/* ── Sell vs Trade-In tabs ──
              Cash offer is the as-paid number. Trade-In adds the
              customer's state sales-tax rate as a "tax credit" so they
              can see what the same number is worth applied against
              another vehicle purchase. Sliding pill behind the active
              tab matches the Clarity premium-soft easing. */}
        {!offerPending && !isAccepted && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex bg-zinc-100 rounded-full p-1 max-w-sm mx-auto print:hidden"
            role="tablist"
            aria-label="Offer view"
          >
            <motion.div
              className="absolute top-1 bottom-1 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
              layout
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                width: "calc(50% - 4px)",
                left: activeTab === "sell" ? "4px" : "calc(50% + 0px)",
              }}
              aria-hidden="true"
            />
            <button
              role="tab"
              aria-selected={activeTab === "sell"}
              onClick={() => setActiveTab("sell")}
              className={`relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                activeTab === "sell" ? "text-zinc-900" : "text-zinc-500"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" aria-hidden="true" />
              Cash offer
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "trade"}
              onClick={() => setActiveTab("trade")}
              className={`relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                activeTab === "trade" ? "text-zinc-900" : "text-zinc-500"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              Trade-in value
            </button>
          </motion.div>
        )}

        {/* ── Offer reveal card — the moment of truth ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-4"
        >
          {offerPending ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Awaiting appraisal
              </p>
              <p className="font-sans text-[44px] md:text-[60px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
                Pricing in progress
              </p>
              <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
                Our appraiser is putting a number together and will reach out within 24 hours.
                {config.phone && (
                  <>
                    {" "}
                    Or call us now at{" "}
                    <a
                      href={`tel:${config.phone}`}
                      className="font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
                    >
                      {config.phone}
                    </a>
                    .
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <AnimatePresence mode="wait">
                {activeTab === "sell" ? (
                  <motion.div
                    key="sell"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-2"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      {isAccepted ? "Accepted cash offer" : "Your cash offer"}
                    </p>
                    <p className="font-sans text-[64px] md:text-[88px] font-bold tracking-[-0.035em] leading-[1] text-zinc-900 tabular-nums">
                      ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[11px] text-zinc-500 inline-flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                      Subject to in-person inspection
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="trade"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-2"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Your trade-in total value
                    </p>
                    <p className="font-sans text-[64px] md:text-[88px] font-bold tracking-[-0.035em] leading-[1] text-emerald-600 tabular-nums">
                      ${tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[11px] text-zinc-500 inline-flex items-center justify-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                      Includes{" "}
                      <span className="font-semibold text-emerald-600">
                        ${taxSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>{" "}
                      tax credit
                      {zipResult.state ? ` (${zipResult.state})` : ""}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-wider pt-2">
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
            </>
          )}
        </motion.section>

        {/* ── Accept block ── */}
        {!offerPending && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4 print:hidden"
          >
            {isAccepted ? (
              <div className="w-full py-4 flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 text-white font-bold text-base">
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
                Offer accepted
              </div>
            ) : (
              <>
                <div className="lg:hidden">
                  <SlideToAccept
                    onAccept={handleAcceptAttempt}
                    label={`Slide to Accept $${displayedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  />
                </div>
                <div className="hidden lg:block">
                  <Button
                    onClick={handleAcceptAttempt}
                    className="w-full h-16 rounded-full text-lg font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100"
                    style={
                      config.landing_cta_color
                        ? {
                            background: config.landing_cta_color,
                            color: config.landing_cta_text_color || "#ffffff",
                          }
                        : undefined
                    }
                  >
                    Accept ${displayedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    {activeTab === "trade" ? " trade-in" : ""}
                    <ArrowRight className="w-5 h-5 ml-2" aria-hidden="true" />
                  </Button>
                </div>

                {/* Save offer + Print — sit directly under accept so
                    the customer sees both options without scrolling.
                    Print uses window.print() and the page-level
                    print:hidden classes hide chrome / forms / dialogs. */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <SaveOfferButton
                    token={s.token}
                    vehicleStr={`${s.vehicle_year} ${s.vehicle_make} ${s.vehicle_model}`.trim()}
                    customerName={s.name || undefined}
                    customerEmail={s.email || undefined}
                    customerPhone={s.phone || undefined}
                    guaranteeDays={offerLockDays}
                    dealershipName={config.dealership_name || ""}
                  />
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                    Print offer
                  </button>
                </div>
              </>
            )}
          </motion.section>
        )}

        {/* ── Boost offer accelerator ──
              Quiet emerald card with a Camera icon and a one-line
              promise. Apple-minimal version of the legacy red
              "BOOST OFFER ACCELERATOR" hero — same intent, no shout.
              Only shown when the offer isn't accepted yet. Click
              opens /boost-offer/:token. */}
        {!offerPending && !isAccepted && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Boost your offer"
            className="rounded-3xl overflow-hidden border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-[0_2px_12px_rgba(16,185,129,0.08)] print:hidden"
          >
            <button
              type="button"
              onClick={() => navigate(`/boost-offer/${s.token}`)}
              className="w-full text-left p-6 md:p-7 hover:bg-emerald-50/40 transition-colors"
            >
              <div className="flex items-start gap-5">
                <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-emerald-500 text-white items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700 mb-2 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 sm:hidden" aria-hidden="true" />
                    Boost this offer
                  </p>
                  <h3 className="text-xl md:text-[22px] font-bold tracking-tight leading-[1.15] text-zinc-900 mb-2">
                    Add photos to potentially raise this offer.
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed mb-4">
                    Customers who upload a clean photo set get a higher final number more often than not.
                    Our AI re-prices the moment they're in.
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition-colors">
                    Upload photos now
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </button>
          </motion.section>
        )}

        {/* ── Trade-In Tax Credit Explained ──
              Always rendered when the offer is real (not pending /
              not accepted) — customers see the math whether they're
              looking at the Cash or Trade tab so the "why is trade
              worth more than cash?" question never lingers. */}
        {!offerPending && (
          <motion.section
            key="trade-credit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Trade-in tax credit explained"
            className="rounded-3xl border border-zinc-200 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 md:p-7 space-y-5"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
                Trade-In Tax Credit Explained
              </h2>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              When you trade in your vehicle toward a new or pre-owned purchase at{" "}
              <span className="font-semibold text-zinc-900">
                {config.dealership_name || "the dealership"}
              </span>
              , you receive a <span className="font-semibold text-zinc-900">sales tax credit</span> on
              the value of your trade.
            </p>

            <dl className="space-y-3 text-sm border-t border-zinc-200 pt-4">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Cash offer value</dt>
                <dd className="font-medium tabular-nums text-zinc-900">
                  ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600 inline-flex items-center gap-1">
                  {zipResult.state ? STATE_NAMES[zipResult.state] : "State"} sales tax rate
                </dt>
                <dd className="font-medium tabular-nums text-zinc-900">
                  {(taxRate * 100).toFixed(2)}%
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-600">Sales tax credit savings</dt>
                <dd className="font-semibold tabular-nums text-emerald-600">
                  +${taxSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
                <dt className="text-zinc-900 font-semibold">Total trade-in value</dt>
                <dd className="font-bold tabular-nums text-zinc-900">
                  ${tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </dd>
              </div>
            </dl>

            <div className="flex items-start gap-2 pt-2">
              <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                The tax credit is based on
                {zipResult.state
                  ? ` ${STATE_NAMES[zipResult.state]}'s ${(taxRate * 100).toFixed(2)}% sales tax rate`
                  : " your state's sales tax rate"}
                . Formula: ${cashOffer.toLocaleString()} × {(1 + taxRate).toFixed(4)} = $
                {tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}.
                Actual tax credit may vary and is subject to qualifications.
              </p>
            </div>
          </motion.section>
        )}

        {/* ── Trust line — short and quiet, the Clarity language ── */}
        <p className="text-center text-[11px] text-zinc-400 leading-relaxed print:hidden">
          {config.dealership_name || "We"} purchases vehicles directly from
          consumers. {offerLockDays}-day price guarantee · No obligation ·
          Final pricing confirmed at pickup.
        </p>
      </main>

      {/* ── Edit details — slim alternative to the legacy Vehicle
            Summary card. Only the two fields that change the price
            (mileage + condition). Submit refetches the portal RPC
            so the offer reveal reflects any recompute. */}
      <Dialog open={showEditDetails} onOpenChange={setShowEditDetails}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-bold tracking-tight text-center mb-1">
            Update your details
          </DialogTitle>
          <p className="text-sm text-zinc-500 text-center mb-5">
            Change your mileage or condition and we'll re-quote.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ed-mileage" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Current mileage</Label>
              <Input
                id="ed-mileage"
                type="text"
                inputMode="numeric"
                value={editMileage}
                onChange={(e) => setEditMileage(e.target.value.replace(/[^0-9,]/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Overall condition</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "excellent", label: "Excellent" },
                  { v: "very_good", label: "Very Good" },
                  { v: "good",      label: "Good" },
                  { v: "fair",      label: "Fair" },
                ].map((opt) => {
                  const checked = editCondition === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setEditCondition(opt.v)}
                      className={`h-11 rounded-xl border text-sm font-medium transition-all ${
                        checked
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              onClick={handleSaveDetails}
              disabled={editSaving}
              className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100 font-semibold"
            >
              {editSaving ? "Saving…" : "Save and re-quote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100 font-semibold"
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
