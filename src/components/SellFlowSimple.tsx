import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Check, Car } from "lucide-react";
import { calculateOffer, type OfferSettings, type OfferRule } from "@/lib/offerCalculator";
import { resolveEffectiveSettings } from "@/lib/resolvePricingModel";
import { buildSubmissionBBPayload } from "@/lib/submissionOffer";
import { initialFormData, type FormData, type BBVehicle } from "./sell-form/types";
import { logConsent } from "@/lib/consent";

type Screen = "lookup" | "confirm" | "condition" | "computing" | "offer";

import RunningCarLoader from "./landing/RunningCarLoader";
import GhostScreen, { type GhostScreenKind } from "./landing/GhostScreen";

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
  ghost = "legacy-car",
  ghostHeadline,
  ghostSubhead,
  accent,
}: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const { tenant } = useTenant();

  // Dealer-controlled CTA color for the wizard's Continue / Get-my-offer
  // buttons. Inherits the landing-page color so the customer sees the
  // same primary action color end-to-end. Falls back to the shadcn
  // Button default (theme primary) when no override is set.
  const ctaBg = "hsl(var(--cta-offer))";
  const ctaText = "var(--cta-offer-text)";

  const [screen, setScreen] = useState<Screen>("lookup");
  const [bbVehicle, setBbVehicle] = useState<BBVehicle | null>(null);
  const [mileage, setMileage] = useState("");
  const [overallCondition, setOverallCondition] = useState<"Excellent" | "Good" | "Fair" | "Rough" | "">("");
  const [accidents, setAccidents] = useState<"" | "Yes" | "No">("");
  const [mechanical, setMechanical] = useState<"" | "Yes" | "No">("");
  const [drivable, setDrivable] = useState<"" | "Yes" | "No">("");
  const [ownership, setOwnership] = useState<"" | "Own" | "Loan" | "Lease">("");
  const [submitting, setSubmitting] = useState(false);

  // Run the BB lookup on mount. Uses VIN when the landing handed off
  // a VIN; otherwise plate + state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
        const { data, error } = await supabase.functions.invoke("bb-lookup", { body: lookupBody });
        if (cancelled) return;
        if (error || data?.error || !Array.isArray(data?.vehicles) || data.vehicles.length === 0) {
          toast({
            title: "Couldn't identify the vehicle",
            description: initial.vin
              ? "Double-check the VIN, or call us — we'll get the details over the phone."
              : "Try VIN instead, or call us — we'll get the details over the phone.",
            variant: "destructive",
          });
          return;
        }
        // First match wins (audit recipe — no trim disambiguation up front).
        setBbVehicle(data.vehicles[0] as BBVehicle);
        setScreen("confirm");
      } catch (e) {
        if (cancelled) return;
        toast({
          title: "Lookup failed",
          description: (e as Error).message,
          variant: "destructive",
        });
      }
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

  // Submit the lead and compute the offer. We submit the partial
  // record now and let the offer page handle contact-info collection
  // post-reveal — that's the audit's "collect AFTER the offer" rule.
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

      const { error: insertErr } = await supabase.from("submissions").insert({
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
        next_step: "contact",
        lead_source: isDemoMode ? `${leadSource}-demo` : leadSource,
        dealership_id: tenant.dealership_id,
        ...bbPayload,
        estimated_offer_low: demoEstimateLow,
        estimated_offer_high: demoEstimateHigh,
        offered_price: firmOfferedPrice,
        is_hot_lead: isDemoMode ? false : (estimate?.isHotLead || false),
        offer_subject_to_inspection: isDemoMode ? false : subjectToInspection,
        tcpa_consent_at: new Date().toISOString(),
        tcpa_consent_version: (config as any)?.tcpa_disclosure_version || 1,
        tcpa_consent_text: (config as any)?.tcpa_disclosure || null,
      } as any);

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
      setScreen("condition");
      toast({
        title: "Couldn't get your offer",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    bbVehicle, overallCondition, accidents, mechanical, drivable, ownership, mileage,
    initial.plate, initial.state, density, tenant.dealership_id, config, leadSource,
    navigate, toast,
  ]);

  return (
    <div className="w-full">
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
            className="min-h-[400px] flex items-center justify-center"
          >
            <GhostScreen
              kind={
                ((config as any).ghost_screen as GhostScreenKind) ||
                "legacy-car"
              }
              accent={accent || "#0066CC"}
              size="lg"
              headline={
                initial.vin
                  ? "Looking up your VIN…"
                  : `Looking up your ${initial.plate}…`
              }
              subhead={
                initial.vin
                  ? "Pulling your vehicle details from the registry."
                  : `Pulling your vehicle details from the ${initial.state} registry.`
              }
            />
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
                We found your{" "}
                <span className="font-bold">
                  {bbVehicle.year} {bbVehicle.make} {bbVehicle.model}
                </span>
              </h2>
              {bbVehicle.series && (
                <p className="text-sm text-muted-foreground">{bbVehicle.series}</p>
              )}
            </div>

            {/* Spec chips — Trim · Engine · Drivetrain · Transmission */}
            <div className="flex flex-wrap justify-center gap-2 text-[11px] uppercase tracking-wider">
              {bbVehicle.style && (
                <span className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                  {bbVehicle.style}
                </span>
              )}
              {bbVehicle.engine && (
                <span className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                  {bbVehicle.engine}
                </span>
              )}
              {bbVehicle.drivetrain && (
                <span className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                  {bbVehicle.drivetrain}
                </span>
              )}
              {bbVehicle.transmission && (
                <span className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                  {bbVehicle.transmission}
                </span>
              )}
            </div>

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
                Two minutes from here. Your offer locks for 7 days once you see it.
              </p>
            </div>

            <div className="space-y-7">
              {/* Q1 — Overall condition (always asked) */}
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
                onClick={submitForOffer}
                disabled={submitting}
                size="lg"
                className="h-14 px-7 rounded-full text-base font-semibold"
                style={ctaBg ? { background: ctaBg, color: ctaText } : undefined}
              >
                Get my offer
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </div>
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
    </div>
  );
};

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
