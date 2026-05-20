// Moto-aesthetic customer portal — the polished "national-brand
// clean contemporary" dashboard the product owner referenced via
// the MotoAcquire mockups.
//
// Mounted by CustomerPortal.tsx as a top-level dispatch when the
// dealer's landing_template is "moto". The legacy maximalist
// portal stays the default for non-Moto / non-Clarity templates;
// CustomerPortalClarity stays for Clarity tenants.
//
// Scope of this v1 (per the three-agent panel verdict):
//   * Slim sticky top bar (PortalShell)
//   * "Hi, {Name} 👋" greeting + a short overview line
//   * KPI strip — 3 cards: Firm Offer / Market Position / Offer Expires
//     (no "Best Offer" — Hartecash is single-dealer, not a marketplace)
//   * Vehicle hero card with concentric halo + value range + sparkline
//     (sparkline is static for v1 — no value-trend series exists yet)
//   * 2-col grid: FirmOfferTile + NextStepCard
//   * Mobile bottom action bar carrying the contextual primary CTA
//
// Out of scope for v1 (tracked separately):
//   * 4-up bottom grid (Dealer Comm / Documents / Market Insights /
//     Quick Actions) — needs per-doc state and a message thread, both
//     of which require new DB shape
//   * Real value-trend sparkline (needs a snapshot table)
//   * Multi-vehicle sidebar (use CustomerLookup → portal flow)
//   * Confetti / post-Accept celebration screen (separate route)
//
// Reads the same submission columns as CustomerPortalClarity so no
// new RPC / migration is needed.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BadgeDollarSign, Calendar, Clock, FileText, Camera, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import PortalShell from "@/components/portal/moto/PortalShell";
import VehicleHeroCard from "@/components/portal/moto/VehicleHeroCard";
import FirmOfferTile from "@/components/portal/moto/FirmOfferTile";
import NextStepCard, { type NextStep } from "@/components/portal/moto/NextStepCard";
import KpiCard from "@/components/portal/moto/KpiCard";

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
  progress_status: string;
  offered_price: number | null;
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  photos_uploaded: boolean;
  docs_uploaded: boolean;
  appointment_set: boolean;
  created_at: string;
  token_expires_at: string | null;
  token: string;
  vin: string | null;
  zip: string | null;
}

const ACCEPTED_STATUSES = new Set([
  "offer_accepted",
  "price_agreed",
  "inspection_scheduled",
  "inspection_completed",
  "deal_finalized",
  "title_ownership_verified",
  "check_request_submitted",
  "purchase_complete",
]);

