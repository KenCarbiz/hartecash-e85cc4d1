import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, ArrowDown, TrendingUp, ShieldCheck, Info, Printer, CheckCircle, ArrowRight, Car, Gauge, Palette, Settings2, Pencil, User, Clock, Star, Zap, Shield, BadgeCheck, Handshake } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import InspectionDisclosure from "@/components/portal/InspectionDisclosure";
import logoFallback from "@/assets/logo-placeholder-white.png";
import PortalSkeleton from "@/components/PortalSkeleton";
import CalculatingOffer from "@/components/CalculatingOffer";
import { getTaxRateFromZip, calcTradeInValue, STATE_NAMES } from "@/lib/salesTax";
import VehicleImage from "@/components/sell-form/VehicleImage";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { InlineEdit } from "@/components/offer/InlineEdit";
import OfferConditionBlock, { buildConditionItems } from "@/components/offer/OfferConditionBlock";
import OfferPrintLayout from "@/components/offer/OfferPrintLayout";
import { buildOfferFormData, buildStoredBBVehicle, buildSubmissionBBPayload, parseStoredJson } from "@/lib/submissionOffer";
import { calculateOffer, type OfferSettings, type OfferRule } from "@/lib/offerCalculator";
import { resolveEffectiveSettings } from "@/lib/resolvePricingModel";
import { useToast } from "@/hooks/use-toast";
import SlideToAccept from "@/components/SlideToAccept";
import SaveOfferButton from "@/components/offer/SaveOfferButton";


interface OfferSubmission {
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
  offered_price: number | null;
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  bb_tradein_avg: number | null;
  token: string;
  zip: string | null;
  vin: string | null;
  created_at: string | null;
  loan_status: string | null;
  progress_status: string | null;
  photos_uploaded: boolean;
  // New BB fields
  bb_msrp: number | null;
  bb_class_name: string | null;
  bb_drivetrain: string | null;
  bb_transmission: string | null;
  bb_fuel_type: string | null;
  bb_engine: string | null;
  bb_mileage_adj: number | null;
  bb_regional_adj: number | null;
  bb_base_whole_avg: number | null;
  bb_retail_avg: number | null;
  bb_wholesale_avg: number | null;
}

interface ConditionDetails {
  dealership_id: string;
  accidents: string | null;
  drivable: string | null;
  exterior_damage: string[] | null;
  interior_damage: string[] | null;
  mechanical_issues: string[] | null;
  engine_issues: string[] | null;
  tech_issues: string[] | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  windshield_damage: string | null;
  modifications: string | null;
  drivetrain: string | null;
  // BB verified data
  bb_msrp: number | null;
  bb_class_name: string | null;
  bb_drivetrain: string | null;
  bb_transmission: string | null;
  bb_fuel_type: string | null;
  bb_engine: string | null;
  bb_mileage_adj: number | null;
  bb_regional_adj: number | null;
  bb_base_whole_avg: number | null;
  bb_retail_avg: number | null;
  bb_wholesale_avg: number | null;
  bb_tradein_avg: number | null;
  bb_value_tiers: Record<string, Record<string, number>> | string | null;
  bb_add_deducts: unknown;
  bb_selected_options: string[] | string | null;
}

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "very_good", label: "Very Good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const LOCKED_OFFER_STATUSES = new Set([
  "offer_accepted",
  "inspection_scheduled",
  "inspection_completed",
  "appraisal_completed",
  "manager_approval",
  "price_agreed",
  "docs_title",
  "deal_finalized",
  "title_verified",
  "ownership_verified",
  "title_ownership_verified",
  "check_request_submitted",
  "purchase_complete",
]);

const OfferPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<OfferSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"sell" | "trade">("sell");
  const [condition, setCondition] = useState<ConditionDetails | null>(null);
  const [calculatingDone, setCalculatingDone] = useState(false);
  const [offerSettings, setOfferSettings] = useState<OfferSettings | null>(null);
  const [offerRules, setOfferRules] = useState<OfferRule[]>([]);
  const [stickyCompact, setStickyCompact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appointment, setAppointment] = useState<{ preferred_date: string; preferred_time: string; store_location: string | null } | null>(null);
  const [dealerLocations, setDealerLocations] = useState<{ id: string; name: string; city: string; state: string; address: string | null }[]>([]);
  
  // Contact info gate for offer-first flow
  const [showContactGate, setShowContactGate] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", zip: "" });
  const [contactSaving, setContactSaving] = useState(false);
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  const { config } = useSiteConfig();
  const { toast } = useToast();

  const explanationRef = useRef<HTMLDivElement>(null);

  const handleCalculatingComplete = useCallback(() => {
    setCalculatingDone(true);
  }, []);

  // Collapse sticky bar on scroll
  useEffect(() => {
    const onScroll = () => setStickyCompact(window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const { data, error: err } = await supabase.rpc("get_submission_portal", { _token: token });
      if (err || !data || data.length === 0) { setError("Offer not found."); setLoading(false); return; }
      const sub = data[0] as unknown as OfferSubmission;

      const [condRes, apptRes, locRes] = await Promise.all([
        supabase
          .from("submissions")
          .select("dealership_id, accidents, drivable, exterior_damage, interior_damage, mechanical_issues, engine_issues, tech_issues, smoked_in, tires_replaced, num_keys, windshield_damage, modifications, drivetrain, bb_msrp, bb_class_name, bb_drivetrain, bb_transmission, bb_fuel_type, bb_engine, bb_mileage_adj, bb_regional_adj, bb_base_whole_avg, bb_retail_avg, bb_wholesale_avg, bb_tradein_avg, bb_value_tiers, bb_add_deducts, bb_selected_options")
          .eq("token", token)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("preferred_date, preferred_time, store_location")
          .eq("submission_token", token)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("dealership_locations")
          .select("id, name, city, state, address")
          .eq("is_active", true),
      ]);

      const conditionData = condRes.data as ConditionDetails | null;
      const pricingRes = await resolveEffectiveSettings(conditionData?.dealership_id || "default");

      let nextSubmission = sub;
      let nextCondition = conditionData;

      if (conditionData) {
        const selectedOptions = parseStoredJson<string[]>(conditionData.bb_selected_options, []);
        const resolvedBBVehicle = buildStoredBBVehicle({ ...sub, ...conditionData });

        if (resolvedBBVehicle) {
          const estimate = calculateOffer(
            resolvedBBVehicle,
            buildOfferFormData({ ...sub, ...conditionData }),
            selectedOptions,
            pricingRes.settings,
            pricingRes.rules,
          );

          if (estimate) {
            const bbPayload = buildSubmissionBBPayload(resolvedBBVehicle);
            const needsRefresh =
              estimate.high !== sub.estimated_offer_high ||
              estimate.low !== sub.estimated_offer_low ||
              bbPayload.bb_tradein_avg !== sub.bb_tradein_avg ||
              typeof conditionData.bb_value_tiers === "string" ||
              typeof conditionData.bb_add_deducts === "string";

            if (needsRefresh) {
              await supabase
                .from("submissions")
                .update({
                  estimated_offer_low: estimate.low,
                  estimated_offer_high: estimate.high,
                  ...bbPayload,
                } as any)
                .eq("token", token);

              nextSubmission = {
                ...sub,
                estimated_offer_low: estimate.low,
                estimated_offer_high: estimate.high,
                bb_tradein_avg: bbPayload.bb_tradein_avg,
                bb_wholesale_avg: bbPayload.bb_wholesale_avg,
                bb_retail_avg: bbPayload.bb_retail_avg,
                bb_mileage_adj: bbPayload.bb_mileage_adj,
                bb_base_whole_avg: bbPayload.bb_base_whole_avg,
              };
              nextCondition = {
                ...conditionData,
                ...bbPayload,
              };
            }
          }
        }
      }

      setSubmission(nextSubmission);
      if (nextCondition) setCondition(nextCondition);
      if (pricingRes.settings) setOfferSettings(pricingRes.settings);
      if (pricingRes.rules) setOfferRules(pricingRes.rules);
      if (apptRes.data) setAppointment(apptRes.data as { preferred_date: string; preferred_time: string; store_location: string | null });
      if (locRes.data) setDealerLocations(locRes.data as any);
      setLoading(false);
    };
    fetchData();
  }, [token]);

  /* ─── Inline edit handler: update condition + recalculate ─── */
  const handleFieldUpdate = async (field: string, value: string | string[]) => {
    if (!submission || !condition) return;

    // Update local condition state
    const newCondition = { ...condition, [field]: value };
    setCondition(newCondition);

    // Also update submission-level fields
    const newSubmission = { ...submission };
    if (field === "overall_condition") newSubmission.overall_condition = value as string;
    if (field === "mileage") newSubmission.mileage = value as string;
    if (field === "exterior_color") newSubmission.exterior_color = value as string;

    // Always use stored BB data — never make a new Black Book call on edit.
    // The offer logic engine recalculates using the already-persisted market data.
    const resolvedBBVehicle = buildStoredBBVehicle({ ...newSubmission, ...newCondition });

    if (resolvedBBVehicle) {
      const newEstimate = calculateOffer(
        resolvedBBVehicle,
        buildOfferFormData({ ...newSubmission, ...newCondition }),
        parseStoredJson<string[]>(newCondition.bb_selected_options, []),
        offerSettings,
        offerRules,
      );

      if (newEstimate) {
        newSubmission.estimated_offer_low = newEstimate.low;
        newSubmission.estimated_offer_high = newEstimate.high;
      }
    }

    setSubmission(newSubmission);

    // Save to database
    setSaving(true);
    try {
      const updateData: Record<string, any> = { [field]: value };
      // Also save recalculated offer
      if (newSubmission.estimated_offer_low !== submission.estimated_offer_low ||
          newSubmission.estimated_offer_high !== submission.estimated_offer_high) {
        updateData.estimated_offer_low = newSubmission.estimated_offer_low;
        updateData.estimated_offer_high = newSubmission.estimated_offer_high;
      }
      await supabase
        .from("submissions")
        .update(updateData as any)
        .eq("token", token!);

      toast({
        title: "Updated",
        description: "Your answer has been updated and your offer recalculated.",
      });
    } catch {
      toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
    }
    setSaving(false);
  };

  const scrollToExplanation = () => {
    setActiveTab("trade");
    setTimeout(() => {
      explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const useAnimated = config.use_animated_calculating;

  if (loading) {
    return useAnimated ? <CalculatingOffer previewMode /> : <PortalSkeleton />;
  }

  if (!calculatingDone && useAnimated && submission && !error) {
    return (
      <CalculatingOffer
        vehicleYear={submission.vehicle_year || undefined}
        vehicleMake={submission.vehicle_make || undefined}
        vehicleModel={submission.vehicle_model || undefined}
        onComplete={handleCalculatingComplete}
      />
    );
  }

  if (error || !submission) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-4">
          <Car className="w-8 h-8 text-muted-foreground/30" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground mb-2 tracking-tight">Offer Not Available</h1>
        <p className="text-sm text-muted-foreground">{error || "No offer has been made yet."}</p>
        <Link to="/my-submission" className="inline-flex items-center gap-1.5 text-primary font-semibold mt-4 text-sm hover:underline">
          Check your submission <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );

  const s = submission;
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
  const firstName = s.name?.split(" ")[0] || "";

  const liveSelectedOptions = parseStoredJson<string[]>(condition?.bb_selected_options, []);
  const liveBBVehicle = condition ? buildStoredBBVehicle({ ...s, ...condition }) : null;
  const liveEstimate = liveBBVehicle
    ? calculateOffer(
        liveBBVehicle,
        buildOfferFormData({ ...s, ...condition }),
        liveSelectedOptions,
        offerSettings,
        offerRules,
      )
    : null;

  const isAccepted = !!s.progress_status && LOCKED_OFFER_STATUSES.has(s.progress_status);
  const hasStoredOfferData = Boolean(
    s.bb_tradein_avg ||
    s.bb_wholesale_avg ||
    s.bb_retail_avg ||
    condition?.bb_value_tiers,
  );
  const cashOffer = (!isAccepted ? liveEstimate?.high : s.offered_price)
    ?? s.estimated_offer_high
    ?? s.offered_price
    ?? 0;

  if (cashOffer <= 0) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-4">
          <DollarSign className="w-8 h-8 text-muted-foreground/30" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground mb-2 tracking-tight">Offer Not Available</h1>
        <p className="text-sm text-muted-foreground">No offer has been made yet.</p>
        <Link to="/my-submission" className="inline-flex items-center gap-1.5 text-primary font-semibold mt-4 text-sm hover:underline">
          Check your submission <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );

  const zipResult = getTaxRateFromZip(s.zip || "");
  // Default to Connecticut 6.35% if no state can be determined
  const state = zipResult.state || "CT";
  const taxRate = zipResult.state ? zipResult.rate : 0.0635;
  const stateName = STATE_NAMES[state] || state;
  const taxPercent = (taxRate * 100).toFixed(2);
  const taxSavings = cashOffer * taxRate;
  const tradeInValue = calcTradeInValue(cashOffer, taxRate);
  const tradeInValueLow = tradeInValue;

  // Offer stays editable until it has moved into a locked post-acceptance state.
  const canEdit = !isAccepted && hasStoredOfferData;

  // Price guarantee countdown
  const guaranteeDays = config.price_guarantee_days || 8;
  const createdDate = s.created_at ? new Date(s.created_at) : null;
  const expiresDate = createdDate ? new Date(createdDate.getTime() + guaranteeDays * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const msRemaining = expiresDate ? expiresDate.getTime() - now.getTime() : 0;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const isExpired = daysRemaining <= 0;
  const isUrgent = daysRemaining <= 2 && !isExpired;

  const GuaranteeBadge = createdDate && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className={`flex items-center justify-center gap-2.5 rounded-2xl px-4 py-2.5 text-xs font-bold print:border print:border-border border backdrop-blur-sm ${
        isExpired
          ? "bg-destructive/8 text-destructive border-destructive/15"
          : isUrgent
          ? "bg-amber-500/8 text-amber-600 dark:text-amber-400 border-amber-500/15 animate-pulse"
          : "bg-success/8 text-success border-success/15"
      }`}
    >
      <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
      {isExpired ? (
        <span>Price guarantee expired — contact us for an updated offer</span>
      ) : (
        <span>
          Price locked for <span className="font-extrabold">{daysRemaining}</span> {daysRemaining === 1 ? "day" : "days"}
          {expiresDate && <span className="opacity-60 font-medium"> · exp. {expiresDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
        </span>
      )}
    </motion.div>
  );

  const handlePrint = () => {
    window.print();
  };

  /* ─── Shared sub-components rendered inline ─── */

  const TabSwitcher = (
    <div className="relative flex bg-muted/40 rounded-2xl p-1.5 print:hidden border border-border/30 backdrop-blur-sm shadow-inner">
      <motion.div
        className="absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-[0_4px_16px_rgba(var(--primary),0.25)]"
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          width: "calc(50% - 6px)",
          left: activeTab === "sell" ? "6px" : "calc(50% + 0px)",
        }}
      />
      <button
        onClick={() => setActiveTab("sell")}
        className={`relative z-10 flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3 px-4 rounded-xl transition-all duration-200 ${
          activeTab === "sell"
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <DollarSign className="w-4 h-4" />
        Cash Offer
      </button>
      <button
        onClick={scrollToExplanation}
        className={`relative z-10 flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3 px-4 rounded-xl transition-all duration-200 ${
          activeTab === "trade"
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <TrendingUp className="w-4 h-4" />
        Trade-In Value
      </button>
    </div>
  );

  const acceptUrl = `/deal/${token}${activeTab === "trade" ? "?mode=trade" : ""}`;

  // Check if contact info is missing (offer-first flow)
  const isMissingContactInfo = !s.name || !s.email || !s.phone;

  const handleAcceptAttempt = () => {
    if (isMissingContactInfo) {
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
    if (phoneDigits.length < 10) errors.phone = "Valid phone number is required (10+ digits)";
    if (!contactForm.zip.trim() || contactForm.zip.replace(/\D/g, "").length < 5) errors.zip = "Valid zip code is required";
    
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
        } as any)
        .eq("token", token!);
      
      setShowContactGate(false);
      window.location.href = acceptUrl;
    } catch {
      toast({ title: "Error", description: "Failed to save your info. Please try again.", variant: "destructive" });
    }
    setContactSaving(false);
  };

  const AcceptButton = (
    <div className="print:hidden space-y-3">
      {isAccepted ? (
        <div className="w-full py-4 flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-success to-success/90 text-white font-bold text-base shadow-[0_4px_20px_rgba(34,197,94,0.25)]">
          <CheckCircle className="w-5 h-5" />
          Offer Accepted
        </div>
      ) : (
        <>
          {/* Mobile: slide gesture */}
          <div className="lg:hidden">
            <SlideToAccept
              onAccept={handleAcceptAttempt}
              label="Slide to Accept Your Price"
            />
          </div>
          {/* Desktop: premium accept button */}
          <div className="hidden lg:block">
            <Button
              onClick={handleAcceptAttempt}
              className="relative w-full py-6 text-base font-extrabold text-white gap-2.5 rounded-2xl overflow-hidden group transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundColor: "hsl(var(--cta-accept))", boxShadow: "0 8px 32px hsl(var(--cta-accept) / 0.3), 0 2px 8px hsl(var(--cta-accept) / 0.2)" }}
            >
              {/* Animated shine sweep */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <CheckCircle className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Accept & Lock In Your Price</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/60 text-center flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            No obligation until inspection · Free to walk away
          </p>
          {/* Save Offer — reduces bounce */}
          <SaveOfferButton
            token={token!}
            vehicleStr={vehicleStr}
            customerName={firstName}
            customerEmail={s.email || undefined}
            customerPhone={s.phone || undefined}
            guaranteeDays={guaranteeDays}
            dealershipName={config.dealership_name || "Our Dealership"}
          />
        </>
      )}
    </div>
  );

  const OfferDisplay = (
    <AnimatePresence mode="wait">
      {activeTab === "sell" ? (
        <motion.div
          key={`sell-${cashOffer}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="text-center py-2"
        >
          <p className="text-[11px] text-muted-foreground/70 uppercase tracking-widest font-semibold mb-2">
            {isAccepted ? "Accepted Cash Offer" : "Your Cash Offer"}
          </p>
          <div className="relative inline-block">
            {/* Subtle glow behind price */}
            <div className="absolute inset-0 blur-2xl bg-accent/15 rounded-full scale-150 pointer-events-none" />
            <p className="relative text-5xl lg:text-6xl font-black text-accent tracking-tighter font-display">
              ${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            Subject to in-person inspection
          </p>
        </motion.div>
      ) : (
        <motion.div
          key={`trade-${tradeInValue}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="text-center py-2"
        >
          <p className="text-[11px] text-muted-foreground/70 uppercase tracking-widest font-semibold mb-2">
            {isAccepted ? "Accepted Trade-In Value" : "Your Trade-In Total Value"}
          </p>
          <div className="relative inline-block">
            <div className="absolute inset-0 blur-2xl bg-success/15 rounded-full scale-150 pointer-events-none" />
            <p className="relative text-5xl lg:text-6xl font-black text-success tracking-tighter font-display">
              ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2 flex items-center justify-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-success" />
            Includes <span className="font-bold text-success">${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> tax credit
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const TradeInBounce = activeTab === "sell" && (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      onClick={scrollToExplanation}
      className="mt-1 mx-auto flex items-center gap-2 text-xs font-semibold text-success hover:text-success/80 transition-colors print:hidden bg-success/5 hover:bg-success/10 rounded-xl px-3 py-1.5 border border-success/10"
    >
      <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
      Worth <span className="font-extrabold">${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> as a trade-in
    </motion.button>
  );

  /* ─── Vehicle Summary Card — Premium ─── */
  const VehicleSummary = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.05)] overflow-hidden border border-border/30"
    >
      <div className="bg-gradient-to-r from-muted/50 via-muted/30 to-transparent px-5 py-3.5 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Car className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold text-card-foreground text-sm">Vehicle Summary</h3>
          </div>
          {canEdit && (
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 bg-muted/40 rounded-lg px-2 py-0.5">
              <Pencil className="w-3 h-3" /> Click to edit
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        {vehicleStr && (
          <p className="text-lg font-extrabold text-card-foreground mb-4 tracking-tight">{vehicleStr}</p>
        )}
        <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
          {[
            { show: !!s.vin, iconEl: <span className="text-[9px] font-black text-muted-foreground/70">VIN</span>, label: "VIN", content: <p className="text-sm font-semibold font-mono tracking-wide">{s.vin?.toUpperCase()}</p> },
            { show: !!(s.mileage || canEdit), icon: Gauge, label: "Mileage", content: canEdit ? (
                <InlineEdit value={s.mileage ? Number(s.mileage).toLocaleString() : "—"} onSave={(val) => handleFieldUpdate("mileage", val.replace(/[^0-9]/g, ""))} label="mileage" className="text-sm font-semibold" />
              ) : <p className="text-sm font-semibold">{Number(s.mileage).toLocaleString()} mi</p>
            },
            { show: !!(s.exterior_color || canEdit), icon: Palette, label: "Color", content: canEdit ? (
                <InlineEdit value={s.exterior_color || "—"} onSave={(val) => handleFieldUpdate("exterior_color", val)} label="color" className="text-sm font-semibold" />
              ) : <p className="text-sm font-semibold">{s.exterior_color}</p>
            },
            { show: !!(condition?.drivetrain || canEdit), icon: Settings2, label: "Powertrain", content: <p className="text-sm font-semibold capitalize">{condition?.drivetrain || "—"}</p> },
            { show: !!(s.overall_condition || canEdit), icon: CheckCircle, label: "Condition", content: canEdit ? (
                <InlineEdit value={s.overall_condition || "good"} onSave={(val) => handleFieldUpdate("overall_condition", val)} type="select" options={CONDITION_OPTIONS} label="condition" className="text-sm font-semibold capitalize" />
              ) : <p className="text-sm font-semibold capitalize">{CONDITION_OPTIONS.find(o => o.value === s.overall_condition)?.label || s.overall_condition?.replace(/_/g, " ")}</p>
            },
          ].filter(item => item.show).map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 group/item hover:bg-muted/20 -mx-2 px-2 py-1 rounded-xl transition-colors">
              <div className="w-8 h-8 rounded-xl bg-muted/60 group-hover/item:bg-primary/8 flex items-center justify-center shrink-0 transition-colors">
                {item.icon ? <item.icon className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/item:text-primary/70 transition-colors" /> : item.iconEl}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold">{item.label}</p>
                {item.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );




  const conditionItems = buildConditionItems(condition);

  const ConditionBlock = (
    <OfferConditionBlock
      conditionItems={conditionItems}
      vehicleStr={vehicleStr}
      canEdit={canEdit}
      saving={saving}
      onFieldUpdate={handleFieldUpdate}
    />
  );

  /* Trade-in explanation — Premium */
  const TradeInExplanation = (
    <div ref={explanationRef} className="scroll-mt-40">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="bg-card rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.05)] overflow-hidden border border-success/15"
      >
        <div className="bg-gradient-to-r from-success/8 via-success/5 to-transparent px-5 py-3.5 border-b border-success/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <div>
              <h3 className="font-bold text-card-foreground text-sm">Trade-In Tax Credit</h3>
              <p className="text-[10px] text-muted-foreground/60">See how much more your vehicle is worth</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            When you trade in your vehicle toward a purchase at <span className="font-semibold text-card-foreground">{config.dealership_name || "our dealership"}</span>,
            you receive a sales tax credit on the value of your trade.
          </p>

          {/* Premium breakdown */}
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-2xl p-5 space-y-3 mb-5 border border-border/20">
            <div className="flex justify-between items-center text-sm py-1">
              <span className="text-muted-foreground">Cash offer value</span>
              <span className="font-bold text-card-foreground">${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-1">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3 text-muted-foreground/40" />
                {stateName} sales tax rate
              </span>
              <span className="font-bold text-card-foreground">{taxPercent}%</span>
            </div>
            <div className="flex justify-between items-center text-sm py-1">
              <span className="text-muted-foreground">Sales tax credit savings</span>
              <span className="font-bold text-success">+${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t border-border/30 pt-4 flex justify-between items-center">
              <span className="font-bold text-card-foreground">Total trade-in value</span>
              <div className="text-right">
                <span className="text-2xl font-black text-success tracking-tight font-display">
                  ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-[11px] text-muted-foreground/60 bg-muted/20 rounded-xl p-3.5 border border-border/10">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary/50" />
            <p className="leading-relaxed">
              Based on {stateName}'s {taxPercent}% rate{zipResult.state ? ` (ZIP ${s.zip})` : ""}.
              <span className="font-mono text-muted-foreground"> ${cashOffer.toLocaleString()} × {(1 + taxRate).toFixed(4)} = ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>.
              Subject to qualifications.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );

  const NoTaxBlock = null;





  const portalUrl = `${window.location.origin}/my-submission/${token}`;

  const getLocationLabel = (loc: string | null): string | null => {
    if (!loc) return null;
    const found = dealerLocations.find(l => l.id === loc || l.name.toLowerCase().replace(/\s+/g, "_") === loc);
    if (found) return `${found.name} — ${found.city}, ${found.state}`;
    return loc;
  };

  const getLocationAddress = (loc: string | null): string | null => {
    if (!loc) return null;
    const found = dealerLocations.find(l => l.id === loc || l.name.toLowerCase().replace(/\s+/g, "_") === loc);
    if (found?.address) return `${found.address}, ${found.city}, ${found.state}`;
    if (found) return `${found.city}, ${found.state}`;
    return null;
  };

  return (
    <div className="print-native min-h-screen bg-background print:bg-white">
      {/* ─── PRINT-ONLY: Custom one-page layout ─── */}
      <OfferPrintLayout
        config={config}
        logoFallback={logoFallback}
        submission={s}
        condition={condition}
        vehicleStr={vehicleStr}
        createdDate={createdDate}
        isEstimate={!isAccepted}
        isExpired={isExpired}
        daysRemaining={daysRemaining}
        expiresDate={expiresDate}
        activeTab={activeTab}
        cashOffer={cashOffer}
        estimateLow={cashOffer}
        tradeInValue={tradeInValue}
        tradeInValueLow={tradeInValueLow}
        taxRate={taxRate}
        taxSavings={taxSavings}
        taxPercent={taxPercent}
        stateName={stateName}
        conditionItems={conditionItems}
        appointment={appointment}
        portalUrl={portalUrl}
        getLocationLabel={getLocationLabel}
        getLocationAddress={getLocationAddress}
      />

      {/* ── Premium Header ── */}
      <div className="print:hidden relative overflow-hidden">
        {/* Gradient mesh background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/80" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 25% 40%, white 1px, transparent 1px), radial-gradient(circle at 75% 60%, white 1px, transparent 1px)", backgroundSize: "60px 60px, 80px 80px" }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary-foreground/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/3" />

        <div className="relative text-primary-foreground px-6 py-4">
          <div className="max-w-5xl mx-auto">
            <Link to={`/my-submission/${token}`} className="inline-flex items-center gap-1.5 text-xs text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors mb-3">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to portal
            </Link>
            <div className="flex items-center gap-4">
              <div className="shrink-0 bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-2 border border-primary-foreground/10">
                <img src={config.logo_white_url || logoFallback} alt={config.dealership_name || "Dealership"} className="h-12 w-auto" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-extrabold text-xl lg:text-2xl tracking-tight font-display">
                  {firstName ? `${firstName}, Your Offer is Ready` : "Your Offer is Ready"}
                </h1>
                <p className="text-sm text-primary-foreground/60 mt-0.5">
                  {vehicleStr && <span className="font-medium text-primary-foreground/80">{vehicleStr}</span>}
                  {vehicleStr && " · "}Personalized just for you
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP: Two-column layout ─── */}
      <div className="hidden lg:block print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-5 gap-8">
            {/* Left column — vehicle image + offer (sticky) */}
            <div className="col-span-2">
              <div className="sticky top-6 space-y-5">
                {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="overflow-hidden -mx-2 mb-2"
                  >
                    <VehicleImage
                      year={s.vehicle_year}
                      make={s.vehicle_make}
                      model={s.vehicle_model}
                      selectedColor={s.exterior_color || ""}
                    />
                  </motion.div>
                )}

                {/* Premium Offer Card */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="relative bg-card rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)] space-y-5 border border-border/30 overflow-hidden"
                >
                  {/* Decorative corner accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                  {TabSwitcher}
                  {OfferDisplay}
                  {TradeInBounce}
                  {GuaranteeBadge}
                  {AcceptButton}
                </motion.div>

                {/* Trust Signals */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="grid grid-cols-3 gap-2"
                >
                  {[
                    { icon: Zap, label: "Fast Payment", sub: "Same-day available" },
                    { icon: Handshake, label: "No Haggling", sub: "Price is final" },
                    { icon: BadgeCheck, label: "Guaranteed", sub: "Locked price" },
                  ].map(item => (
                    <div key={item.label} className="flex flex-col items-center text-center bg-card/60 backdrop-blur-sm rounded-2xl p-3 border border-border/20 shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center mb-1.5">
                        <item.icon className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-[11px] font-bold text-card-foreground leading-tight">{item.label}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{item.sub}</p>
                    </div>
                  ))}
                </motion.div>

                <div className="flex gap-3 print:hidden">
                  <Button variant="outline" className="flex-1 gap-2 rounded-xl h-10 text-xs font-semibold" onClick={handlePrint}>
                    <Printer className="w-3.5 h-3.5" />
                    Print Offer
                  </Button>
                </div>
              </div>
            </div>

            {/* Right column — vehicle summary → trade-in → condition */}
            <div className="col-span-3 space-y-6">
              {VehicleSummary}
              {TradeInExplanation}
              {NoTaxBlock}
              {ConditionBlock}

              {!s.vin && (
                <div className="bg-warning/8 border border-warning/20 rounded-2xl p-4 text-center">
                  <p className="text-xs font-bold text-warning">No VIN on File</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    This offer was generated without a VIN and is subject to vehicle verification. Final offer may change upon VIN confirmation and in-person inspection.
                  </p>
                </div>
              )}
              <p className="text-center text-[11px] text-muted-foreground/60 flex items-center justify-center gap-2">
                <InspectionDisclosure /> <span className="text-muted-foreground/30">|</span> <Shield className="w-3 h-3" /> Your information is kept secure
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE: Single-column layout ─── */}
      <div className="lg:hidden print:hidden">
        {/* Premium Floating Sticky Value Box — collapses on scroll */}
        <div className={`sticky top-0 z-30 backdrop-blur-xl border-b shadow-[0_4px_24px_rgba(0,0,0,0.06)] print:static print:shadow-none transition-all duration-300 ${
          stickyCompact ? "bg-card/98 border-border/30" : "bg-card/95 border-border/20"
        }`}>
          <div className="max-w-lg mx-auto px-5 py-3 space-y-2.5">
            {!stickyCompact && TabSwitcher}
            {OfferDisplay}
            {!stickyCompact && TradeInBounce}
            {!stickyCompact && GuaranteeBadge}
            {AcceptButton}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
          {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="overflow-hidden -mx-2 mb-2"
            >
              <VehicleImage
                year={s.vehicle_year}
                make={s.vehicle_make}
                model={s.vehicle_model}
                selectedColor={s.exterior_color || ""}
              />
            </motion.div>
          )}

          {/* Mobile Trust Signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-2"
          >
            {[
              { icon: Zap, label: "Fast Payment" },
              { icon: Handshake, label: "No Haggling" },
              { icon: BadgeCheck, label: "Guaranteed" },
            ].map(item => (
              <div key={item.label} className="flex flex-col items-center text-center bg-card/60 rounded-2xl p-2.5 border border-border/15 shadow-sm">
                <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center mb-1">
                  <item.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-[10px] font-bold text-card-foreground leading-tight">{item.label}</p>
              </div>
            ))}
          </motion.div>

          {VehicleSummary}
          {TradeInExplanation}
          {NoTaxBlock}
          {ConditionBlock}

          <div className="flex gap-3 print:hidden">
            <Button variant="outline" className="flex-1 gap-2 rounded-xl h-10 text-xs font-semibold" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" />
              Print Offer
            </Button>
          </div>
          <div className="print:hidden">
            <Link to={`/my-submission/${token}`}>
              <Button variant="default" className="w-full gap-2 rounded-xl h-11 font-semibold">
                <ArrowLeft className="w-4 h-4" />
                Back to Portal
              </Button>
            </Link>
          </div>

          {!s.vin && (
            <div className="bg-warning/8 border border-warning/20 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-warning">No VIN on File</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                This offer was generated without a VIN. Final offer may change upon VIN confirmation and in-person inspection.
              </p>
            </div>
          )}
          <p className="text-center text-[11px] text-muted-foreground/60 flex items-center justify-center gap-2">
            <InspectionDisclosure /> <span className="text-muted-foreground/30">|</span> <Shield className="w-3 h-3" /> Your info is kept secure
          </p>
        </div>
      </div>
      {/* Contact Info Gate Dialog — Premium */}
      <Dialog open={showContactGate} onOpenChange={setShowContactGate}>
        <DialogContent className="max-w-md rounded-2xl border-border/30 shadow-[0_8px_48px_rgba(0,0,0,0.12)] p-0 overflow-hidden">
          {/* Premium header */}
          <div className="bg-gradient-to-r from-primary/8 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b border-border/20">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              Almost There!
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1.5">
              Enter your details to lock in your <span className="font-bold text-success">${cashOffer.toLocaleString()}</span> offer.
            </p>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-3.5">
            {[
              { label: "Full Name", placeholder: "John Smith", field: "name" as const, type: "text" },
              { label: "Email Address", placeholder: "john@example.com", field: "email" as const, type: "email" },
              { label: "Cell Phone", placeholder: "(203) 555-1234", field: "phone" as const, type: "tel" },
              { label: "Zip Code", placeholder: "06516", field: "zip" as const, type: "text" },
            ].map(item => (
              <div key={item.field}>
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{item.label} *</Label>
                <Input
                  type={item.type}
                  placeholder={item.placeholder}
                  value={contactForm[item.field]}
                  onChange={e => setContactForm(prev => ({ ...prev, [item.field]: e.target.value }))}
                  className={`mt-1.5 h-11 rounded-xl border-border/40 focus:border-primary/40 text-sm ${contactErrors[item.field] ? "border-destructive" : ""}`}
                  maxLength={item.field === "zip" ? 10 : undefined}
                />
                {contactErrors[item.field] && <p className="text-[11px] text-destructive mt-1 font-medium">{contactErrors[item.field]}</p>}
              </div>
            ))}

            {/* Trust signals inside dialog */}
            <div className="flex items-center justify-center gap-4 py-2 text-[10px] text-muted-foreground/50">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure</span>
              <span className="flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> No spam</span>
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Instant</span>
            </div>

            <p className="text-[9px] text-muted-foreground/40 leading-relaxed text-center">
              By submitting, you consent to receive calls, texts, and emails regarding your vehicle offer.
            </p>

            <Button
              onClick={handleContactSubmit}
              disabled={contactSaving}
              className="relative w-full py-5 text-base font-extrabold gap-2.5 rounded-2xl overflow-hidden group"
              style={{ backgroundColor: "hsl(var(--cta-accept))", boxShadow: "0 8px 24px hsl(var(--cta-accept) / 0.25)" }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {contactSaving ? "Saving..." : (
                <>
                  <CheckCircle className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">Accept & Lock In My Price</span>
                  <ArrowRight className="w-5 h-5 relative z-10" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfferPage;
