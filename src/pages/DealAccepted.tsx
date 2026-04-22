import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { Camera, FileText, CalendarCheck, ArrowRight, Zap, Clock, CheckCircle, Sparkles, ShieldCheck, ArrowLeft, TrendingUp, Lock, Download, ExternalLink, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import VehicleImage from "@/components/sell-form/VehicleImage";
import WhatToExpect from "@/components/portal/WhatToExpect";
import InspectionDisclosure from "@/components/portal/InspectionDisclosure";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logConsent } from "@/lib/consent";
import logoFallback from "@/assets/logo-placeholder-white.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { getTaxRateFromZip, calcTradeInValue } from "@/lib/salesTax";
import { generateICalEvent, downloadCalendarInvite, generateGoogleCalendarUrl } from "@/lib/calendarInvite";

interface DealSubmission {
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
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  bb_tradein_avg: number | null;
  zip: string | null;
  token: string;
  created_at: string | null;
  appointment_set: boolean;
  offer_subject_to_inspection?: boolean | null;
}

interface AppointmentData {
  preferred_date: string;
  preferred_time: string;
  store_location: string | null;
  location_name: string | null;
  location_address: string | null;
  location_city: string | null;
  location_state: string | null;
}

const DealAccepted = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [submission, setSubmission] = useState<DealSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const confettiKey = `confetti_shown_${token}`;
  const [isFirstVisit] = useState(() => !localStorage.getItem(confettiKey));
  const { config } = useSiteConfig();

  // Appointment data for calendar integration
  const [appointmentData, setAppointmentData] = useState<AppointmentData | null>(null);

  // Contact gate state
  const [contactGateOpen, setContactGateOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactZip, setContactZip] = useState("");
  const [contactSaving, setContactSaving] = useState(false);

  // Confetti celebration — only on first visit
  useEffect(() => {
    if (!isFirstVisit) return;
    localStorage.setItem(confettiKey, "1");

    const duration = 2500;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#22c55e", "#3b82f6", "#f59e0b"] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#22c55e", "#3b82f6", "#f59e0b"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [isFirstVisit, confettiKey]);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) { setLoading(false); return; }
      
      // Mark the offer as accepted (updates status to 'offer_accepted')
      await supabase.rpc("accept_offer", { _token: token });
      
      const { data } = await supabase.rpc("get_submission_portal", { _token: token });
      if (data && data.length > 0) {
        const sub = data[0] as unknown as DealSubmission;
        setSubmission(sub);

        // Check if contact info is missing (offer-first flow)
        const needsContact = !sub.name || !sub.email || !sub.phone;
        if (needsContact) {
          setContactName(sub.name || "");
          setContactEmail(sub.email || "");
          setContactPhone(sub.phone || "");
          setContactZip(sub.zip || "");
          setContactGateOpen(true);
        } else {
          // Fire notifications only when contact info is present
          if ((sub as any).id) {
            const subId = (sub as any).id as string;
            const ctx = { from: "DealAccepted.autoFire", submission_id: subId } as const;
            safeInvoke("send-notification", { body: { trigger_key: "staff_customer_accepted", submission_id: subId }, context: ctx });
            safeInvoke("send-notification", { body: { trigger_key: "customer_offer_accepted", submission_id: subId }, context: ctx });
          }
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [token]);

  // Fetch appointment details when submission has an appointment
  useEffect(() => {
    if (!token || !submission || !(submission as any).appointment_set) return;
    const fetchAppointment = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("preferred_date, preferred_time, store_location")
        .eq("submission_token", token)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        let locName: string | null = null;
        let locAddress: string | null = null;
        let locCity: string | null = null;
        let locState: string | null = null;
        if (data.store_location) {
          const { data: loc } = await supabase
            .from("dealership_locations" as any)
            .select("name, address, city, state")
            .eq("id", data.store_location)
            .maybeSingle();
          if (loc) {
            locName = (loc as any).name;
            locAddress = (loc as any).address;
            locCity = (loc as any).city;
            locState = (loc as any).state;
          }
        }
        setAppointmentData({
          preferred_date: data.preferred_date,
          preferred_time: data.preferred_time,
          store_location: data.store_location,
          location_name: locName,
          location_address: locAddress,
          location_city: locCity,
          location_state: locState,
        });
      }
    };
    fetchAppointment();
  }, [token, submission]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-bold font-display text-foreground mb-2">Not Found</h1>
          <p className="text-muted-foreground">We couldn't find this submission.</p>
        </div>
      </div>
    );
  }

  // Contact gate submit handler
  const handleContactSubmit = async () => {
    if (!contactName.trim() || !contactEmail.trim() || !contactPhone.trim()) {
      toast.error("Please fill in your name, email, and phone number.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(contactEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (contactPhone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number (10+ digits).");
      return;
    }
    setContactSaving(true);
    try {
      const subId = (submission as any)?.id;
      if (subId) {
        await supabase.from("submissions").update({
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
          zip: contactZip.trim() || null,
        }).eq("id", subId);

        // Log consent
        logConsent({
          customerName: contactName.trim(),
          customerPhone: contactPhone.trim(),
          customerEmail: contactEmail.trim(),
          formSource: "deal_accepted_gate",
          submissionToken: token,
          dealershipName: config.dealership_name,
        });

        // Fire notifications now that we have contact info
        const ctx = { from: "DealAccepted.contactGate", submission_id: subId } as const;
        safeInvoke("send-notification", { body: { trigger_key: "staff_customer_accepted", submission_id: subId }, context: ctx });
        safeInvoke("send-notification", { body: { trigger_key: "customer_offer_accepted", submission_id: subId }, context: ctx });
      }
      setSubmission(prev => prev ? { ...prev, name: contactName.trim(), email: contactEmail.trim(), phone: contactPhone.trim(), zip: contactZip.trim() || prev.zip } : prev);
      setContactGateOpen(false);
      toast.success("Information saved! Your offer is locked in.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setContactSaving(false);
    }
  };

  // Show contact gate if needed
  if (contactGateOpen) {
    const s = submission;
    const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
    const cashOffer = s.offered_price || s.estimated_offer_high || 0;
    const isEstimate = !s.offered_price && !!s.estimated_offer_high;

    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-r from-primary via-[hsl(var(--primary)/0.8)] to-primary text-primary-foreground px-6 py-4">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <img src={config.logo_white_url || logoFallback} alt={config.dealership_name || "Dealership"} className="h-[50px] w-auto" />
            <div>
              <h1 className="font-bold font-display text-lg">Almost There!</h1>
              <p className="text-sm opacity-80">Lock in your offer</p>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-6 shadow-lg border border-border mb-6"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <p className="font-bold text-card-foreground">Offer Accepted!</p>
            </div>
            <p className="text-2xl font-extrabold text-accent mt-2">
              {isEstimate
                ? `$${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                : `$${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            </p>
            <p className="text-sm text-muted-foreground">{vehicleStr}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-6 shadow-lg border-2 border-primary/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="font-bold font-display text-card-foreground text-lg">Lock In Your Price</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Enter your contact information to finalize your accepted offer. We'll reach out to schedule your inspection.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="gate-name">Full Name *</Label>
                <Input
                  id="gate-name"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="gate-email">Email Address *</Label>
                <Input
                  id="gate-email"
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="gate-phone">Phone Number *</Label>
                <Input
                  id="gate-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="gate-zip">Zip Code</Label>
                <Input
                  id="gate-zip"
                  value={contactZip}
                  onChange={e => setContactZip(e.target.value)}
                  placeholder="06001"
                  className="mt-1"
                />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
              By submitting, you consent to receive calls, texts, and emails from {config.dealership_name || "our dealership"} regarding your vehicle offer. Consent is not a condition of purchase.
            </p>

            <Button
              onClick={handleContactSubmit}
              disabled={contactSaving}
              className="w-full mt-5 py-5 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-2"
            >
              {contactSaving ? "Saving..." : "Lock In My Offer"}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const s = submission;
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
  const firstName = s.name?.split(" ")[0] || "";
  const cashOffer = s.offered_price || s.estimated_offer_high || 0;
  const estimateLow = s.estimated_offer_low || 0;
  const isEstimate = !s.offered_price && !!s.estimated_offer_high;
  const isTradeIn = searchParams.get("mode") === "trade";

  // Trade-in value calculation
  const taxInfo = s.zip ? getTaxRateFromZip(s.zip) : { state: null, rate: 0 };
  const taxRate = taxInfo.rate;
  const tradeInValue = calcTradeInValue(cashOffer, taxRate);
  const tradeInValueLow = isEstimate ? calcTradeInValue(estimateLow, taxRate) : tradeInValue;
  const showTradeIn = isTradeIn && taxRate > 0;

  const guaranteeDays = config.price_guarantee_days || 8;
  const createdDate = s.created_at ? new Date(s.created_at) : null;
  const expiresDate = createdDate ? new Date(createdDate.getTime() + guaranteeDays * 24 * 60 * 60 * 1000) : null;
  const daysRemaining = expiresDate ? Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  const scheduleLink = `/schedule?token=${token}&vehicle=${encodeURIComponent(vehicleStr)}&name=${encodeURIComponent(s.name || "")}&email=${encodeURIComponent(s.email || "")}&phone=${encodeURIComponent(s.phone || "")}`;

  // Calendar invite helpers
  const buildAppointmentDateForCalendar = (): Date | null => {
    if (!appointmentData) return null;
    const { preferred_date, preferred_time } = appointmentData;
    if (!preferred_date || !preferred_time) return null;
    const timeParts = preferred_time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeParts) return null;
    let hours = parseInt(timeParts[1], 10);
    const minutes = parseInt(timeParts[2], 10);
    const period = timeParts[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    const d = new Date(`${preferred_date}T00:00:00`);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const appointmentLocationName = appointmentData?.location_name || "";
  const appointmentLocationFull = appointmentData?.location_address
    ? `${appointmentData.location_name}, ${appointmentData.location_address}, ${appointmentData.location_city}, ${appointmentData.location_state}`
    : appointmentLocationName;

  const handleDownloadIcs = () => {
    const start = buildAppointmentDateForCalendar();
    if (!start) return;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const summary = vehicleStr
      ? `Vehicle Inspection - ${vehicleStr}`
      : "Vehicle Inspection";
    const ics = generateICalEvent({
      summary,
      description: `Vehicle inspection appointment at ${appointmentLocationName}. Please bring your Driver's License, Vehicle Title/Registration, and all keys & remotes. Expected duration: 15-20 minutes.`,
      location: appointmentLocationFull,
      startDate: start,
      endDate: end,
      organizerName: config.dealership_name || "Dealership",
      organizerEmail: (config as any).contact_email || config.email || "info@example.com",
    });
    downloadCalendarInvite(ics, "vehicle-inspection-appointment.ics");
  };

  const getGoogleCalendarUrl = (): string | null => {
    const start = buildAppointmentDateForCalendar();
    if (!start) return null;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const title = vehicleStr
      ? `Vehicle Inspection - ${vehicleStr}`
      : "Vehicle Inspection";
    return generateGoogleCalendarUrl({
      title,
      description: `Vehicle inspection appointment at ${appointmentLocationName}. Please bring your Driver's License, Vehicle Title/Registration, and all keys & remotes. Expected duration: 15-20 minutes.`,
      location: appointmentLocationFull,
      startDate: start,
      endDate: end,
    });
  };

  // Animation variants: dramatic spring on first visit, subtle fade on revisit
  const stagger = isFirstVisit ? 0.15 : 0.05;
  const baseDelay = isFirstVisit ? 0.3 : 0;
  const entrance = (i: number) => ({
    initial: isFirstVisit
      ? { opacity: 0, y: 24, scale: 0.97 }
      : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: isFirstVisit
      ? { type: "spring" as const, stiffness: 120, damping: 18, delay: baseDelay + i * stagger }
      : { duration: 0.35, delay: baseDelay + i * stagger },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.div {...entrance(0)} className="bg-gradient-to-r from-primary via-[hsl(var(--primary)/0.8)] to-primary text-primary-foreground px-6 py-1">
        <div className="max-w-5xl mx-auto">
          <Link to={`/offer/${token}`} className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to offer
          </Link>
          <div className="flex items-center gap-3">
            <img src={config.logo_white_url || logoFallback} alt={config.dealership_name || "Dealership"} className="h-[70px] w-auto" />
            <div className="flex-1">
              <h1 className="font-bold font-display text-lg lg:text-xl">
                {isFirstVisit ? "Deal Accepted!" : "Welcome Back!"}
              </h1>
              {firstName && (
                <p className="text-sm opacity-80">
                  {isFirstVisit
                    ? `${firstName}, your price is locked in`
                    : `${firstName}, your deal is still waiting for you`}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Success banner */}
      <motion.div
        {...entrance(1)}
        className="bg-success/10 border-b border-success/20"
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="font-bold text-card-foreground text-sm">Your offer is locked in!</p>
            <p className="text-xs text-muted-foreground">
              {daysRemaining > 0
                ? `Price guaranteed for ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} — a team member will be reaching out shortly.`
                : "A team member will be reaching out shortly."
              }
            </p>
          </div>
          {daysRemaining > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-success/10 text-success text-xs font-semibold px-3 py-1.5 rounded-full ml-auto shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
            </div>
          )}
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Vehicle + offer recap */}
        <motion.div
          {...entrance(2)}
          className="bg-card rounded-xl p-6 shadow-lg mb-8 flex flex-col md:flex-row items-center gap-6"
        >
          {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
            <div className="w-full md:w-64 shrink-0">
              <VehicleImage
                year={s.vehicle_year}
                make={s.vehicle_make}
                model={s.vehicle_model}
                selectedColor={s.exterior_color || ""}
                compact
              />
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            {showTradeIn ? (
              <>
                <div className="inline-flex items-center gap-1.5 bg-success/10 text-success text-xs font-semibold px-3 py-1 rounded-full mb-2">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Trade-In Value
                </div>
                <p className="text-3xl md:text-4xl font-extrabold text-success tracking-tight">
                  {isEstimate
                    ? `$${tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                    : `$${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Includes {(taxRate * 100).toFixed(2)}% sales tax credit
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                  {isEstimate ? "Estimated Offer" : "Your Locked-In Price"}
                </p>
                <p className="text-3xl md:text-4xl font-extrabold text-accent tracking-tight">
                  {isEstimate
                    ? `$${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                    : `$${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                </p>
              </>
            )}
            <p className="font-semibold text-card-foreground mt-1">{vehicleStr}</p>
            {s.mileage && (
              <p className="text-sm text-muted-foreground">{Number(s.mileage).toLocaleString()} miles · {s.overall_condition || "—"} condition</p>
            )}
            {(s.offer_subject_to_inspection ||
              (s.offered_price != null && s.estimated_offer_high != null && s.offered_price > s.estimated_offer_high)) && (
              <div className="mt-4 mx-auto max-w-xl text-left bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                  <strong>Subject to inspection.</strong> This offer is our best estimate
                  based on the condition you described. The final number is confirmed at
                  your in-person inspection — if the vehicle matches what you told us,
                  the price is locked. If the condition turns out to be different, we'll
                  walk you through any adjustment before anything is signed.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Two action cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Left: Schedule Inspection */}
          <motion.div
            {...entrance(3)}
            className="space-y-5"
          >
            <div className="bg-card rounded-xl p-6 shadow-lg border-2 border-primary/20 h-auto">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold font-display text-card-foreground">Schedule Your Inspection</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Book a convenient time to bring your {vehicleStr || "vehicle"} in. The whole process takes about 15–20 minutes — drive in, get inspected, get paid.
              </p>

              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  15–20 minutes
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                  Get paid same day
                </span>
              </div>

              <Link to={scheduleLink}>
                <Button className="w-full mt-5 py-5 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-2">
                  <CalendarCheck className="w-5 h-5" />
                  Schedule Inspection
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>

            {/* What to Expect — directly below schedule */}
            <WhatToExpect />
          </motion.div>

          {/* Right: Fast Track */}
          <motion.div
            {...entrance(4)}
          >
            <div className="bg-gradient-to-br from-accent/5 via-accent/3 to-transparent rounded-xl p-6 shadow-lg border-2 border-accent/20 h-full">
              <div className="flex items-center gap-2 mb-1">
                <div className="inline-flex items-center gap-1.5 bg-accent/10 text-accent text-xs font-semibold px-3 py-1 rounded-full">
                  <Zap className="w-3.5 h-3.5" />
                  Optional
                </div>
              </div>
              <h3 className="font-bold font-display text-card-foreground text-lg mt-3">Fast-Track Your Deal & Maximize Your Offer</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Upload photos and documents now to speed up your appointment and help maximize your offer. Our AI and inventory team use your photos to accurately assess condition — which often results in a higher final price.
              </p>

              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                  Photos help increase your offer
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-success" />
                  Faster processing
                </span>
              </div>

              <div className="space-y-3 mt-5">
                <Link
                  to={`/upload/${token}`}
                  className="flex items-center gap-3 p-4 rounded-lg bg-card hover:bg-muted/50 transition-colors border border-border"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-card-foreground">Upload Photos to Maximize Your Offer</p>
                    <p className="text-xs text-muted-foreground">Our AI analyzes your photos to confirm condition — complete photos often mean a higher final offer.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>

                <Link
                  to={`/docs/${token}`}
                  className="flex items-center gap-3 p-4 rounded-lg bg-card hover:bg-muted/50 transition-colors border border-border"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-card-foreground">Upload Documents</p>
                    <p className="text-xs text-muted-foreground">Title, registration & license</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>

              {/* Upside note */}
              <div className="flex items-start gap-2 mt-5 pt-4 border-t border-border/50">
                <Sparkles className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vehicles that arrive in better-than-reported condition may qualify for a higher offer at inspection.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Add to Calendar — shown when appointment is booked */}
        {appointmentData && (
          <motion.div
            {...entrance(5)}
            className="mb-8"
          >
            <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="h-4.5 w-4.5 text-primary/70" />
                </div>
                <div>
                  <p className="font-semibold text-card-foreground">Your Inspection Appointment</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(appointmentData.preferred_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    {" "}at {appointmentData.preferred_time}
                    {appointmentLocationName ? ` — ${appointmentLocationName}` : ""}
                  </p>
                </div>
              </div>
              <div className="border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Add to Calendar
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={handleDownloadIcs}
                  >
                    <Download className="w-4 h-4" />
                    Download .ics
                  </Button>
                  {(() => {
                    const url = getGoogleCalendarUrl();
                    return url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        asChild
                      >
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                          Add to Google Calendar
                        </a>
                      </Button>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          <InspectionDisclosure /> • 🔒 Your information is kept secure
        </p>
      </div>
    </div>
  );
};

export default DealAccepted;