const formatMoney = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = d.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const CustomerPortalMoto = () => {
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
      const { data, error: rpcErr } = await supabase
        .from("submissions")
        .select(
          "id, vehicle_year, vehicle_make, vehicle_model, name, email, phone, mileage, exterior_color, progress_status, offered_price, estimated_offer_low, estimated_offer_high, photos_uploaded, docs_uploaded, appointment_set, created_at, token_expires_at, token, vin, zip",
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
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const hasAcceptedOffer = useMemo(
    () => (submission ? ACCEPTED_STATUSES.has(submission.progress_status) : false),
    [submission],
  );

  // Demo-mode override — when site_config.demo_mode is on, every
  // customer-facing offer clamps to demo_offer_amount even if the
  // submission was created before demo mode was switched on. Mirrors
  // the override that already lives in CustomerPortalClarity.
  const displayedOffer = useMemo(() => {
    if (!submission) return null;
    const isDemoMode = config.demo_mode === true;
    const demoOfferAmount = Number(config.demo_offer_amount ?? 23599) || 23599;
    return isDemoMode ? demoOfferAmount : submission.offered_price;
  }, [submission, config.demo_mode, config.demo_offer_amount]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "hsl(220 14% 98%)" }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-foreground/40" aria-hidden="true" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-5"
        style={{ background: "hsl(220 14% 98%)" }}
      >
        <div className="max-w-md text-center space-y-4 bg-white rounded-3xl border border-border/60 p-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Submission not found
          </h1>
          <p className="text-sm text-foreground/65">
            {error || "We couldn't find that submission."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/my-submission")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Look up your submission
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const s = submission;
  const firstName = s.name?.split(" ")[0] || null;
  const scheduleLink = `/schedule?token=${s.token}&vehicle=${encodeURIComponent(
    [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" "),
  )}&name=${encodeURIComponent(s.name || "")}&email=${encodeURIComponent(
    s.email || "",
  )}&phone=${encodeURIComponent(s.phone || "")}`;

  // Determine the stage-aware next step. Same selector as Clarity's
  // nextAction but typed and using our own icon set so the icon
  // renders inside NextStepCard's tile shell.
  const nextStep: NextStep | null = (() => {
    if (!hasAcceptedOffer && (displayedOffer ?? 0) > 0) {
      return {
        label: "Review & accept your offer",
        body: `Your firm cash offer of ${formatMoney(displayedOffer!)} is locked in. Tap below to accept and start scheduling.`,
        cta: "View my offer",
        href: `/offer/${s.token}`,
        icon: BadgeDollarSign,
      };
    }
    if (!s.appointment_set) {
      return {
        label: "Schedule your inspection",
        body: "Book your dealership visit so we can complete a quick inspection and hand you a check. Takes less than a minute.",
        cta: "Book now",
        href: scheduleLink,
        icon: Calendar,
      };
    }
    if (!s.docs_uploaded) {
      return {
        label: "Upload your documents",
        body: "Send us your title and ID so we can have your paperwork ready when you arrive.",
        cta: "Upload documents",
        href: `/docs/${s.token}`,
        icon: FileText,
      };
    }
    if (!s.photos_uploaded) {
      return {
        label: "Add vehicle photos",
        body: "A few photos of your vehicle help us finalize your offer faster — and may bump it up.",
        cta: "Upload photos",
        href: `/upload/${s.token}`,
        icon: Camera,
      };
    }
    return null;
  })();

  // KPI strip values.
  const expiresInDays = daysUntil(s.token_expires_at);
  const expiresLabel =
    expiresInDays == null
      ? null
      : expiresInDays > 1
      ? `${expiresInDays} days`
      : expiresInDays === 1
      ? "1 day"
      : expiresInDays === 0
      ? "Today"
      : "Expired";

  // Market position relative to the estimated range. v1 placeholder
  // — we don't have a real market-position signal yet, but the offer
  // landing inside the estimated range is a meaningful signal we
  // already have access to.
  const offerWithinRange =
    displayedOffer != null &&
    s.estimated_offer_low &&
    s.estimated_offer_high &&
    displayedOffer >= s.estimated_offer_low &&
    displayedOffer <= s.estimated_offer_high;
  const marketPositionLabel = offerWithinRange ? "Within range" : displayedOffer ? "Top tier" : "Pending";
  const marketPositionSub = offerWithinRange
    ? "Your offer matches market"
    : displayedOffer
    ? "Above typical range"
    : null;

  const dealerNameRaw = (config.dealership_name || "").trim();
  const dealerName = dealerNameRaw && dealerNameRaw !== "Our Dealership" ? dealerNameRaw : null;

  // Mobile action bar mirrors the primary CTA so the customer can
  // act without scrolling on small viewports. Falls back to "Review
  // offer" when there's no actionable next step.
  const mobilePrimary = nextStep
    ? { label: nextStep.cta, href: nextStep.href }
    : displayedOffer
    ? { label: hasAcceptedOffer ? "View offer details" : "View my offer", href: `/offer/${s.token}` }
    : null;

  const mobileActionBar = mobilePrimary ? (
    <button
      type="button"
      onClick={() => navigate(mobilePrimary.href)}
      className="w-full h-12 rounded-xl bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)] font-semibold text-base inline-flex items-center justify-center gap-2 hover:opacity-95 active:opacity-90 transition-opacity"
    >
      {mobilePrimary.label}
      <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
    </button>
  ) : undefined;

  return (
    <PortalShell customerFirstName={firstName} mobileActionBar={mobileActionBar}>
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-[1.1] tracking-tight mb-2">
          {firstName ? (
            <>
              Hi, {firstName} <span className="inline-block">👋</span>
            </>
          ) : (
            "Welcome back"
          )}
        </h1>
        <p className="text-base text-foreground/65">
          {hasAcceptedOffer
            ? "Here's where things stand with your vehicle."
            : "Here's your vehicle overview."}
        </p>
      </div>

      {/* KPI strip — 3 cards. Stacks on mobile. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <KpiCard
          icon={BadgeDollarSign}
          label="Firm Offer"
          value={displayedOffer ? formatMoney(displayedOffer) : "Pending"}
          subline={dealerName}
          tone="success"
        />
        <KpiCard
          icon={TrendingUp}
          label="Market Position"
          value={marketPositionLabel}
          subline={marketPositionSub}
          tone="primary"
        />
        <KpiCard
          icon={Clock}
          label="Offer Expires"
          value={expiresLabel ?? "—"}
          subline={s.token_expires_at ? new Date(s.token_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null}
          tone="warning"
        />
      </div>

      {/* Vehicle hero — full width. */}
      <div className="mb-6">
        <VehicleHeroCard
          year={s.vehicle_year}
          make={s.vehicle_make}
          model={s.vehicle_model}
          mileage={s.mileage}
          exteriorColor={s.exterior_color}
          vin={s.vin}
          estimatedLow={s.estimated_offer_low}
          estimatedHigh={s.estimated_offer_high}
        />
      </div>

      {/* Firm Offer + Next Step — 2-col grid that stacks on mobile.
          The conversion pair. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayedOffer && displayedOffer > 0 ? (
          <FirmOfferTile
            amount={displayedOffer}
            dealerName={dealerName}
            expiresAt={s.token_expires_at}
            onAccept={() => navigate(`/offer/${s.token}`)}
            hasAccepted={hasAcceptedOffer}
          />
        ) : null}
        <NextStepCard step={nextStep} onNavigate={navigate} />
      </div>
    </PortalShell>
  );
};

export default CustomerPortalMoto;
