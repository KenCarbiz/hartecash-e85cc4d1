import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import ConsentDisclosure from "@/components/ConsentDisclosure";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Check, Car } from "lucide-react";
import { calculateOffer, type OfferSettings, type OfferRule } from "@/lib/offerCalculator";
import { resolveEffectiveSettings } from "@/lib/resolvePricingModel";
import { buildSubmissionBBPayload } from "@/lib/submissionOffer";
import { initialFormData, type FormData, type BBVehicle } from "./sell-form/types";
import { logConsent } from "@/lib/consent";

type Screen = "lookup" | "confirm" | "condition" | "contact" | "computing" | "offer";

const NHTSA_DECODE = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

/**
 * Browser-side NHTSA vPIC fallback — used when bb-lookup errors or
 * times out so the customer still advances past the ghost screen.
 * Mirrors the BB shape with pricing zeroed and `_nhtsa: true`.
 */
async function decodeVinViaNhtsaClient(vin: string): Promise<BBVehicle | null> {
  try {
    const res = await fetch(`${NHTSA_DECODE}/${encodeURIComponent(vin)}?format=json`);
    if (!res.ok) return null;
    const json = await res.json();
    const row: Record<string, unknown> | undefined = json?.Results?.[0];
    if (!row) return null;
    const errCode = String(row.ErrorCode || "").trim();
    const acceptable = errCode === "0" || errCode === "1" || errCode === "6" || errCode === "7" || errCode === "8";
    if (!acceptable || !row.ModelYear || !row.Make || !row.Model) return null;

    const driveRaw = String(row.DriveType || "").toUpperCase();
    let drivetrain = "";
    if (driveRaw.includes("AWD") || driveRaw.includes("ALL-WHEEL") || driveRaw.includes("4WD") || driveRaw.includes("4-WHEEL") || driveRaw.includes("4X4")) drivetrain = "AWD/4WD";
    else if (driveRaw.includes("FWD") || driveRaw.includes("FRONT-WHEEL")) drivetrain = "FWD";
    else if (driveRaw.includes("RWD") || driveRaw.includes("REAR-WHEEL")) drivetrain = "RWD";

    const cyls = row.EngineCylinders ? String(row.EngineCylinders) : "";
    const disp = row.DisplacementL ? `${Number(row.DisplacementL).toFixed(1)}L` : "";
    const engine = [disp, cyls ? `${cyls}-Cylinder` : ""].filter(Boolean).join(" ");

    const fuel = String(row.FuelTypePrimary || "").toLowerCase();
    let fuel_type = "";
    if (fuel.includes("diesel")) fuel_type = "Diesel";
    else if (fuel.includes("electric")) fuel_type = "Electric";
    else if (fuel.includes("hybrid")) fuel_type = "Hybrid";
    else if (fuel.includes("flex")) fuel_type = "Flex Fuel";
    else if (fuel.includes("gas")) fuel_type = "Gasoline";

    const transStyle = String(row.TransmissionStyle || "").toLowerCase();
    let transmission = "";
    if (transStyle.includes("auto")) transmission = "Automatic";
    else if (transStyle.includes("manual")) transmission = "Manual";
    else if (transStyle.includes("cvt") || transStyle.includes("continuously")) transmission = "CVT";
    else if (transStyle.includes("dual")) transmission = "DCT";

    const trim = String(row.Trim || row.Series || "");
    const body = String(row.BodyClass || "");

    return {
      uvc: "",
      vin,
      year: String(row.ModelYear),
      make: String(row.Make),
      model: String(row.Model),
      series: String(row.Series || trim || ""),
      style: [trim, body].filter(Boolean).join(" ").trim(),
      class_name: body,
      msrp: 0,
      price_includes: "",
      drivetrain,
      transmission,
      engine,
      fuel_type,
      exterior_colors: [],
      mileage_adj: 0,
      regional_adj: 0,
      base_whole_avg: 0,
      add_deduct_list: [],
      wholesale: { xclean: 0, clean: 0, avg: 0, rough: 0 },
      tradein: { clean: 0, avg: 0, rough: 0 },
      retail: { xclean: 0, clean: 0, avg: 0, rough: 0 },
      _nhtsa: true,
    } as BBVehicle;
  } catch {
    return null;
  }
}

/** Last-resort empty vehicle stub so the customer can still continue
 *  past the lookup screen when both BB and NHTSA are unreachable. */
function buildManualVehicleStub(
  initial: { vin?: string; plate?: string; state?: string },
): BBVehicle {
  return {
    uvc: "",
    vin: initial.vin || "",
    year: "",
    make: "",
    model: "",
    series: "",
    style: "",
    class_name: "",
    msrp: 0,
    price_includes: "",
    drivetrain: "",
    transmission: "",
    engine: "",
    fuel_type: "",
    exterior_colors: [],
    mileage_adj: 0,
    regional_adj: 0,
    base_whole_avg: 0,
    add_deduct_list: [],
    wholesale: { xclean: 0, clean: 0, avg: 0, rough: 0 },
    tradein: { clean: 0, avg: 0, rough: 0 },
    retail: { xclean: 0, clean: 0, avg: 0, rough: 0 },
    _nhtsa: true,
  } as BBVehicle;
}

import RunningCarLoader from "./landing/RunningCarLoader";
import GhostScreen from "./landing/GhostScreen";
import { useGhostScreen } from "@/hooks/useGhostScreen";
import { GhostSyncIndicator } from "@/components/PortalSkeleton";
import VehicleImage from "./sell-form/VehicleImage";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Info } from "lucide-react";

