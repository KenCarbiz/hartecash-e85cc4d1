import { useState, useRef, useEffect, useCallback } from "react";
import { Shield, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CalculatingOffer from "@/components/CalculatingOffer";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { logConsent } from "@/lib/consent";
import { calculateOffer, type OfferEstimate, type OfferSettings, type OfferRule } from "@/lib/offerCalculator";
import { resolveEffectiveSettings } from "@/lib/resolvePricingModel";
import { resolveStoreAssignment } from "@/lib/storeAssignment";
import { buildSubmissionBBPayload, fetchMileageAdjustedBBVehicle } from "@/lib/submissionOffer";
import { safeInvoke } from "@/lib/safeInvoke";
import { initialFormData } from "./sell-form/types";
import { useFormConfig } from "@/hooks/useFormConfig";
import { useTenant } from "@/contexts/TenantContext";
import type { FormData, VehicleInfo, BBVehicle } from "./sell-form/types";
import StepVehicleInfo from "./sell-form/StepVehicleInfo";
import StepVehicleBuild from "./sell-form/StepVehicleBuild";
import StepSelectTrim from "./sell-form/StepSelectTrim";
import StepCondition from "./sell-form/StepCondition";
import StepHistory from "./sell-form/StepHistory";
import StepPhotos from "./sell-form/StepPhotos";
import StepFinalize from "./sell-form/StepFinalize";
import { motion, AnimatePresence } from "framer-motion";
import LiveOfferPreview from "./sell-form/LiveOfferPreview";

// Pragmatic email validator — rejects clearly broken addresses (no @, no
// domain dot, whitespace) without trying to be RFC-5322 compliant.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const stepTimeEstimates: Record<string, string> = {
  "Vehicle Info": "30 sec",
  "Select Your Vehicle": "15 sec",
  "Vehicle Build": "30 sec",
  "Condition": "1 min",
  "History": "1 min",
  "Finalize": "15 sec",
};

const stepCtaLabels: Record<string, string> = {
  "Vehicle Info": "Look Up My Vehicle",
  "Select Your Vehicle": "That's My Car",
  "Vehicle Build": "Next: Condition →",
  "Condition": "Almost Done →",
  "History": "Next: Your Details →",
};

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

interface SellCarFormProps {
  leadSource?: string;
  variant?: "default" | "split";
}

