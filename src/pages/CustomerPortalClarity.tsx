import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Mail, Phone, Loader2, Check, Calendar, FileText, Camera, BadgeDollarSign, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { Button } from "@/components/ui/button";
import VehicleImage from "@/components/sell-form/VehicleImage";

/**
 * Clarity-tier customer portal — Apple/Porsche minimal white,
 * matching ClarityTemplate.tsx (font-sans, tight tracking, zinc
 * palette, 0.55s cubic-bezier 0.16/1/0.3/1 easing).
 *
 * Mounted by CustomerPortal.tsx as a top-level dispatch when the
 * dealer's landing_template is "clarity". The legacy maximalist
 * portal stays the default for every other template (including
 * "Legacy Hartecash").
 *
 * Scope of this scaffold (visible sections from the screenshot):
 *   - Quiet header with logo + back link
 *   - Vehicle hero with three-quarter image
 *   - Horizontal progress stepper
 *   - Vehicle Summary card
 *   - Action-Required card driven by progress_status
 *   - Checklist (schedule / documents / photos)
 *   - Need Help (dealer contact)
 *   - How You Get Paid
 *
 * Communication Preferences, Loan Payoff, Inspection Disclosure,
 * Equipment Value Impact, FAQ, etc. live in the legacy portal and
 * will be ported in follow-up turns.
 */

interface PortalSubmission {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mileage: string | null;
  exterior_color: string | null;
  overall_condition: string | null;
  progress_status: string;
  offered_price: number | null;
  photos_uploaded: boolean;
  docs_uploaded: boolean;
  appointment_set: boolean;
  created_at: string;
  token: string;
  vin: string | null;
  zip: string | null;
}

const STAGE_MAPPING: Record<string, string> = {
  title_verified: "inspection_completed",
  ownership_verified: "inspection_completed",
  appraisal_completed: "inspection_completed",
  manager_approval: "inspection_completed",
  dead_lead: "new",
};

const STEPS: { key: string; label: string }[] = [
  { key: "offer_received",       label: "Offer Received" },
  { key: "offer_accepted",       label: "Offer Accepted" },
  { key: "inspection_scheduled", label: "Inspection Scheduled" },
  { key: "deal_finalized",       label: "Deal Finalized" },
  { key: "purchase_complete",    label: "Check Received" },
];