// Original Hartecash KBB-style condition buckets — used when the
// dealer picks `condition_card_style: "kbb"` in admin Setup · Process
// → Landing & Flow. Per-card descriptions match the customer-facing
// text on the legacy SellCarForm so dealers can switch flows
// without their condition prompts changing wording.
const KBB_CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent", desc: "(2% of cars KBB values) - Looks new and is in excellent mechanical condition." },
  { value: "very_good", label: "Very Good", desc: "(28% of cars KBB values) - Has minor cosmetic defects and is in good mechanical condition." },
  { value: "good",      label: "Good",      desc: "(50% of cars KBB values) - Has repairable cosmetic defects and mechanical problems." },
  { value: "fair",      label: "Fair",      desc: "(20% of cars KBB values) - Requires some mechanical repairs." },
] as const;

const KBB_FULL_DEFINITIONS = [
  {
    title: "Excellent",
    text: `"Excellent" condition means that the vehicle looks new and is in excellent mechanical condition. This vehicle has never had any paint or bodywork and does not need reconditioning. The engine compartment is clean and free of fluid leaks. This vehicle is free of rust. The body and interior are free of wear or visible defects. The tires all match and are like new. This vehicle has a clean title history and will pass a safety and smog inspection. This vehicle has complete and verifiable service records.`,
  },
  {
    title: "Very Good",
    text: `"Very Good" condition means that the vehicle has minor cosmetic defects and is in excellent mechanical condition. This vehicle has had minor or no paint or bodywork, and requires minimal reconditioning. The engine compartment is clean and free of fluid leaks. This vehicle is free of rust. The body and interior have minimal signs of wear or visible defects. The tires all match and have 75% or more of tread remaining. This vehicle has a clean title history and will pass a safety and smog inspection. Most service records are available.`,
  },
  {
    title: "Good",
    text: `"Good" condition means that the vehicle has some cosmetic repairable defects and is free of major mechanical problems. The paint and bodywork may require minor touch-ups. The engine compartment may have minor leaks. This vehicle has only minor cosmetic or no rust. The body may have minor scratches or dings and the interior has minor blemishes characteristic of normal wear. The tires match and have at least 50% of tread remaining. Though it may need some reconditioning, it has a clean title history and will pass safety and smog inspection. Some service records are available.`,
  },
  {
    title: "Fair",
    text: `"Fair" condition means that the vehicle has some cosmetic defects that require repairing and/or replacing and requires some mechanical repairs. The paint and bodywork may require refinishing and body repair. The engine compartment has leaks and may require a tune up. This vehicle may have some repairable rust damage. The body has dings, chips, or scratches and the interior has substantial wear, and may have small tears. The tires may need replacing. This vehicle needs servicing, but is still in reasonable running condition. Has a clean title history. A few service records are available.`,
  },
];

interface Props {
  /** Pre-populated identifier from the landing-page LandingPlateInput.
   *  Either a plate+state pair OR a 17-character VIN. Required —
   *  SellFlowSimple is the post-engagement flow. */
  initial:
    | { plate: string; state: string; vin?: undefined }
    | { vin: string; plate?: undefined; state?: undefined };
  /** Lead source tag for analytics + cadence. */
  leadSource?: string;
  /** Density mode chosen by the dealer in the admin. Defaults to
   *  'simple' (3 questions). 'standard' = 5, 'detailed' = 7+. */
  density?: "simple" | "standard" | "detailed";
  /** Theme + loader-style hint from the parent template. The
   *  FullscreenWizard already provides background + chrome; this
   *  prop tells the wizard interior which Tier polish to apply
   *  (typography weights, accent colors, computing-screen loader). */
  theme?: "light" | "dark" | "warm";
  /** Loader style for the "Calculating your offer…" reveal. Picked
   *  per-template per the May-2026 prestige design audit:
   *    velocity → "running-car" (the user explicitly wants this here)
   *    marquee  → "brass-arc"
   *    clarity  → "thin-line"
   *    heritage → "hand-drawn"
   */
  loader?: "running-car" | "brass-arc" | "thin-line" | "hand-drawn";
  /** Brand accent color override. Defaults derived from theme. */
  accent?: string;
  /** @deprecated GhostScreen scrapped — props kept for backwards-compat
   *  with LandingForm's call signature but ignored at render time. */
  ghost?: string;
  ghostHeadline?: string;
  ghostSubhead?: string;
}

/**
 * SellFlowSimple — the radical-simplicity 3-screen wizard from the
 * May-2026 sell-flow design audit (docs/sell-flow-design-audit.md).
 *
 * Screen flow:
 *   1. lookup    → BB lookup loading state, dealer-branded
 *   2. confirm   → "We found your 2021 Honda Accord Sport" with
 *                  vehicle photo + Y/M/M + mileage input
 *   3. condition → 3 (simple) or 5 (standard) yes/no condition
 *                  questions on a single scrolling card
 *   computing  → "calculating your offer" branded reveal moment
 *   offer      → big $ reveal + contact info form below to "lock it"
 *                (which navigates to /offer/:token, the existing
 *                customer-facing offer page)
 *
 * Used inside FullscreenWizard when the dealer's
 * site_config.landing_form_density is 'simple' or 'standard'.
 * For 'detailed', LandingForm dispatches to the existing SellCarForm.
 *
 * Photos and contact info are deliberately deferred to AFTER the
 * offer reveals — the audit's single biggest mom-and-pop fix.
 */
