import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Calendar, FileText, Camera, CheckCircle, Loader2, Download, ExternalLink, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VehicleImage from "@/components/sell-form/VehicleImage";
import ConsentDisclosure from "@/components/ConsentDisclosure";
import {
  generateICalEvent,
  downloadCalendarInvite,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from "@/lib/calendarInvite";

/**
 * Clarity-tier deal-accepted page — Apple/Porsche minimal white.
 * Mirrors ClarityTemplate.tsx (font-sans, tight tracking, zinc
 * palette, 0.55s cubic-bezier 0.16/1/0.3/1).
 *
 * Mounted by DealAccepted.tsx as a top-level dispatch when the
 * dealer's landing_template is "clarity". The legacy 800-line
 * confetti-and-celebration page stays default for every other
 * template, including Legacy Hartecash.
 *
 * Scope of this scaffold:
 *   - "Offer accepted" success badge with a soft scale-in (no
 *     confetti — Apple-minimal language)
 *   - Vehicle hero with three-quarter image
 *   - Locked cash offer number
 *   - Appointment summary card (when scheduled) with calendar
 *     invite buttons (iCal / Google / Outlook)
 *   - Next-step CTAs: Schedule / Photos / Docs
 *   - Contact-info gate dialog when name/email/phone missing
 *   - Quiet trust line
 *
 * Not yet ported: WhatToExpect timeline, EssentialUploads detail
 * card, InspectionDisclosure block, save-offer secondary CTA.
 * Layered in template-by-template per the design queue.
 */

interface DealSubmission {
  id?: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mileage: string | null;
  exterior_color: string | null;
  overall_condition: string | null;
  offered_price: number | null;
  estimated_offer_high: number | null;
  zip: string | null;
  token: string;
  appointment_set: boolean;
}

interface AppointmentData {
  preferred_date: string;
  preferred_time: string;
  location_name: string | null;
  location_address: string | null;
  location_city: string | null;
  location_state: string | null;
}

/**
 * Parse appointment date+time. Handles both formats the appointments
 * table uses: 24h "14:30:00" and 12h "2:30 PM". Returns null if either
 * piece is missing or can't be parsed.
 */
function parseAppointmentDate(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  // Already 24h ISO time: "14:30:00" or "14:30"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
    const d = new Date(`${dateStr}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`);
    return isNaN(d.getTime()) ? null : d;
  }
  // 12h "2:30 PM" / "2 PM" — split + reconstruct as 24h.
  const m = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const d = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`);
  return isNaN(d.getTime()) ? null : d;
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

const DealAcceptedClarity = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const { toast } = useToast();

  const [submission, setSubmission] = useState<DealSubmission | null>(null);
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Contact-info gate (offer-first flow drops customers here without
  // a name/email/phone; same pattern as the legacy DealAccepted).
  const [contactGateOpen, setContactGateOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", zip: "" });
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [contactSaving, setContactSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Invalid link.");
        setLoading(false);
        return;
      }
      // Mark accepted (idempotent — accept_offer guards on status).
      try {
        await supabase.rpc("accept_offer", { _token: token });
      } catch {
        /* non-fatal */
      }
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_submission_portal", { _token: token });
        if (cancelled) return;
        if (rpcErr || !data || (data as unknown[]).length === 0) {
          setError("We couldn't find that deal.");
          setLoading(false);
          return;
        }
        const sub = (data as DealSubmission[])[0];
        setSubmission(sub);

        // Open the contact gate when missing — same UX as legacy.
        if (!sub.name || !sub.email || !sub.phone) {
          setContactForm({
            name: sub.name || "",
            email: sub.email || "",
            phone: sub.phone || "",
            zip: sub.zip || "",
          });
          setContactGateOpen(true);
        } else if (sub.id) {
          // Fire staff + customer notifications on first arrival
          // (idempotent — send-notification dedupes on submission_id).
          const ctx = { from: "DealAcceptedClarity.autoFire", submission_id: sub.id } as const;
          safeInvoke("send-notification", {
            body: { trigger_key: "staff_customer_accepted", submission_id: sub.id },
            context: ctx,
          });
          safeInvoke("send-notification", {
            body: { trigger_key: "customer_offer_accepted", submission_id: sub.id },
            context: ctx,
          });
        }
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || "Couldn't load your deal.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Fetch appointment details when an appointment is on file.
  useEffect(() => {
    if (!token || !submission?.appointment_set) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("appointments")
        .select("preferred_date, preferred_time, store_location")
        .eq("submission_token", token)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      let locName: string | null = null;
      let locAddress: string | null = null;
      let locCity: string | null = null;
      let locState: string | null = null;
      if ((data as any).store_location) {
        const { data: loc } = await supabase
          .from("dealership_locations" as any)
          .select("name, address, city, state")
          .eq("id", (data as any).store_location)
          .maybeSingle();
        if (loc) {
          locName = (loc as any).name;
          locAddress = (loc as any).address;
          locCity = (loc as any).city;
          locState = (loc as any).state;
        }
      }
      setAppointment({
        preferred_date: (data as any).preferred_date,
        preferred_time: (data as any).preferred_time,
        location_name: locName,
        location_address: locAddress,
        location_city: locCity,
        location_state: locState,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, submission?.appointment_set]);

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
          <h1 className="text-2xl font-bold tracking-tight">Deal Not Found</h1>
          <p className="text-sm text-zinc-500">{error || "We couldn't find that deal."}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to {config.dealership_name || "home"}
          </Link>
        </div>
      </div>
    );
  }

  const s = submission;
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
  // Demo-mode override — see OfferPageClarity / CustomerPortalClarity
  // for the same pattern. When site_config.demo_mode is on, every
  // customer-facing offer clamps to demo_offer_amount, even on
  // submissions that pre-date the toggle being switched on.
  const isDemoMode = config.demo_mode === true;
  const demoOfferAmount = Number(config.demo_offer_amount ?? 23599) || 23599;
  const cashOffer = isDemoMode
    ? demoOfferAmount
    : (s.offered_price ?? s.estimated_offer_high ?? 0);
  const conditionLabel = CONDITION_LABEL[s.overall_condition || ""] || s.overall_condition || "";
  const scheduleLink = `/schedule?token=${s.token}&vehicle=${encodeURIComponent(vehicleStr)}&name=${encodeURIComponent(s.name || "")}&email=${encodeURIComponent(s.email || "")}&phone=${encodeURIComponent(s.phone || "")}`;

  const handleContactSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!contactForm.name.trim()) errors.name = "Name is required";
    if (!contactForm.email.trim() || !/\S+@\S+\.\S+/.test(contactForm.email)) errors.email = "Valid email is required";
    const phoneDigits = contactForm.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) errors.phone = "Valid phone number is required";
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
          zip: contactForm.zip.trim() || null,
        } as any)
        .eq("token", token!);
      // Fire acceptance notifications now that contact is in place.
      try {
        const { data: subRow } = await supabase
          .from("submissions")
          .select("id")
          .eq("token", token!)
          .maybeSingle();
        if (subRow?.id) {
          const ctx = { from: "DealAcceptedClarity.contactGate", submission_id: subRow.id } as const;
          safeInvoke("send-notification", {
            body: { trigger_key: "staff_customer_accepted", submission_id: subRow.id },
            context: ctx,
          });
          safeInvoke("send-notification", {
            body: { trigger_key: "customer_offer_accepted", submission_id: subRow.id },
            context: ctx,
          });
        }
      } catch { /* non-fatal */ }
      setSubmission((prev) =>
        prev
          ? {
              ...prev,
              name: contactForm.name.trim(),
              email: contactForm.email.trim(),
              phone: contactForm.phone.trim(),
              zip: contactForm.zip.trim() || null,
            }
          : prev,
      );
      setContactGateOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save your info. Please try again.", variant: "destructive" });
    }
    setContactSaving(false);
  };

  // Build calendar params once — used to generate the ICS string +
  // both Google and Outlook deep-links from the same source data.
  // Only valid when an appointment is on file with date + time.
  const calParams = (() => {
    if (!appointment?.preferred_date || !appointment?.preferred_time) return null;
    const start = parseAppointmentDate(appointment.preferred_date, appointment.preferred_time);
    if (!start) return null;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const location = [
      appointment.location_name,
      appointment.location_address,
      appointment.location_city,
      appointment.location_state,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      title: `Vehicle Inspection — ${vehicleStr}`,
      description: `Bring your title, ID, and keys. Locked offer: $${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}.`,
      location,
      startDate: start,
      endDate: end,
    };
  })();
  const icsString = calParams
    ? generateICalEvent({
        summary: calParams.title,
        description: calParams.description,
        location: calParams.location,
        startDate: calParams.startDate,
        endDate: calParams.endDate,
        organizerName: config.dealership_name || "Dealer",
        organizerEmail: config.email || "noreply@dealer.local",
      })
    : null;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* ── Quiet header — logo left, support phone right ── */}
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="max-w-[840px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.dealership_name} className="h-16 md:h-20 w-auto object-contain" />
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

      <main className="max-w-[720px] mx-auto px-5 md:px-8 py-12 md:py-16 space-y-12">
        {/* ── Success hero — soft scale-in, no confetti (Apple language) ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-5"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50"
            aria-hidden="true"
          >
            <CheckCircle className="w-8 h-8 text-emerald-500" strokeWidth={2} />
          </motion.div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Deal accepted
          </p>
          <h1 className="font-sans text-[36px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
            {s.name ? `You're set, ${s.name.split(" ")[0]}.` : "You're set."}
          </h1>
          <p className="text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
            We've locked your offer for{" "}
            <span className="font-bold text-zinc-900">
              ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>{" "}
            on your {vehicleStr}.
          </p>
        </motion.section>

        {/* ── Vehicle card ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-zinc-200 bg-zinc-50/40 overflow-hidden"
        >
          <div className="aspect-[16/8]">
            <VehicleImage
              year={s.vehicle_year || ""}
              make={s.vehicle_make || ""}
              model={s.vehicle_model || ""}
              selectedColor={s.exterior_color || ""}
              imageAngle="three_quarter"
              hideColorLabel
            />
          </div>
          <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t border-zinc-100 bg-white">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">Vehicle</p>
              <p className="font-medium text-zinc-900 truncate">{vehicleStr}</p>
            </div>
            {s.mileage && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">Mileage</p>
                <p className="font-medium text-zinc-900">{Number(s.mileage).toLocaleString()} mi</p>
              </div>
            )}
            {conditionLabel && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">Condition</p>
                <p className="font-medium text-zinc-900">{conditionLabel}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">Locked offer</p>
              <p className="font-bold tabular-nums text-zinc-900">
                ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ── Appointment summary (shown when scheduled) ── */}
        {appointment && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-zinc-200 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 md:p-7 space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 mb-2">
                  Inspection scheduled
                </p>
                <p className="text-2xl font-bold tracking-tight text-zinc-900">
                  {new Date(`${appointment.preferred_date}T${appointment.preferred_time}`).toLocaleString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                {appointment.location_name && (
                  <p className="text-sm text-zinc-500 mt-2">
                    {appointment.location_name}
                    {appointment.location_address && (
                      <>
                        <br />
                        {appointment.location_address}
                        {appointment.location_city && `, ${appointment.location_city}`}
                        {appointment.location_state && `, ${appointment.location_state}`}
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
            {calParams && icsString && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCalendarInvite(icsString, `appointment-${s.token}.ics`)}
                  className="rounded-full text-xs font-semibold border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> iCal
                </Button>
                <a
                  href={generateGoogleCalendarUrl(calParams)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold border border-zinc-200 text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Google
                </a>
                <a
                  href={generateOutlookCalendarUrl(calParams)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold border border-zinc-200 text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Outlook
                </a>
                <Link
                  to={`/reschedule?token=${s.token}`}
                  className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Reschedule
                </Link>
              </div>
            )}
          </motion.section>
        )}

        {/* ── Next steps grid ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 print:hidden"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 text-center">
            What happens next
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {!s.appointment_set && (
              <NextStepCard
                icon={Calendar}
                label="Schedule inspection"
                cta="Book now"
                onClick={() => navigate(scheduleLink)}
                primary
              />
            )}
            <NextStepCard
              icon={Camera}
              label="Add vehicle photos"
              cta="Upload photos"
              onClick={() => navigate(`/upload/${s.token}`)}
            />
            <NextStepCard
              icon={FileText}
              label="Title & ID"
              cta="Upload documents"
              onClick={() => navigate(`/docs/${s.token}`)}
            />
          </div>
        </motion.section>

        {/* Print receipt — sits as a quiet text button under What
            happens next so the customer can take a paper copy of
            their accepted offer to the inspection. window.print()
            with print:hidden classes on chrome/dialogs prints just
            the success badge, vehicle card, and appointment summary
            cleanly. */}
        <div className="flex justify-center print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            Print receipt
          </button>
        </div>

        <p className="text-center text-[11px] text-zinc-400 leading-relaxed pt-2 print:hidden">
          We'll text and email confirmation to {s.email || "your email on file"}. Bring your title, photo ID,
          and all keys to the inspection.
        </p>
      </main>

      {/* ── Contact-info gate dialog (offer-first arrivals) ── */}
      <Dialog
        open={contactGateOpen}
        onOpenChange={(open) => {
          // Disallow closing without contact info — same gate as legacy.
          if (!open && (!submission?.name || !submission?.email || !submission?.phone)) return;
          setContactGateOpen(open);
        }}
      >
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogTitle className="text-xl font-bold tracking-tight text-center mb-1">
            One last thing
          </DialogTitle>
          <p className="text-sm text-zinc-500 text-center mb-5">
            We'll send your acceptance confirmation and pickup details here.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dac-name" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Full name</Label>
              <Input id="dac-name" value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} autoComplete="name" />
              {contactErrors.name && <p className="text-xs text-red-600">{contactErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dac-phone" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Cell phone</Label>
              <Input id="dac-phone" type="tel" inputMode="tel" value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} autoComplete="tel" />
              {contactErrors.phone && <p className="text-xs text-red-600">{contactErrors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dac-email" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Email</Label>
              <Input id="dac-email" type="email" inputMode="email" value={contactForm.email} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))} autoComplete="email" />
              {contactErrors.email && <p className="text-xs text-red-600">{contactErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dac-zip" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">ZIP (optional)</Label>
              <Input id="dac-zip" inputMode="numeric" value={contactForm.zip} onChange={(e) => setContactForm((p) => ({ ...p, zip: e.target.value }))} autoComplete="postal-code" />
            </div>
            <Button
              onClick={handleContactSubmit}
              disabled={contactSaving}
              className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100 font-semibold"
              style={
                config.landing_cta_color
                  ? { background: config.landing_cta_color, color: config.landing_cta_text_color || "#ffffff" }
                  : undefined
              }
            >
              {contactSaving ? "Saving…" : "Confirm and continue"}
            </Button>
            <ConsentDisclosure ctaLabel="Confirm and continue" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface NextStepCardProps {
  icon: typeof Calendar;
  label: string;
  cta: string;
  onClick: () => void;
  primary?: boolean;
}

function NextStepCard({ icon: Icon, label, cta, onClick, primary }: NextStepCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-5 transition-all ${
        primary
          ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
          : "border-zinc-200 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-zinc-900 hover:border-zinc-300"
      }`}
    >
      <Icon className={`w-5 h-5 mb-3 ${primary ? "text-white" : "text-zinc-500"}`} aria-hidden="true" />
      <p className={`text-sm font-semibold tracking-tight ${primary ? "text-white" : "text-zinc-900"}`}>
        {label}
      </p>
      <p className={`text-xs mt-1 inline-flex items-center gap-1 ${primary ? "text-white/70" : "text-zinc-500"}`}>
        {cta}
        <ArrowRight className="w-3 h-3" aria-hidden="true" />
      </p>
    </button>
  );
}

export default DealAcceptedClarity;