function statusToStepIndex(status: string): number {
  switch (status) {
    case "new":
    case "contacted":
    case "offer_made":
      return 0;
    case "offer_accepted":
    case "price_agreed":
      return 1;
    case "inspection_scheduled":
      return 2;
    case "inspection_completed":
    case "deal_finalized":
    case "title_ownership_verified":
      return 3;
    case "check_request_submitted":
    case "purchase_complete":
      return 4;
    default:
      return 0;
  }
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

const CustomerPortalClarity = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { config } = useSiteConfig();

  const [submission, setSubmission] = useState<PortalSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Invalid link.");
        setLoading(false);
        return;
      }
      try {
        const { data, error: rpcErr } = await supabase
          .from("submissions")
          .select(
            "id, vehicle_year, vehicle_make, vehicle_model, name, email, phone, mileage, exterior_color, overall_condition, progress_status, offered_price, photos_uploaded, docs_uploaded, appointment_set, created_at, token, vin, zip",
          )
          .eq("token", token)
          .maybeSingle();
        if (cancelled) return;
        if (rpcErr || !data) {
          setError("We couldn't find that submission.");
          setLoading(false);
          return;
        }
        setSubmission(data as PortalSubmission);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || "Couldn't load your submission.");
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
          <h1 className="text-2xl font-bold tracking-tight">Submission Not Found</h1>
          <p className="text-sm text-zinc-500">{error || "We couldn't find that submission."}</p>
          <Link
            to="/my-submission"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Look up your submission
          </Link>
        </div>
      </div>
    );
  }

  const s = submission;
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
  const firstName = s.name?.split(" ")[0] || "";
  // Demo-mode override — when site_config.demo_mode is on, every
  // customer-facing offer clamps to demo_offer_amount even if the
  // submission was created before demo mode was switched on.
  const isDemoMode = (config as any)?.demo_mode === true;
  const demoOfferAmount = Number((config as any)?.demo_offer_amount ?? 23599) || 23599;
  const displayedOffer = isDemoMode ? demoOfferAmount : s.offered_price;
  let mappedStatus = STAGE_MAPPING[s.progress_status] || s.progress_status;
  if (mappedStatus === "contacted" && displayedOffer) mappedStatus = "offer_made";
  const stepIdx = statusToStepIndex(mappedStatus);
  const conditionLabel = CONDITION_LABEL[s.overall_condition || ""] || s.overall_condition || "";
  const scheduleLink = `/schedule?token=${s.token}&vehicle=${encodeURIComponent(vehicleStr)}&name=${encodeURIComponent(s.name || "")}&email=${encodeURIComponent(s.email || "")}&phone=${encodeURIComponent(s.phone || "")}`;

  // Drives the action-required card. Each progress state has one
  // canonical "next thing the customer should do" — sequencing
  // mirrors the legacy WhatsNextCard but pared down to one CTA.
  const nextAction = (() => {
    if (mappedStatus === "purchase_complete") return null;
    if (!s.appointment_set) {
      return {
        label: "Schedule Your Inspection",
        body: "Book your dealership visit so we can complete a quick inspection and hand you a check. Takes less than a minute.",
        cta: "Book Now",
        href: scheduleLink,
      };
    }
    if (!s.docs_uploaded) {
      return {
        label: "Upload Your Documents",
        body: "Send us your title and ID so we can have your paperwork ready when you arrive.",
        cta: "Upload Documents",
        href: `/docs/${s.token}`,
      };
    }
    if (!s.photos_uploaded) {
      return {
        label: "Add Vehicle Photos",
        body: "A few photos of your vehicle help us finalize your offer faster — and may bump it up.",
        cta: "Upload Photos",
        href: `/upload/${s.token}`,
      };
    }
    return null;
  })();

  const checklist = [
    {
      label: "Schedule Inspection",
      icon: Calendar,
      done: s.appointment_set,
      href: scheduleLink,
      cta: "Schedule Now",
    },
    {
      label: "Documents",
      icon: FileText,
      done: s.docs_uploaded,
      href: `/docs/${s.token}`,
      cta: "Upload Documents",
    },
    {
      label: "Vehicle Photos",
      icon: Camera,
      done: s.photos_uploaded,
      href: `/upload/${s.token}`,
      cta: "Upload Photos",
      hint: "Photos uploaded may increase your offer",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* ── Header — quiet, dealer logo left, support phone right ── */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1100px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link
            to="/my-submission"
            className="inline-flex items-center gap-2 min-w-0"
            aria-label="Back to your submissions"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
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
          </Link>
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

      <main className="max-w-[1100px] mx-auto px-5 md:px-8 py-10 md:py-14 space-y-12">
        {/* ── Vehicle hero ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </p>
          <h1 className="font-sans text-[36px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
            {vehicleStr || "My Submission"}
          </h1>
        </motion.section>

        {/* ── Progress stepper ── */}
        <section
          aria-label="Your progress"
          className="rounded-3xl border border-zinc-200 bg-zinc-50/40 px-6 py-7"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-5">
            Your progress
          </p>
          <div className="relative">
            <div className="absolute top-3 left-0 right-0 h-[2px] bg-zinc-200" aria-hidden="true" />
            <div
              className="absolute top-3 left-0 h-[2px] bg-zinc-900 transition-all"
              style={{ width: `${(stepIdx / (STEPS.length - 1)) * 100}%` }}
              aria-hidden="true"
            />
            <ol className="relative grid grid-cols-5 gap-2">
              {STEPS.map((step, i) => {
                const reached = i <= stepIdx;
                const current = i === stepIdx;
                return (
                  <li key={step.key} className="flex flex-col items-center gap-2 text-center">
                    <span
                      className={`relative w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                        reached ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-300"
                      }`}
                    >
                      {reached && i < stepIdx ? (
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} aria-hidden="true" />
                      ) : current ? (
                        <span className="w-2 h-2 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <span
                      className={`text-[10px] md:text-xs leading-tight ${
                        reached ? "font-semibold text-zinc-900" : "text-zinc-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Vehicle Summary ── */}
          <section
            aria-label="Vehicle summary"
            className="rounded-3xl border border-zinc-200 bg-white overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Vehicle Summary</h2>
            </div>
            <div className="aspect-[16/8] bg-zinc-50/40">
              <VehicleImage
                year={s.vehicle_year || ""}
                make={s.vehicle_make || ""}
                model={s.vehicle_model || ""}
                selectedColor={s.exterior_color || ""}
                imageAngle="three_quarter"
                hideColorLabel
              />
            </div>
            <dl className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {s.vin && (
                <div className="col-span-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">VIN</dt>
                  <dd className="font-medium tabular-nums text-zinc-900 truncate">{s.vin}</dd>
                </div>
              )}
              {s.mileage && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">Mileage</dt>
                  <dd className="font-medium text-zinc-900">{Number(s.mileage).toLocaleString()} mi</dd>
                </div>
              )}
              {s.exterior_color && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">Color</dt>
                  <dd className="font-medium text-zinc-900">{s.exterior_color}</dd>
                </div>
              )}
              {conditionLabel && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">Condition</dt>
                  <dd className="font-medium text-zinc-900">{conditionLabel}</dd>
                </div>
              )}
              {displayedOffer && displayedOffer > 0 && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-1">Cash Offer</dt>
                  <dd className="font-bold tabular-nums text-zinc-900">
                    ${displayedOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* ── Action Required + Checklist column ── */}
          <div className="space-y-6">
            {nextAction && (
              <section
                aria-label="Action required"
                className="rounded-3xl bg-zinc-900 text-white p-6 md:p-7"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 mb-2">
                  Action required
                </p>
                <h3 className="text-2xl md:text-[28px] font-bold tracking-tight leading-[1.1] mb-3">
                  {nextAction.label}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed mb-5">{nextAction.body}</p>
                <Button
                  onClick={() => navigate(nextAction.href)}
                  className="rounded-full px-6 h-12 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold"
                  style={
                    config.landing_cta_color
                      ? {
                          background: config.landing_cta_color,
                          color: config.landing_cta_text_color || "#ffffff",
                        }
                      : undefined
                  }
                >
                  {nextAction.cta}
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Button>
              </section>
            )}

            <section
              aria-label="Your checklist"
              className="rounded-3xl border border-zinc-200 bg-white"
            >
              <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">Your Checklist</h2>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {checklist.filter((c) => c.done).length}/{checklist.length}
                </span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {checklist.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.label}
                      className="flex items-center gap-4 px-6 py-4"
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item.done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500"
                        }`}
                        aria-hidden="true"
                      >
                        {item.done ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 truncate">{item.label}</p>
                        {item.hint && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{item.hint}</p>
                        )}
                      </div>
                      {!item.done && (
                        <button
                          type="button"
                          onClick={() => navigate(item.href)}
                          className="text-xs font-semibold tracking-tight text-zinc-900 hover:text-zinc-600 transition-colors whitespace-nowrap"
                        >
                          {item.cta}
                          <ArrowRight className="w-3 h-3 ml-1 inline" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>

        {/* ── Need Help + How You Get Paid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section
            aria-label="Need help"
            className="rounded-3xl border border-zinc-200 bg-white p-6 md:p-7"
          >
            <h2 className="text-sm font-semibold tracking-tight mb-4">Need Help?</h2>
            <p className="text-base font-bold tracking-tight text-zinc-900 mb-3">
              {config.dealership_name}
            </p>
            <ul className="space-y-2 text-sm text-zinc-600">
              {config.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                  <a href={`tel:${config.phone}`} className="hover:text-zinc-900 transition-colors">
                    {config.phone}
                  </a>
                </li>
              )}
              {config.email && (
                <li className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                  <a href={`mailto:${config.email}`} className="hover:text-zinc-900 transition-colors">
                    {config.email}
                  </a>
                </li>
              )}
            </ul>
            {Array.isArray(config.business_hours) && config.business_hours.length > 0 && (
              <ul className="mt-4 space-y-1 text-[11px] text-zinc-500 leading-relaxed">
                {config.business_hours.map((row, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="font-semibold text-zinc-600">{row.days}</span>
                    <span>{row.hours}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label="How you get paid"
            className="rounded-3xl border border-zinc-200 bg-zinc-50/40 p-6 md:p-7"
          >
            <h2 className="text-sm font-semibold tracking-tight mb-4 inline-flex items-center gap-2">
              <BadgeDollarSign className="w-4 h-4 text-zinc-500" aria-hidden="true" />
              How You Get Paid
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed mb-4">
              You'll receive a <strong className="text-zinc-900">check on the spot</strong> the same day we purchase your vehicle. No waiting for bank transfers or mailed checks.
            </p>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                Fast, secure, hassle-free payment
              </li>
            </ul>
          </section>
        </div>

        <p className="text-center text-[11px] text-zinc-400 leading-relaxed pt-4">
          Submitted {new Date(s.created_at).toLocaleDateString()} · Your information is kept secure.
        </p>
      </main>
    </div>
  );
};

export default CustomerPortalClarity;