const SellFlowSimple = ({
  initial,
  leadSource = "sell-simple",
  density = "simple",
  theme = "light",
  loader = "thin-line",
  ghostHeadline,
  ghostSubhead,
  accent,
}: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const { kind: ghostKind, syncing: ghostSyncing, ready: ghostReady, stale: ghostStale } = useGhostScreen();

  // Dealer-controlled CTA color for the wizard's Continue / Get-my-offer
  // buttons. Inherits the landing-page color so the customer sees the
  // same primary action color end-to-end. Falls back to the shadcn
  // Button default (theme primary) when no override is set.
  const ctaBg = "hsl(var(--cta-offer))";
  const ctaText = "var(--cta-offer-text)";

  const [screen, setScreen] = useState<Screen>("lookup");
  const [bbVehicle, setBbVehicle] = useState<BBVehicle | null>(null);
  const [mileage, setMileage] = useState("");
  // Default to "Good" — most cars submitted online land in this bucket
  // and pre-selecting it removes one mandatory tap from the flow.
  // Stored as either capitalized buckets (basic style) or KBB lowercase
  // keys ("excellent" / "very_good" / "good" / "fair") when the dealer
  // turned on the KBB card style in admin.
  const conditionStyle =
    ((config as any).condition_card_style as "basic" | "kbb") || "basic";
  const [overallCondition, setOverallCondition] = useState<string>("Good");
  const [showKbbDialog, setShowKbbDialog] = useState(false);
  // Contact info — collected pre-offer when pricing_reveal_mode is
  // "contact_first" (the SellFlowSimple default per the May-2026
  // audit follow-up: most mom-and-pops want the lead's contact in
  // the CRM regardless of whether they accept the number).
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  // pricing_reveal_mode lives on offer_settings, not site_config.
  // Fetched on mount; defaults to "contact_first" for the simple
  // flow until the dealer's setting comes back.
  const [revealMode, setRevealMode] = useState<
    "price_first" | "range_then_price" | "contact_first"
  >("contact_first");

  // Re-align the default once site_config loads — if the dealer turned
  // on KBB style, switch the pre-selected pill from "Good" (basic) to
  // "good" (KBB lowercase key) so the highlight lands on the right card.
  useEffect(() => {
    if (conditionStyle === "kbb" && overallCondition === "Good") setOverallCondition("good");
    if (conditionStyle === "basic" && overallCondition === "good") setOverallCondition("Good");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionStyle]);

  // Fetch pricing_reveal_mode once on mount so we know whether to
  // insert the contact step before /offer (contact_first) or jump
  // straight to /offer where contact is collected post-reveal
  // (price_first / range_then_price). Best-effort — if the column
  // isn't deployed yet on this environment we keep the
  // contact_first default per user's stated preference for the
  // simple flow.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("offer_settings" as any)
          .select("pricing_reveal_mode")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle();
        if (cancelled || error) return;
        const mode = (data as { pricing_reveal_mode?: string } | null)?.pricing_reveal_mode;
        if (mode === "price_first" || mode === "range_then_price" || mode === "contact_first") {
          setRevealMode(mode);
        }
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant.dealership_id]);
  const [accidents, setAccidents] = useState<"" | "Yes" | "No">("");
  const [mechanical, setMechanical] = useState<"" | "Yes" | "No">("");
  const [drivable, setDrivable] = useState<"" | "Yes" | "No">("");
  const [ownership, setOwnership] = useState<"" | "Own" | "Loan" | "Lease">("");
  const [submitting, setSubmitting] = useState(false);

  // Run the BB lookup on mount. Uses VIN when the landing handed off
  // a VIN; otherwise plate + state. If bb-lookup errors, times out, or
  // returns no vehicles, fall back to the public NHTSA vPIC decoder
  // client-side so the customer always advances to the confirm screen
  // — even when Black Book or the edge function are down.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lookupBody: Record<string, unknown> = initial.vin
        ? {
            lookup_type: "vin",
            vin: initial.vin,
            dealership_id: tenant.dealership_id,
            demo_mode: (config as any)?.demo_mode === true ? true : undefined,
          }
        : {
            lookup_type: "plate",
            plate: initial.plate,
            state: initial.state,
            dealership_id: tenant.dealership_id,
            demo_mode: (config as any)?.demo_mode === true ? true : undefined,
          };

      // Race the edge-function call against a 12s timeout — Black Book
      // p99 is sub-3s, so 12s is a generous failure threshold that
      // still keeps the customer moving instead of staring at the
      // ghost screen.
      let bbResult: { data?: any; error?: any } = {};
      try {
        bbResult = await Promise.race([
          supabase.functions.invoke("bb-lookup", { body: lookupBody }),
          new Promise<{ data: null; error: Error }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: new Error("bb-lookup timeout") }), 12000),
          ),
        ]) as { data?: any; error?: any };
      } catch (e) {
        bbResult = { error: e };
      }

      if (cancelled) return;
      const { data, error } = bbResult;
      const bbOk = !error && !data?.error && Array.isArray(data?.vehicles) && data.vehicles.length > 0;

      if (bbOk) {
        setBbVehicle(data.vehicles[0] as BBVehicle);
        setScreen("confirm");
        return;
      }

      // ── Client-side NHTSA fallback ───────────────────────────────────
      // Only meaningful for VIN lookups (NHTSA has no plate registry).
      // Decodes year / make / model / trim / drivetrain / engine /
      // transmission so the customer still sees their vehicle on the
      // confirm screen.
      if (initial.vin) {
        const stub = await decodeVinViaNhtsaClient(initial.vin);
        if (!cancelled && stub) {
          setBbVehicle(stub);
          setScreen("confirm");
          return;
        }
      }

      if (cancelled) return;
      // Both BB and NHTSA failed (or this is a plate lookup with no BB).
      // Drop into a manual-confirm screen so the customer can still
      // proceed — never leave them on the spinner forever.
      const fallback = buildManualVehicleStub(initial);
      setBbVehicle(fallback);
      setScreen("confirm");
      toast({
        title: "We couldn't auto-verify your vehicle",
        description: "Double-check the details on the next screen, or call us if anything looks wrong.",
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.plate, initial.state, initial.vin]);

  const continueToCondition = () => {
    if (!mileage.trim()) {
      toast({ title: "Mileage required", variant: "destructive" });
      return;
    }
    setScreen("condition");
  };

  // Back-button navigation. Maps each screen to its predecessor so
  // the customer can step back without losing what they've already
  // typed (state stays in the parent component). lookup has no
  // predecessor (it's the first thing they see); computing/offer
  // are post-submit terminal states with no rewind.
  const goBack = useCallback(() => {
    if (screen === "condition") setScreen("confirm");
    else if (screen === "contact") setScreen("condition");
  }, [screen]);
  const canGoBack = screen === "condition" || screen === "contact";

  // Validate Step 2 answers, then route based on dealer's
  // pricing_reveal_mode. contact_first inserts a name/email/phone
  // screen between condition and computing; price_first /
  // range_then_price preserve the original behavior of computing →
  // /offer where contact is captured post-reveal.
  const handleConditionSubmit = useCallback(() => {
    if (!bbVehicle) return;
    if (!overallCondition) {
      toast({ title: "Pick a condition", variant: "destructive" });
      return;
    }
    if (density !== "simple") {
      if (!accidents || !mechanical) {
        toast({ title: "Answer both questions", variant: "destructive" });
        return;
      }
    }
    if (!ownership) {
      toast({ title: "Pick ownership status", variant: "destructive" });
      return;
    }
    if (revealMode === "contact_first") {
      setScreen("contact");
      return;
    }
    void submitForOffer();
    // submitForOffer is declared below — forward reference is safe
    // since this callback only fires on user click, after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbVehicle, overallCondition, density, accidents, mechanical, ownership, revealMode, toast]);

  // Validate the contact form, then submit to compute the offer.
  // Used only when pricing_reveal_mode === "contact_first".
  const handleContactSubmit = useCallback(() => {
    const name = contactName.trim();
    const email = contactEmail.trim();
    const phone = contactPhone.replace(/[^0-9]/g, "");
    if (!name || name.length < 2) {
      toast({ title: "Add your full name", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Add a valid email", variant: "destructive" });
      return;
    }
    if (phone.length < 10) {
      toast({ title: "Add a valid phone number", variant: "destructive" });
      return;
    }
    void submitForOffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactName, contactEmail, contactPhone, toast]);

  // Submit the lead and compute the offer. When contact_first ran,
  // contact fields are populated on the submission insert. Otherwise
  // /offer/:token collects them post-reveal (the original audit's
  // "collect AFTER the offer" rule).
  const submitForOffer = useCallback(async () => {
    if (!bbVehicle) return;
    if (!overallCondition) {
      toast({ title: "Pick a condition", variant: "destructive" });
      return;
    }
    if (density !== "simple") {
      // Standard requires accidents + mechanical answers too.
      if (!accidents || !mechanical) {
        toast({ title: "Answer both questions", variant: "destructive" });
        return;
      }
    }
    if (!ownership) {
      toast({ title: "Pick ownership status", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    setScreen("computing");

    try {
      const formData: FormData = {
        ...initialFormData,
        plate: initial.plate || "",
        state: initial.state || "",
        vin: initial.vin || bbVehicle.vin || "",
        mileage: mileage.replace(/[^0-9]/g, ""),
        overallCondition,
        accidents: accidents || "No",
        mechanicalIssues: mechanical === "Yes" ? ["other"] : [],
        drivable: drivable || "Yes",
        loanStatus:
          ownership === "Loan" ? "loan" : ownership === "Lease" ? "lease" : "own",
        bbUvc: bbVehicle.uvc,
      };

      // Resolve dealer offer settings.
      let offerSettings: OfferSettings | null = null;
      let offerRules: OfferRule[] = [];
      try {
        const resolved = await resolveEffectiveSettings(tenant.dealership_id);
        offerSettings = resolved.settings;
        offerRules = resolved.rules;
      } catch (e) {
        console.warn("resolveEffectiveSettings failed — using defaults:", e);
      }

      const estimate = calculateOffer(bbVehicle, formData, [], offerSettings, offerRules);
      const bbPayload = buildSubmissionBBPayload(bbVehicle);

      // Generate token + write submission.
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const generatedToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const subjectToInspection = drivable === "No" || mechanical === "Yes";
      const autoFirmPct = offerSettings
        ? ((offerSettings as unknown as { auto_firm_offer_pct?: number | null }).auto_firm_offer_pct ?? null)
        : null;
      let firmOfferedPrice =
        autoFirmPct != null && estimate?.high && !subjectToInspection
          ? Math.round(estimate.high * autoFirmPct)
          : null;

      // Demo-mode offer override.
      const isDemoMode =
        (config as any)?.demo_mode === true ||
        (bbVehicle as unknown as { _demo?: boolean })?._demo === true;
      const demoOfferAmount = Number((config as any)?.demo_offer_amount ?? 23599) || 23599;
      let demoEstimateLow: number | null = estimate?.low ?? null;
      let demoEstimateHigh: number | null = estimate?.high ?? null;
      if (isDemoMode) {
        firmOfferedPrice = demoOfferAmount;
        demoEstimateLow = demoOfferAmount;
        demoEstimateHigh = demoOfferAmount;
      }

      // Build the insert payload. Optional columns (TCPA, hot-lead,
      // estimate ranges) live in a separate object so we can drop
      // them and retry if PostgREST rejects an unknown column on a
      // partially-migrated environment instead of bouncing the
      // customer back to the condition screen.
      const baseRow: Record<string, unknown> = {
        token: generatedToken,
        plate: formData.plate || null,
        state: formData.state || null,
        vin: bbVehicle.vin || null,
        mileage: formData.mileage || null,
        vehicle_year: bbVehicle.year || null,
        vehicle_make: bbVehicle.make || null,
        vehicle_model: bbVehicle.model || null,
        overall_condition: formData.overallCondition,
        drivable: formData.drivable,
        accidents: formData.accidents || null,
        loan_status: formData.loanStatus || null,
        name: contactName.trim() || null,
        email: contactEmail.trim() || null,
        phone: contactPhone.replace(/[^0-9]/g, "") || null,
        next_step: "contact",
        lead_source: isDemoMode ? `${leadSource}-demo` : leadSource,
        dealership_id: tenant.dealership_id,
        ...bbPayload,
      };
      const optionalRow: Record<string, unknown> = {
        estimated_offer_low: demoEstimateLow,
        estimated_offer_high: demoEstimateHigh,
        offered_price: firmOfferedPrice,
        is_hot_lead: isDemoMode ? false : (estimate?.isHotLead || false),
        offer_subject_to_inspection: isDemoMode ? false : subjectToInspection,
        tcpa_consent_at: new Date().toISOString(),
        tcpa_consent_version: (config as any)?.tcpa_disclosure_version || 1,
        tcpa_consent_text: (config as any)?.tcpa_disclosure || null,
      };

      let insertErr: { message?: string; code?: string } | null = null;
      {
        const { error } = await supabase
          .from("submissions")
          .insert({ ...baseRow, ...optionalRow } as any);
        insertErr = error as any;
      }
      // Retry without optional columns if PostgREST rejected an
      // unknown column — happens when the TCPA / cadence / pricing
      // migrations haven't been applied yet on this environment.
      if (insertErr) {
        const msg = (insertErr.message || "").toLowerCase();
        const code = insertErr.code || "";
        const looksMissing =
          code === "PGRST204" ||
          msg.includes("schema cache") ||
          (msg.includes("column") && msg.includes("does not exist"));
        if (looksMissing) {
          console.warn("[SellFlowSimple] retrying insert without optional columns:", insertErr.message);
          const { error } = await supabase
            .from("submissions")
            .insert(baseRow as any);
          insertErr = error as any;
        }
      }
      if (insertErr) throw insertErr;

      // Light consent log — same pattern as QuickOfferForm.
      try {
        await logConsent({
          submissionToken: generatedToken,
          formSource: "sell_flow_simple",
          dealershipName: tenant.dealership_id,
        });
      } catch (e) {
        console.warn("logConsent failed (non-fatal):", e);
      }

      // Branded compute reveal — short hold so the customer feels the
      // calculation is real (Carvana ~30s; we use a faster 2.5s for
      // simple flow so the offer page doesn't feel padded).
      await new Promise((r) => setTimeout(r, 2500));

      // Hand off to the existing /offer/:token page which collects
      // contact info post-reveal and shows the firm number.
      navigate(`/offer/${generatedToken}`);
    } catch (e) {
      // Send the customer back to whichever screen they came from so
      // their just-typed answers aren't wiped. contact_first means
      // they came from the contact step; everyone else came from
      // condition. Surface the real error message for debugging.
      const fallbackScreen: Screen = revealMode === "contact_first" ? "contact" : "condition";
      setScreen(fallbackScreen);
      console.error("[SellFlowSimple] submitForOffer failed:", e);
      toast({
        title: "Couldn't get your offer",
        description: (e as Error).message || "Please try again or call us directly.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    bbVehicle, overallCondition, accidents, mechanical, drivable, ownership, mileage,
    initial.plate, initial.state, initial.vin, density, tenant.dealership_id, config, leadSource,
    navigate, toast, revealMode, contactName, contactEmail, contactPhone,
  ]);

  return (
    <div className="w-full">
      {/* In-flow back button — sits above the screen content and is
          shown only on screens that have a meaningful predecessor
          (condition → confirm, contact → condition). Customer can
          step back without losing typed answers because state lives
          in this parent component. */}
      {canGoBack && (
        <button
          type="button"
          onClick={goBack}
          disabled={submitting}
          aria-label="Back to the previous step"
          className="inline-flex items-center gap-1.5 mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back
        </button>
      )}
      <AnimatePresence mode="wait">
        {/* ── Screen: lookup — premium SaaS ghost screen, dealer-picked
              variant per template (pulse-orb / sweep-arc / stack-reveal
              / card-skeleton). All copy + colors customizable. */}
        {/* ── Screen: lookup — renders the dealer's chosen ghost loader.
              Reads `config.ghost_screen` (default "legacy-car" =
              Hartecash Classic). Dealer can switch to one of the SaaS
              variants in admin Setup · Process → Landing & Flow. */}
        {screen === "lookup" && (
          <motion.div
            key="lookup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen w-full bg-background flex items-center justify-center relative"
          >
            {ghostReady && (
              <GhostScreen
                kind={ghostKind}
                accent={accent || "#0066CC"}
                background="transparent"
                size="lg"
                fill
                headline={ghostHeadline || "Finding your vehicle"}
                subhead={
                  ghostSubhead ||
                  (initial.vin
                    ? `Looking up VIN ${initial.vin}`
                    : `Looking up ${initial.plate} on the ${initial.state} registry`)
                }
              />
            )}
            <GhostSyncIndicator syncing={ghostSyncing} stale={ghostStale} />
          </motion.div>
        )}

        {/* ── Screen: confirm ── */}
        {screen === "confirm" && bbVehicle && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Step 1 of 2
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]">
                {bbVehicle.year && bbVehicle.make && bbVehicle.model ? (
                  <>
                    We found your{" "}
                    <span className="font-bold">
                      {bbVehicle.year} {bbVehicle.make} {bbVehicle.model}
                    </span>
                  </>
                ) : (
                  <>Confirm your vehicle</>
                )}
              </h2>
              {bbVehicle.series && (
                <p className="text-sm text-muted-foreground">{bbVehicle.series}</p>
              )}
            </div>

            {/* Found-your-car card — 45° hero image (three-quarter angle,
                no background) sits above the spec rail so the vehicle
                appears to float on the surface. Equipment options
                detected from the factory build pull from BB's
                add_deduct_list (filtered to auto != "N"). */}
            <FoundCarCard vehicle={bbVehicle} />
            {bbVehicle._nhtsa && (
              <p className="text-[11px] text-center text-muted-foreground/70 -mt-4">
                Specs verified from the federal NHTSA registry. Final pricing confirmed at pickup.
              </p>
            )}

            {/* Mileage input — the only thing the customer types on this screen */}
            <div className="space-y-2">
              <label
                htmlFor="sfs-mileage"
                className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Current mileage
              </label>
              <input
                id="sfs-mileage"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 47,000"
                value={mileage}
                onChange={(e) => setMileage(e.target.value.replace(/[^0-9,]/g, ""))}
                className="w-full h-14 px-0 text-2xl font-semibold tabular-nums tracking-tight bg-transparent border-0 border-b border-border focus:border-primary focus:ring-0 outline-none transition-colors"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                onClick={continueToCondition}
                disabled={!mileage.trim()}
                size="lg"
                className="h-14 px-7 rounded-full text-base font-semibold"
                style={ctaBg ? { background: ctaBg, color: ctaText } : undefined}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </div>

            <p className="text-[11px] text-center text-muted-foreground/70">
              Not your car?{" "}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-primary hover:underline"
              >
                Re-enter plate
              </button>
            </p>
          </motion.div>
        )}

        {/* ── Screen: condition ── */}
        {screen === "condition" && (
          <motion.div
            key="condition"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Step 2 of 2
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]">
                A few quick questions.
              </h2>
              <p className="text-sm text-muted-foreground">
                Two minutes from here. Your offer locks for {config.price_guarantee_days || 8} days once you see it.
              </p>
            </div>

            <div className="space-y-7">
              {/* Q1 — Overall condition (always asked).
                  KBB style swaps the option set to KBB's 4-tier scale
                  with per-card descriptions and a tap-to-open key
                  dialog. Basic style keeps the short-hint cards. */}
              {conditionStyle === "kbb" ? (
                <fieldset className="space-y-3">
                  <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Overall condition
                  </legend>
                  <button
                    type="button"
                    onClick={() => setShowKbbDialog(true)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline -mt-1 font-medium"
                  >
                    <Info className="w-3.5 h-3.5" aria-hidden="true" />
                    View full Kelley Blue Book&reg; condition definitions
                  </button>
                  <div className="grid grid-cols-1 gap-2">
                    {KBB_CONDITION_OPTIONS.map((opt) => {
                      const checked = overallCondition === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setOverallCondition(opt.value)}
                          className={`relative w-full text-left p-4 rounded-xl border-2 transition-all overflow-hidden ${
                            checked
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:bg-muted/40"
                          }`}
                          aria-pressed={checked}
                        >
                          {checked && (
                            <div className="absolute top-0 right-0 w-8 h-8">
                              <div className="absolute top-0 right-0 w-0 h-0 border-t-[32px] border-t-primary border-l-[32px] border-l-transparent" />
                              <Check className="absolute top-0.5 right-0.5 w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} aria-hidden="true" />
                            </div>
                          )}
                          <span className={`block text-sm font-bold ${checked ? "text-primary" : "text-card-foreground"}`}>
                            {opt.label}
                          </span>
                          <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <ConditionRadio
                  label="Overall condition"
                  hint="Be honest — wrong-rates make the offer change at pickup."
                  value={overallCondition}
                  onChange={(v) => setOverallCondition(v as typeof overallCondition)}
                  options={[
                    { value: "Excellent", label: "Excellent", hint: "Looks new. No issues." },
                    { value: "Good", label: "Good", hint: "Normal wear. Drives perfectly." },
                    { value: "Fair", label: "Fair", hint: "Visible wear. Mechanically OK." },
                    { value: "Rough", label: "Rough", hint: "Significant wear or repairs needed." },
                  ]}
                />
              )}

              {/* Q2 — Drivable (always asked, single yes/no) */}
              <ConditionRadio
                label="Does it run and drive?"
                value={drivable}
                onChange={(v) => setDrivable(v as typeof drivable)}
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No, needs repair" },
                ]}
              />

              {/* Q3 — Ownership (always asked) */}
              <ConditionRadio
                label="Who owns it?"
                value={ownership}
                onChange={(v) => setOwnership(v as typeof ownership)}
                options={[
                  { value: "Own", label: "Own outright" },
                  { value: "Loan", label: "Still paying a loan" },
                  { value: "Lease", label: "Lease" },
                ]}
              />

              {/* Q4 + Q5 — Standard density adds accidents + mechanical */}
              {density !== "simple" && (
                <>
                  <ConditionRadio
                    label="Any accidents on the title?"
                    value={accidents}
                    onChange={(v) => setAccidents(v as typeof accidents)}
                    options={[
                      { value: "No", label: "No" },
                      { value: "Yes", label: "Yes" },
                    ]}
                  />
                  <ConditionRadio
                    label="Any current mechanical issues or warning lights?"
                    value={mechanical}
                    onChange={(v) => setMechanical(v as typeof mechanical)}
                    options={[
                      { value: "No", label: "No" },
                      { value: "Yes", label: "Yes" },
                    ]}
                  />
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                onClick={handleConditionSubmit}
                disabled={submitting}
                size="lg"
                className="h-14 px-7 rounded-full text-base font-semibold"
                style={ctaBg ? { background: ctaBg, color: ctaText } : undefined}
              >
                {revealMode === "contact_first" ? "Continue" : "Get my offer"}
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Screen: contact ── (only shown when the dealer's
              pricing_reveal_mode is "contact_first"). Three short
              fields — name, cell, email — then the customer hits
              "See my offer" and we drop into the computing reveal.
              Mom-and-pop dealers use this when they want the lead
              in their CRM regardless of whether the customer accepts
              the number. */}
        {screen === "contact" && (
          <motion.div
            key="contact"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Almost there
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]">
                Where should we send your offer?
              </h2>
              <p className="text-sm text-muted-foreground">
                We'll text and email your firm cash offer in seconds. No spam — your offer locks for {config.price_guarantee_days || 8} days.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="sfs-name"
                  className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Full name
                </label>
                <input
                  id="sfs-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Smith"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full h-14 px-0 text-xl font-medium bg-transparent border-0 border-b border-border focus:border-primary focus:ring-0 outline-none transition-colors"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="sfs-phone"
                  className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Cell phone
                </label>
                <input
                  id="sfs-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value.replace(/[^0-9()\-\s+]/g, ""))}
                  className="w-full h-14 px-0 text-xl font-medium tabular-nums bg-transparent border-0 border-b border-border focus:border-primary focus:ring-0 outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="sfs-email"
                  className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="sfs-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="jane@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full h-14 px-0 text-xl font-medium bg-transparent border-0 border-b border-border focus:border-primary focus:ring-0 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                onClick={handleContactSubmit}
                disabled={submitting}
                size="lg"
                className="h-14 px-7 rounded-full text-base font-semibold"
                style={ctaBg ? { background: ctaBg, color: ctaText } : undefined}
              >
                See my offer
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </div>

            <ConsentDisclosure ctaLabel="See my offer" className="px-4" />
          </motion.div>
        )}

        {/* ── Screen: computing ── (branded reveal moment).
              Loader style is template-driven per the May-2026 prestige
              audit. Velocity gets the running-car (the user's request),
              Marquee gets a slow brass arc, Clarity gets a thin
              expanding line, Heritage gets a hand-drawn fill. */}
        {screen === "computing" && (
          <motion.div
            key="computing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center min-h-[400px] text-center"
          >
            {loader === "running-car" ? (
              <div className="mb-6" style={{ color: accent || "#0066CC" }}>
                <RunningCarLoader size="lg" />
              </div>
            ) : loader === "brass-arc" ? (
              <svg
                width="80" height="80" viewBox="0 0 80 80"
                className="mb-6" aria-hidden="true"
              >
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke={accent || "#C9A96E"}
                  strokeWidth="1.5"
                  strokeOpacity="0.15"
                />
                <motion.circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke={accent || "#C9A96E"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  pathLength="1"
                  strokeDasharray="0.25 0.75"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                  style={{ transformOrigin: "40px 40px" }}
                />
              </svg>
            ) : loader === "hand-drawn" ? (
              <svg
                width="120" height="60" viewBox="0 0 120 60"
                className="mb-6" aria-hidden="true"
              >
                {/* Quick line-drawing of a small showroom — strokes
                    in over 1.6s so the customer sees it being drawn. */}
                <motion.path
                  d="M10 50 L10 25 L60 10 L110 25 L110 50 Z M30 50 L30 35 L50 35 L50 50 M70 50 L70 30 L100 30 L100 50"
                  fill="none"
                  stroke={accent || "#A3886B"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0.5 }}
                  animate={{ pathLength: [0, 1, 1], opacity: [0.5, 1, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.4 }}
                />
              </svg>
            ) : (
              // thin-line — Apple/Porsche default
              <div className="w-48 h-px relative mb-8" aria-hidden="true">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: accent ? `${accent}26` : "rgba(0,0,0,0.10)" }}
                />
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: accent || "#0A0A0A" }}
                  animate={{ width: ["10%", "100%", "10%"], left: ["0%", "0%", "90%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            )}
            <h2 className={`text-2xl font-semibold tracking-tight ${
              theme === "dark" ? "text-white" : theme === "warm" ? "text-[#2C2A26]" : "text-[#1D1D1F]"
            }`}>
              Calculating your offer…
            </h2>
            <p className={`text-sm mt-2 max-w-xs ${
              theme === "dark" ? "text-white/60" : theme === "warm" ? "text-[#2C2A26]/65" : "text-[#1D1D1F]/65"
            }`}>
              Pricing against live wholesale market data + recent sales of {bbVehicle?.year} {bbVehicle?.make}s.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kelley Blue Book® condition definitions — opens from the
          "View full Kelley Blue Book® condition definitions" link
          on Step 2 when the dealer turned on KBB card style. */}
      <Dialog open={showKbbDialog} onOpenChange={setShowKbbDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-6 py-4 rounded-t-lg text-center">
            <DialogTitle className="text-2xl font-bold">
              Kelley Blue Book&reg; Condition Definitions
            </DialogTitle>
          </div>
          <div className="px-6 pt-2">
            <div className="space-y-5 mt-2">
              {KBB_FULL_DEFINITIONS.map((d) => (
                <div key={d.title}>
                  <h4 className="font-bold text-card-foreground mb-1 text-center">{d.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 pb-4">
            <DialogFooter>
              <Button
                onClick={() => setShowKbbDialog(false)}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
              >
                GOT IT!
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * "Found your car" card shown on the confirm screen. Houses a 45°
 * three-quarter-front vehicle image (rendered with no background by
 * the generate-vehicle-image function — it produces transparent
 * studio-shot PNGs) on top, a spec rail beneath, and a chip cloud
 * of factory equipment detected from BB's add_deduct_list.
 *
 * When the lookup came from NHTSA fallback (`_nhtsa: true`),
 * add_deduct_list is empty — the chip cloud collapses gracefully.
 */
function FoundCarCard({ vehicle }: { vehicle: BBVehicle }) {
  const factoryOptions = (vehicle.add_deduct_list || []).filter((o) => o.auto !== "N");
  const visibleOptions = factoryOptions.slice(0, 8);
  const moreOptions = Math.max(0, factoryOptions.length - visibleOptions.length);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-[0_2px_24px_rgba(0,0,0,0.06)]">
      {/* Subtle gradient stage so the transparent-bg vehicle photo
          looks like it's resting on a showroom surface. */}
      <div
        className="relative aspect-[16/8] w-full"
        style={{
          background:
            "radial-gradient(ellipse at 50% 95%, rgba(0,0,0,0.10), transparent 55%), linear-gradient(180deg, hsl(var(--muted)/0.4) 0%, hsl(var(--background)) 100%)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[88%] h-full">
            <VehicleImage
              year={vehicle.year}
              make={vehicle.make}
              model={vehicle.model}
              style={vehicle.style}
              uvc={vehicle.uvc}
              selectedColor=""
              imageAngle="three_quarter"
              hideColorLabel
            />
          </div>
        </div>
      </div>

      {/* Spec rail — Trim · Drivetrain · Engine · Transmission · Fuel */}
      <div className="px-5 py-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
        {vehicle.series && (
          <SpecCell label="Trim" value={vehicle.series} />
        )}
        {vehicle.drivetrain && (
          <SpecCell label="Drivetrain" value={vehicle.drivetrain} />
        )}
        {vehicle.engine && (
          <SpecCell label="Engine" value={vehicle.engine} />
        )}
        {vehicle.transmission && (
          <SpecCell label="Transmission" value={vehicle.transmission} />
        )}
        {!vehicle.transmission && vehicle.fuel_type && (
          <SpecCell label="Fuel" value={vehicle.fuel_type} />
        )}
      </div>

      {/* Equipment options from the factory build */}
      {visibleOptions.length > 0 && (
        <div className="px-5 pb-5 pt-1 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Factory equipment
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleOptions.map((opt) => (
              <span
                key={opt.uoc}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/8 border border-primary/15 text-primary"
              >
                <Check className="w-3 h-3" aria-hidden="true" />
                {opt.name}
              </span>
            ))}
            {moreOptions > 0 && (
              <span className="px-2.5 py-1 rounded-full text-[11px] text-muted-foreground bg-muted">
                +{moreOptions} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
        {label}
      </p>
      <p className="text-sm font-medium text-card-foreground truncate">{value}</p>
    </div>
  );
}

interface RadioProps<T extends string> {
  label: string;
  hint?: string;
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
}

function ConditionRadio<T extends string>({ label, hint, value, onChange, options }: RadioProps<T>) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </legend>
      {hint && <p className="text-xs text-muted-foreground/70 -mt-1">{hint}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                checked
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
              aria-pressed={checked}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  checked ? "border-primary bg-primary" : "border-border"
                }`}
              >
                {checked && <Check className="w-3 h-3 text-primary-foreground" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.label}</span>
                {o.hint && (
                  <span className="block text-[11px] text-muted-foreground mt-0.5">{o.hint}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default SellFlowSimple;