const SellCarForm = ({ leadSource = "inventory", variant = "default" }: SellCarFormProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref") || undefined;
  const repCode = searchParams.get("rep") || undefined;
  const storeParam = searchParams.get("store") || undefined;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [showCalculating, setShowCalculating] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  // Pre-issued token used to namespace customer photo uploads. Generated
  // once on mount so AI photo storage paths are stable across step
  // navigation; reused as the submission token if it matches what the
  // form ultimately submits with.
  const [photoSessionToken] = useState<string>(() => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  });
  const [honeypot, setHoneypot] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const partialIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const { formConfig } = useFormConfig();
  const { tenant } = useTenant();

  // Black Book state
  const [bbVehicles, setBbVehicles] = useState<BBVehicle[]>([]);
  const [bbSelectedVehicle, setBbSelectedVehicle] = useState<BBVehicle | null>(null);
  const [bbLoading, setBbLoading] = useState(false);
  const [selectedAddDeducts, setSelectedAddDeducts] = useState<string[]>([]);
  const [showTrimStep, setShowTrimStep] = useState(false);
  const [offerSettingsEarly, setOfferSettingsEarly] = useState<OfferSettings | null>(null);
  const [offerRulesEarly, setOfferRulesEarly] = useState<OfferRule[]>([]);
  const [promoBonus, setPromoBonus] = useState(0);

  // Track form start on mount
  useEffect(() => {
    track('form_started');
  }, []);

  // Pre-set store from embed param
  useEffect(() => {
    if (storeParam) {
      setFormData(prev => ({ ...prev, preferredLocationId: storeParam }));
    }
  }, [storeParam]);

  // ── Resume an abandoned partial submission ──
  // Two entry points:
  //   1. URL ?resume=<submission_id> — typically sent by BDC follow-up
  //   2. localStorage fallback — same-browser revisit within the same session
  // Either way we hydrate formData with whatever the customer entered before
  // and adopt the partial id so the next savePartial() updates instead of
  // creating a new row.
  useEffect(() => {
    const resumeId = searchParams.get("resume") || localStorage.getItem("hartecash_partial_id");
    if (!resumeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("submissions")
        .select("id, name, phone, email, zip, plate, plate_state, vin, vehicle_year, vehicle_make, vehicle_model, mileage, dealership_id, progress_status")
        .eq("id", resumeId)
        .eq("progress_status", "partial")
        .maybeSingle();
      if (cancelled || !data) return;
      // Only resume if the partial belongs to the current tenant — prevents
      // stale localStorage from a different dealer hijacking this session.
      if ((data as any).dealership_id && (data as any).dealership_id !== tenant.dealership_id) {
        localStorage.removeItem("hartecash_partial_id");
        return;
      }
      partialIdRef.current = (data as any).id;
      setFormData((prev) => ({
        ...prev,
        name: (data as any).name || prev.name,
        phone: (data as any).phone || prev.phone,
        email: (data as any).email || prev.email,
        zip: (data as any).zip || prev.zip,
        plate: (data as any).plate || prev.plate,
        state: (data as any).plate_state || prev.state,
        vin: (data as any).vin || prev.vin,
        mileage: String((data as any).mileage || prev.mileage || ""),
        manualYear: String((data as any).vehicle_year || prev.manualYear || ""),
        manualMake: (data as any).vehicle_make || prev.manualMake,
        manualModel: (data as any).vehicle_model || prev.manualModel,
      }));
      toast({
        title: "Welcome back",
        description: "We picked up where you left off — finish the last few details to get your offer.",
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.dealership_id]);

  // Fetch offer settings and active promos early
  useEffect(() => {
    resolveEffectiveSettings(tenant.dealership_id).then(({ settings, rules }) => {
      if (settings) setOfferSettingsEarly(settings);
      if (rules) setOfferRulesEarly(rules);
    }).catch(() => {});

    // Fetch active promo bonus
    supabase
      .from("promotions")
      .select("bonus_amount")
      .eq("dealership_id", tenant.dealership_id)
      .eq("is_active", true)
      .lte("starts_at", new Date().toISOString())
      .then(({ data }) => {
        const active = (data as any[] || []).filter(
          (p: any) => !p.ends_at || new Date(p.ends_at) > new Date()
        );
        const total = active.reduce((sum: number, p: any) => sum + (p.bonus_amount || 0), 0);
        setPromoBonus(total);
      });
  }, [tenant.dealership_id]);
  // ── Abandoned form auto-save ──
  // Save a partial submission when the user has contact info but leaves
  const savePartialRef = useRef<() => void>();
  savePartialRef.current = () => {
    if (submittedRef.current) return;
    if (!config.track_abandoned_leads) return;
    const hasContact = EMAIL_RE.test(formData.email.trim());
    if (!hasContact) return;

    const payload = {
      progress_status: "partial",
      name: formData.name || null,
      phone: formData.phone || null,
      email: formData.email || null,
      zip: formData.zip || null,
      plate: formData.plate || null,
      state: formData.state || null,
      vin: formData.vin || null,
      mileage: formData.mileage || null,
      vehicle_year: vehicleInfo?.year || null,
      vehicle_make: vehicleInfo?.make || null,
      vehicle_model: vehicleInfo?.model || null,
      exterior_color: formData.exteriorColor || null,
      overall_condition: formData.overallCondition || null,
      lead_source: leadSource,
      dealership_id: tenant.dealership_id,
    };

    if (partialIdRef.current) {
      // Update existing partial
      supabase.from("submissions").update(payload as any).eq("id", partialIdRef.current).then(() => {});
    } else {
      // Insert new partial; cache the id locally so the next visit on this
      // browser auto-resumes (URL ?resume= still wins when present).
      supabase.from("submissions").insert(payload as any).select("id").maybeSingle().then(({ data }) => {
        if (data) {
          partialIdRef.current = data.id;
          try { localStorage.setItem("hartecash_partial_id", data.id); } catch { /* private mode */ }
        }
      });
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => savePartialRef.current?.();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") savePartialRef.current?.();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (step > 0 && formRef.current) {
      const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 80;
      const formTop = formRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: formTop - headerHeight - 8, behavior: "smooth" });
    }
  }, [step]);

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const updateArray = (field: string, value: string) =>
    setFormData((prev) => {
      const arr = (prev as any)[field] as string[];
      if (value === "none") return { ...prev, [field]: ["none"] };
      const without = arr.filter((v) => v !== "none");
      return {
        ...prev,
        [field]: without.includes(value)
          ? without.filter((v) => v !== value)
          : [...without, value],
      };
    });

  const toggleAddDeduct = (uoc: string) => {
    setSelectedAddDeducts((prev) =>
      prev.includes(uoc) ? prev.filter((u) => u !== uoc) : [...prev, uoc]
    );
  };

  // Build step order — when offer_before_details is on, contact info moves to offer page
  const offerFirst = formConfig.offer_before_details;

  const getDisplaySteps = () => {
    const steps: string[] = ["Vehicle Info"];
    if (showTrimStep) steps.push("Select Your Vehicle");
    if (formConfig.step_vehicle_build) steps.push("Vehicle Build");
    if (formConfig.step_condition_history) steps.push("Condition");
    // AI Photo step sits between Condition and History — opt-in per dealer
    // via form_config.step_ai_photos (lives with the other step toggles in
    // the Lead Form admin). Customers can skip from inside the step itself;
    // this flag only controls whether the step appears at all.
    if (formConfig.step_ai_photos !== false) steps.push("Photos");
    steps.push("History");
    // Always include contact capture — even in offer-first mode
    steps.push("Finalize");
    return steps;
  };

  const displaySteps = getDisplaySteps();
  const totalSteps = displaySteps.length;

  const lookupBlackBook = async (): Promise<boolean> => {
    const isPlate = formData.plate.trim().length > 0;
    const isVin = formData.vin.trim().length >= 9;
    if (!isPlate && !isVin) return true;

    setBbLoading(true);
    try {
      const body: Record<string, unknown> = {
        lookup_type: isVin ? "vin" : "plate",
        state: formData.state || "CT",
      };
      if (isVin) body.vin = formData.vin.trim();
      else {
        body.plate = formData.plate.trim();
        body.state = formData.state.trim();
      }

      const { data, error } = await supabase.functions.invoke("bb-lookup", { body });

      if (error || data?.error) {
        console.error("BB lookup failed:", error || data?.error);
        toast({
          title: "Vehicle lookup unavailable",
          description: "We couldn't reach the vehicle database. You can retry or continue with manual entry.",
          variant: "destructive",
          action: (
            <ToastAction
              altText="Retry vehicle lookup"
              onClick={() => {
                lookupBlackBook().then((ok) => {
                  if (ok && bbVehicles.length > 0) {
                    setDirection(1);
                    setStep(step + 1);
                  }
                });
              }}
            >
              Retry
            </ToastAction>
          ),
        });
        setBbLoading(false);
        return true;
      }

      const vehicles: BBVehicle[] = data.vehicles || [];

      if (vehicles.length === 0) {
        toast({ title: "Vehicle not found", description: "Please check your info and try again, or continue manually.", variant: "destructive" });
        setBbLoading(false);
        return false;
      }

      setBbVehicles(vehicles);

      const autoSelected = vehicles[0].add_deduct_list
        .filter((ad) => ad.auto !== "N")
        .map((ad) => ad.uoc);
      setSelectedAddDeducts(autoSelected);

      if (vehicles.length === 1) {
        const v = vehicles[0];
        setBbSelectedVehicle(v);
        setVehicleInfo({ year: v.year, make: v.make, model: v.model });
        setFormData((prev) => ({ ...prev, bbUvc: v.uvc }));
        setShowTrimStep(false);
      } else {
        setShowTrimStep(true);
      }

      setBbLoading(false);
      return true;
    } catch (err) {
      console.error("BB lookup error:", err);
      toast({
        title: "Connection issue",
        description: "We couldn't reach the vehicle lookup service. You can retry or continue manually.",
        variant: "destructive",
        action: (
          <ToastAction
            altText="Retry vehicle lookup"
            onClick={() => {
              lookupBlackBook().then((ok) => {
                if (ok && bbVehicles.length > 0) {
                  setDirection(1);
                  setStep(step + 1);
                }
              });
            }}
          >
            Retry
          </ToastAction>
        ),
      });
      setBbLoading(false);
      return true;
    }
  };

  const handleTrimSelect = (uvc: string) => {
    const v = bbVehicles.find((veh) => veh.uvc === uvc);
    if (v) {
      setBbSelectedVehicle(v);
      setVehicleInfo({ year: v.year, make: v.make, model: v.model });
      setFormData((prev) => ({ ...prev, bbUvc: v.uvc }));

      const autoSelected = v.add_deduct_list
        .filter((ad) => ad.auto !== "N")
        .map((ad) => ad.uoc);
      setSelectedAddDeducts(autoSelected);
    }
  };

  const validateStep = (): boolean => {
    const missing: string[] = [];
    const currentStepName = displaySteps[step];

    if (currentStepName === "Vehicle Info") {
      const hasManualYmm = formData.manualYear.length === 4 && formData.manualMake.trim() && formData.manualModel.trim();
      if (!hasManualYmm && !formData.vin.trim() && !formData.plate.trim()) missing.push("VIN, License Plate, or Year/Make/Model");
      if (!hasManualYmm && formData.plate.trim() && !formData.state.trim()) missing.push("State");
    } else if (currentStepName === "Select Your Vehicle") {
      if (!formData.bbUvc) missing.push("Please select your vehicle");
    } else if (currentStepName === "Vehicle Build") {
      if (formConfig.q_exterior_color && !formData.exteriorColor.trim()) missing.push("Exterior Color");
      if (formConfig.q_drivetrain && !formData.drivetrain) missing.push("Drivetrain");
      if (formConfig.q_modifications && !formData.modifications) missing.push("Modifications");
    } else if (currentStepName === "Condition") {
      if (formConfig.q_overall_condition && !formData.overallCondition) missing.push("Overall Condition");
      if (formConfig.q_exterior_damage && formData.exteriorDamage.length === 0) missing.push("Exterior Damage");
      if (formConfig.q_windshield_damage && !formData.windshieldDamage) missing.push("Windshield Damage");
      const noMoonroofDetectable = bbSelectedVehicle && !bbSelectedVehicle.add_deduct_list?.some(
        ad => /moon|sun|panoramic/i.test(ad.name)
      );
      if (formConfig.q_moonroof && !formData.moonroof && !noMoonroofDetectable) missing.push("Moonroof");
      if (formConfig.q_interior_damage && formData.interiorDamage.length === 0) missing.push("Interior Damage");
      if (formConfig.q_tech_issues && formData.techIssues.length === 0) missing.push("Technology Issues");
      if (formConfig.q_engine_issues && formData.engineIssues.length === 0) missing.push("Engine Issues");
      if (formConfig.q_mechanical_issues && formData.mechanicalIssues.length === 0) missing.push("Mechanical Issues");
      if (formConfig.q_drivable && !formData.drivable) missing.push("Drivable");
    } else if (currentStepName === "History") {
      if (!formData.mileage.trim()) missing.push("Mileage");
      if (formConfig.q_accidents && !formData.accidents) missing.push("Accidents");
      if (formConfig.q_smoked_in && !formData.smokedIn) missing.push("Smoked In");
      if (formConfig.q_tires_replaced && !formData.tiresReplaced) missing.push("Tires Replaced");
      if (formConfig.q_num_keys && !formData.numKeys) missing.push("Number of Keys");
      if (!formData.zip.trim()) missing.push("ZIP Code");
    } else if (currentStepName === "Finalize") {
      if (!formData.name.trim()) missing.push("Full Name");
      if (!formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 10) missing.push("Phone Number");
      if (!formData.email.trim()) {
        missing.push("Email Address");
      } else if (!EMAIL_RE.test(formData.email.trim())) {
        // Reject obvious garbage (no @, no domain, trailing dots) so we don't
        // end up with bounce-prone leads in the inbox.
        missing.push("Valid Email Address");
      }
    }

    // In offer-first mode, the last step is History — no contact validation needed

    if (missing.length > 0) {
      toast({
        title: "Please complete all fields",
        description: `Missing: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (displaySteps[step] === "Vehicle Info") {
      const success = await lookupBlackBook();
      if (!success) return;
    }

    if (step < totalSteps - 1) {
      track('form_step_completed', { step, stepName: displaySteps[step] });
      setDirection(1);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    if (honeypot) return;
    submittedRef.current = true;

    const lastSubmit = localStorage.getItem("lastSubmissionTime");
    if (lastSubmit && Date.now() - parseInt(lastSubmit) < 120000) {
      toast({ title: "Please wait", description: "You recently submitted. Please wait a couple of minutes.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const generatedToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Use pre-fetched offer settings, or re-fetch if not available
      let offerSettingsData: OfferSettings | null = offerSettingsEarly;
      let offerRulesData: OfferRule[] = offerRulesEarly;
      if (!offerSettingsData) {
        try {
          const resolved = await resolveEffectiveSettings(tenant.dealership_id);
          offerSettingsData = resolved.settings;
          offerRulesData = resolved.rules;
        } catch { /* use defaults */ }
      }

      let finalBBVehicle = bbSelectedVehicle;
      const cleanMileage = parseInt(formData.mileage.replace(/[^0-9]/g, "")) || 0;
      const lookupVin = formData.vin.trim() || bbSelectedVehicle?.vin || "";

      if (finalBBVehicle && lookupVin && cleanMileage > 0) {
        const refreshedVehicle = await fetchMileageAdjustedBBVehicle({
          vin: lookupVin,
          mileage: cleanMileage,
          state: formData.state || "CT",
          uvc: formData.bbUvc || bbSelectedVehicle?.uvc,
        });

        if (refreshedVehicle) {
          finalBBVehicle = refreshedVehicle;
        }
      }

      const estimate = calculateOffer(finalBBVehicle, formData, selectedAddDeducts, offerSettingsData, offerRulesData, promoBonus);
      const bbPayload = buildSubmissionBBPayload(finalBBVehicle);

      // Resolve store assignment based on admin config
      const storeLocationId = formData.preferredLocationId
        ? formData.preferredLocationId
        : await resolveStoreAssignment(
            { ...config as any, dealership_id: tenant.dealership_id },
            vehicleInfo?.make || "",
            formData.zip || "",
          );

      const { error } = await supabase
        .from("submissions")
        .insert({
          token: generatedToken,
          plate: formData.plate || null,
          state: formData.state || null,
          vin: formData.vin || null,
          mileage: formData.mileage || null,
          vehicle_year: vehicleInfo?.year || null,
          vehicle_make: vehicleInfo?.make || null,
          vehicle_model: vehicleInfo?.model || null,
          exterior_color: formData.exteriorColor || null,
          drivetrain: formData.drivetrain || null,
          modifications: formData.modifications || null,
          overall_condition: formData.overallCondition || null,
          exterior_damage: formData.exteriorDamage,
          windshield_damage: formData.windshieldDamage || null,
          moonroof: formData.moonroof || null,
          interior_damage: formData.interiorDamage,
          tech_issues: formData.techIssues,
          engine_issues: formData.engineIssues,
          mechanical_issues: formData.mechanicalIssues,
          drivable: formData.drivable || null,
          accidents: formData.accidents || null,
          smoked_in: formData.smokedIn || null,
          tires_replaced: formData.tiresReplaced || null,
          num_keys: formData.numKeys || null,
          name: formData.name || null,
          phone: formData.phone || null,
          email: formData.email || null,
          zip: formData.zip || null,
          loan_status: formData.loanStatus || null,
          loan_company: formData.loanCompany || null,
          loan_balance: formData.loanBalance || null,
          loan_payment: formData.loanPayment || null,
          next_step: "photos",
          lead_source: leadSource,
          dealership_id: tenant.dealership_id,
          ...bbPayload,
          estimated_offer_low: estimate?.low || null,
          estimated_offer_high: estimate?.high || null,
          is_hot_lead: estimate?.isHotLead || false,
          matched_rule_ids: estimate?.matchedRuleIds?.length ? estimate.matchedRuleIds : null,
          store_location_id: storeLocationId || null,
          salesperson_name: formData.salespersonName || null,
          bb_selected_options: selectedAddDeducts.length > 0 ? selectedAddDeducts : [],
          referral_code: referralCode || null,
          assigned_rep_email: repCode || null,
        } as any);

      if (error) throw error;

      // Clean up any partial submission we saved earlier
      if (partialIdRef.current) {
        supabase.from("submissions").delete().eq("id", partialIdRef.current).then(() => {});
        partialIdRef.current = null;
      }
      try { localStorage.removeItem("hartecash_partial_id"); } catch { /* noop */ }

      // Fire new_submission staff notification
      const { data: insertedSub } = await supabase
        .from("submissions")
        .select("id, is_hot_lead")
        .eq("token", generatedToken)
        .maybeSingle();

      if (insertedSub) {
        safeInvoke("send-notification", {
          body: { trigger_key: "new_submission", submission_id: insertedSub.id },
          context: { from: "SellCarForm.submit", submission_id: insertedSub.id },
        });

        // If hot lead, fire hot_lead notification too
        if (insertedSub.is_hot_lead) {
          safeInvoke("send-notification", {
            body: { trigger_key: "hot_lead", submission_id: insertedSub.id },
            context: { from: "SellCarForm.submit.hot_lead", submission_id: insertedSub.id },
          });
        }
      }

      localStorage.setItem("lastSubmissionTime", Date.now().toString());

      track('form_submitted', { hasVin: !!formData.vin, hasPlate: !!formData.plate });

      logConsent({
        customerName: formData.name,
        customerPhone: formData.phone,
        customerEmail: formData.email,
        formSource: "sell_form",
        submissionToken: generatedToken,
        dealershipName: config.dealership_name,
        // Pass the self-reported loan status so the consent text
        // includes the payoff verification authorization ONLY when
        // the customer has indicated there's an outstanding loan.
        // Customers who own outright get the v1 TCPA-only consent.
        loanStatus: formData.loanStatus || null,
      });

      // Show calculating animation if enabled, otherwise navigate directly
      if (config.use_animated_calculating) {
        setPendingToken(generatedToken);
        setShowCalculating(true);
      } else {
        navigate(`/offer/${generatedToken}`);
      }
    } catch (err) {
      toast({ title: "Submission failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleCalculatingComplete = useCallback(() => {
    if (pendingToken) {
      navigate(`/offer/${pendingToken}`);
    }
  }, [pendingToken, navigate]);

  const currentStepName = displaySteps[step];

  const renderStep = () => {
    switch (currentStepName) {
      case "Vehicle Info":
        return <StepVehicleInfo formData={formData} update={update} vehicleInfo={vehicleInfo} setVehicleInfo={setVehicleInfo} bbSelectedVehicle={bbSelectedVehicle} />;
      case "Select Your Vehicle":
        return <StepSelectTrim vehicles={bbVehicles} selectedUvc={formData.bbUvc} onSelect={(uvc) => { handleTrimSelect(uvc); }} />;
      case "Vehicle Build":
        return (
          <StepVehicleBuild
            formData={formData}
            update={update}
            vehicleInfo={vehicleInfo}
            bbVehicle={bbSelectedVehicle}
            selectedAddDeducts={selectedAddDeducts}
            onToggleAddDeduct={toggleAddDeduct}
            formConfig={formConfig}
          />
        );
      case "Condition":
        return (
          <>
            <LiveOfferPreview formData={formData} bbVehicle={bbSelectedVehicle} selectedAddDeducts={selectedAddDeducts} offerSettings={offerSettingsEarly} offerRules={offerRulesEarly} promoBonus={promoBonus} />
            <StepCondition formData={formData} updateArray={updateArray} update={update} formConfig={formConfig} bbVehicle={bbSelectedVehicle} vehicleInfo={vehicleInfo} />
          </>
        );
      case "Photos":
        return (
          <StepPhotos
            submissionToken={photoSessionToken}
            dealershipId={tenant.dealership_id}
            minRequired={formConfig.ai_photos_min_required ?? 4}
            onComplete={() => {
              setDirection(1);
              setStep((s) => s + 1);
            }}
            onSkip={() => {
              setDirection(1);
              setStep((s) => s + 1);
            }}
          />
        );
      case "History":
        return <StepHistory formData={formData} update={update} formConfig={formConfig} bbVehicle={bbSelectedVehicle} vehicleInfo={vehicleInfo} leadSource={leadSource} />;
      case "Finalize":
        return <StepFinalize formData={formData} update={update} offerFirst={offerFirst} />;
      default:
        return null;
    }
  };

  if (showCalculating) {
    return (
      <div className="fixed inset-0 z-50">
        <CalculatingOffer
          vehicleYear={vehicleInfo?.year}
          vehicleMake={vehicleInfo?.make}
          vehicleModel={vehicleInfo?.model}
          onComplete={handleCalculatingComplete}
        />
      </div>
    );
  }

  return (
    <div ref={formRef} className={`bg-card rounded-2xl shadow-xl p-6 md:p-8 relative z-10 ${variant === "split" ? "w-full" : "mx-auto -mt-10 mb-10 max-w-lg w-[calc(100%-40px)]"}`}>
      {/* Progress - Premium numbered stepper */}
      <div className="mb-6 pb-5 border-b border-border/50">
        <div className="flex justify-center items-center gap-1 mb-3">
          {displaySteps.map((s, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < step
                    ? "bg-success text-success-foreground shadow-md shadow-success/30"
                    : i === step
                    ? "bg-gradient-to-br from-accent to-[hsl(var(--accent)/0.8)] text-accent-foreground shadow-lg shadow-accent/30 scale-110 ring-2 ring-accent/20 ring-offset-2 ring-offset-card"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < displaySteps.length - 1 && (
                <div className={`w-6 lg:w-10 h-0.5 mx-0.5 rounded-full transition-all duration-300 ${
                  i < step ? "bg-success" : "bg-border"
                }`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground font-medium">
          <strong className="text-card-foreground font-bold">{currentStepName}</strong>
          <span className="text-xs text-muted-foreground ml-1.5">· ~{stepTimeEstimates[currentStepName] || "30 sec"}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
          tabIndex={-1}
          autoComplete="off"
          aria-label="Website"
        />
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Photos step provides its own Continue / Skip — suppress the
            standard footer so we don't render two competing CTAs. */}
        <div className={`flex gap-3 ${currentStepName === "Photos" ? "hidden" : ""}`}>
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="flex-1 py-4 text-base font-bold border-[hsl(var(--cta-offer))] text-[hsl(var(--cta-offer))] hover:bg-[hsl(var(--cta-offer))]/10"
            >
              Back
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={bbLoading}
              className="flex-1 py-4 text-white text-[17px] font-bold shadow-lg hover:-translate-y-0.5 transition-all"
              style={{ backgroundColor: "hsl(var(--cta-offer))", boxShadow: "0 10px 15px -3px hsl(var(--cta-offer) / 0.3)" }}
            >
              {bbLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Looking up vehicle…
                </span>
              ) : (
                stepCtaLabels[currentStepName] || "Continue"
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 text-white text-[17px] font-bold shadow-lg hover:-translate-y-0.5 transition-all"
              style={{ backgroundColor: "hsl(var(--cta-offer))", boxShadow: "0 10px 15px -3px hsl(var(--cta-offer) / 0.3)" }}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Calculating your offer…
                </span>
              ) : (
                offerFirst ? "See My Offer →" : "Get My Offer →"
              )}
            </Button>
          )}
        </div>
      </form>

      <p className="text-center mt-4 text-[13px] text-muted-foreground">
        🔒 Your information is 100% secure and never shared.
      </p>

      <div className="relative mt-6 p-5 rounded-xl text-center overflow-hidden bg-gradient-to-br from-success via-success to-[hsl(160,84%,28%)] text-success-foreground shadow-xl shadow-success/25">
        {/* Glassmorphism shimmer */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_30%,hsl(0,0%,100%,0.1)_50%,transparent_70%)] pointer-events-none" />
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-success-foreground/5 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-success-foreground/15 backdrop-blur-sm flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-extrabold tracking-wide mb-1.5">{config.price_guarantee_days}-DAY PRICE GUARANTEE</h2>
          <p className="text-sm leading-relaxed opacity-90">Your offer is locked in. No games. No surprises.</p>
        </div>
      </div>
    </div>
  );
};

export default SellCarForm;
