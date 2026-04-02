import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, ArrowDown, TrendingUp, ShieldCheck, Info, Printer, CheckCircle, ArrowRight, Car, Gauge, Palette, Settings2, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import InspectionDisclosure from "@/components/portal/InspectionDisclosure";
import harteLogoFallback from "@/assets/harte-logo-white.png";
import PortalSkeleton from "@/components/PortalSkeleton";
import CalculatingOffer from "@/components/CalculatingOffer";
import { getTaxRateFromZip, calcTradeInValue, STATE_NAMES } from "@/lib/salesTax";
import VehicleImage from "@/components/sell-form/VehicleImage";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { InlineEdit } from "@/components/offer/InlineEdit";
import OfferConditionBlock, { buildConditionItems } from "@/components/offer/OfferConditionBlock";
import OfferPrintLayout from "@/components/offer/OfferPrintLayout";
import { recalculateFromSubmission, type SubmissionCondition } from "@/lib/recalculateOffer";
import type { OfferSettings, OfferRule } from "@/lib/offerCalculator";
import { resolveEffectiveSettings } from "@/lib/resolvePricingModel";
import { useToast } from "@/hooks/use-toast";
import SlideToAccept from "@/components/SlideToAccept";


interface OfferSubmission {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  email: string | null;
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
}

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "rough", label: "Rough" },
];

const OfferPage = () => {
  const { token } = useParams<{ token: string }>();
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
      setSubmission(sub);
      setLoading(false);

      // Fetch condition details + offer config + appointment + locations in parallel
      const [condRes, pricingRes, apptRes, locRes] = await Promise.all([
        supabase
          .from("submissions")
          .select("accidents, drivable, exterior_damage, interior_damage, mechanical_issues, engine_issues, tech_issues, smoked_in, tires_replaced, num_keys, windshield_damage, modifications, drivetrain, bb_msrp, bb_class_name, bb_drivetrain, bb_transmission, bb_fuel_type, bb_engine, bb_mileage_adj, bb_regional_adj, bb_base_whole_avg, bb_retail_avg, bb_wholesale_avg, bb_tradein_avg")
          .eq("token", token)
          .maybeSingle(),
        resolveEffectiveSettings("default"),
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
      if (condRes.data) setCondition(condRes.data as ConditionDetails);
      if (pricingRes.settings) setOfferSettings(pricingRes.settings);
      if (pricingRes.rules) setOfferRules(pricingRes.rules);
      if (apptRes.data) setAppointment(apptRes.data as { preferred_date: string; preferred_time: string; store_location: string | null });
      if (locRes.data) setDealerLocations(locRes.data as any);
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

    // Recalculate offer if we have bb data and no manual offered_price
    if (submission.bb_tradein_avg && !submission.offered_price) {
      const subCond: SubmissionCondition = {
        overall_condition: field === "overall_condition" ? (value as string) : newSubmission.overall_condition,
        mileage: field === "mileage" ? (value as string) : newSubmission.mileage,
        vehicle_year: newSubmission.vehicle_year,
        vehicle_make: newSubmission.vehicle_make,
        vehicle_model: newSubmission.vehicle_model,
        accidents: field === "accidents" ? (value as string) : newCondition.accidents,
        exterior_damage: field === "exterior_damage" ? (value as string[]) : newCondition.exterior_damage,
        interior_damage: field === "interior_damage" ? (value as string[]) : newCondition.interior_damage,
        mechanical_issues: field === "mechanical_issues" ? (value as string[]) : newCondition.mechanical_issues,
        engine_issues: field === "engine_issues" ? (value as string[]) : newCondition.engine_issues,
        tech_issues: field === "tech_issues" ? (value as string[]) : newCondition.tech_issues,
        windshield_damage: field === "windshield_damage" ? (value as string) : newCondition.windshield_damage,
        smoked_in: field === "smoked_in" ? (value as string) : newCondition.smoked_in,
        tires_replaced: field === "tires_replaced" ? (value as string) : newCondition.tires_replaced,
        num_keys: field === "num_keys" ? (value as string) : newCondition.num_keys,
        drivable: field === "drivable" ? (value as string) : newCondition.drivable,
      };

      const bbVals = {
        bb_tradein_avg: newCondition.bb_tradein_avg ?? submission.bb_tradein_avg,
        bb_wholesale_avg: newCondition.bb_wholesale_avg ?? submission.bb_wholesale_avg,
        bb_retail_avg: newCondition.bb_retail_avg ?? submission.bb_retail_avg,
      };
      const newEstimate = recalculateFromSubmission(
        bbVals.bb_tradein_avg || 0,
        subCond,
        offerSettings,
        offerRules,
        bbVals
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
      if (field === "overall_condition" || field === "mileage" || field === "exterior_color") {
        updateData[field] = value;
      }
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
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Offer Not Available</h1>
        <p className="text-muted-foreground">{error || "No offer has been made yet."}</p>
        <Link to="/my-submission" className="text-accent underline mt-4 inline-block text-sm">
          Check your submission
        </Link>
      </div>
    </div>
  );

  const s = submission;
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
  const firstName = s.name?.split(" ")[0] || "";

  const hasOfferedPrice = !!s.offered_price;
  const ACCEPTED_STATUSES = ['contacted', 'inspection_scheduled', 'inspection_completed', 'appraisal_completed', 'manager_approval', 'price_agreed', 'docs_title', 'purchase_complete'];
  const isAccepted = hasOfferedPrice || (!!s.progress_status && ACCEPTED_STATUSES.includes(s.progress_status));
  const hasEstimate = !!s.estimated_offer_high;
  const cashOffer = s.offered_price || s.estimated_offer_high || 0;
  const estimateLow = s.estimated_offer_low || 0;
  const isEstimate = !hasOfferedPrice && hasEstimate;

  if (cashOffer <= 0) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Offer Not Available</h1>
        <p className="text-muted-foreground">No offer has been made yet.</p>
        <Link to="/my-submission" className="text-accent underline mt-4 inline-block text-sm">
          Check your submission
        </Link>
      </div>
    </div>
  );

  const { state, rate: taxRate } = getTaxRateFromZip(s.zip || "");
  const stateName = state ? STATE_NAMES[state] || state : null;
  const taxPercent = (taxRate * 100).toFixed(2);
  const taxSavings = cashOffer * taxRate;
  const tradeInValue = calcTradeInValue(cashOffer, taxRate);
  const tradeInValueLow = isEstimate ? calcTradeInValue(estimateLow, taxRate) : tradeInValue;

  // Can edit only if no manual offered_price has been set by dealer
  const canEdit = !hasOfferedPrice && !!s.bb_tradein_avg;

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
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold print:border print:border-border ${
        isExpired
          ? "bg-destructive/10 text-destructive"
          : isUrgent
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-success/10 text-success"
      }`}
    >
      <ShieldCheck className="w-4 h-4 shrink-0" />
      {isExpired ? (
        <span>Price guarantee expired — contact us for an updated offer</span>
      ) : (
        <span>
          Price guaranteed for {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
          {expiresDate && <span className="opacity-70"> · expires {expiresDate.toLocaleDateString()}</span>}
        </span>
      )}
    </motion.div>
  );

  const handlePrint = () => {
    window.print();
  };

  /* ─── Shared sub-components rendered inline ─── */

  const TabSwitcher = (
    <div className="relative flex bg-muted/60 rounded-2xl p-1 print:hidden border border-border/50">
      <motion.div
        className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20"
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          width: "calc(50% - 4px)",
          left: activeTab === "sell" ? "4px" : "calc(50% + 0px)",
        }}
      />
      <button
        onClick={() => setActiveTab("sell")}
        className={`relative z-10 flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3.5 px-4 rounded-xl transition-colors duration-200 ${
          activeTab === "sell"
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-card-foreground"
        }`}
      >
        <DollarSign className="w-4 h-4" />
        Cash Offer
      </button>
      <button
        onClick={scrollToExplanation}
        className={`relative z-10 flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3.5 px-4 rounded-xl transition-colors duration-200 ${
          activeTab === "trade"
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-card-foreground"
        }`}
      >
        <TrendingUp className="w-4 h-4" />
        Trade-In Value
      </button>
    </div>
  );

  const acceptUrl = `/deal/${token}${activeTab === "trade" ? "?mode=trade" : ""}`;

  const AcceptButton = (
    <div className="print:hidden space-y-2">
      {isAccepted ? (
        <div className="w-full py-3 flex items-center justify-center gap-2 rounded-xl bg-success text-white font-bold text-base">
          <CheckCircle className="w-5 h-5" />
          Offer Accepted
        </div>
      ) : (
        <>
          {/* Mobile: slide gesture */}
          <div className="lg:hidden">
            <SlideToAccept
              onAccept={() => { window.location.href = acceptUrl; }}
              label="Slide to Accept Your Price"
            />
          </div>
          {/* Desktop: click button */}
          <div className="hidden lg:block">
            <Link to={acceptUrl}>
              <Button className="w-full py-5 text-base font-bold text-white shadow-lg gap-2 rounded-xl" style={{ backgroundColor: "hsl(var(--cta-accept))", boxShadow: "0 10px 15px -3px hsl(var(--cta-accept) / 0.2)" }}>
                <CheckCircle className="w-5 h-5" />
                Accept & Lock In Your Price
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            No obligation until inspection
          </p>
        </>
      )}
    </div>
  );

  const OfferDisplay = (
    <AnimatePresence mode="wait">
      {activeTab === "sell" ? (
        <motion.div
          key={`sell-${cashOffer}-${estimateLow}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground mb-1">
            {isEstimate ? "Estimated Cash Offer" : "Cash Offer"} for Your {vehicleStr}
          </p>
           {isEstimate ? (
            <p className="text-4xl lg:text-5xl font-extrabold text-accent tracking-tight">
              ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          ) : (
            <p className="text-4xl lg:text-5xl font-extrabold text-accent tracking-tight">
              ${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {isEstimate ? "Preliminary estimate • Final offer after review" : "Subject to in-person inspection"}
          </p>
        </motion.div>
      ) : (
        <motion.div
          key={`trade-${tradeInValue}-${tradeInValueLow}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground mb-1">
            {isEstimate ? "Estimated Trade-In Total Value" : "Trade-In Total Value"}
          </p>
          {isEstimate ? (
            <p className="text-4xl lg:text-5xl font-extrabold text-success tracking-tight">
              ${tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          ) : (
            <p className="text-4xl lg:text-5xl font-extrabold text-success tracking-tight">
              ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Includes ${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sales tax credit
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const TradeInBounce = activeTab === "sell" && taxRate > 0 && (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      onClick={scrollToExplanation}
      className="mt-2 mx-auto flex items-center gap-1.5 text-xs font-medium text-success hover:text-success/80 transition-colors print:hidden"
    >
      <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
      Worth ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} as a trade-in
    </motion.button>
  );

  /* ─── Vehicle Summary Card (with inline edit) ─── */
  const VehicleSummary = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-card-foreground">Vehicle Summary</h3>
          </div>
          {canEdit && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Pencil className="w-3 h-3" /> Click to edit
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        {vehicleStr && (
          <p className="text-lg font-bold text-card-foreground mb-3">{vehicleStr}</p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {s.vin && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">VIN</span>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">VIN</p>
                <p className="text-sm font-medium font-mono">{s.vin.toUpperCase()}</p>
              </div>
            </div>
          )}
          {(s.mileage || canEdit) && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mileage</p>
                {canEdit ? (
                  <InlineEdit
                    value={s.mileage ? Number(s.mileage).toLocaleString() : "—"}
                    onSave={(val) => handleFieldUpdate("mileage", val.replace(/[^0-9]/g, ""))}
                    label="mileage"
                    className="text-sm font-medium"
                  />
                ) : (
                  <p className="text-sm font-medium">{Number(s.mileage).toLocaleString()} mi</p>
                )}
              </div>
            </div>
          )}
          {(s.exterior_color || canEdit) && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Color</p>
                {canEdit ? (
                  <InlineEdit
                    value={s.exterior_color || "—"}
                    onSave={(val) => handleFieldUpdate("exterior_color", val)}
                    label="color"
                    className="text-sm font-medium"
                  />
                ) : (
                  <p className="text-sm font-medium">{s.exterior_color}</p>
                )}
              </div>
            </div>
          )}
          {(condition?.drivetrain || canEdit) && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Powertrain</p>
                <p className="text-sm font-medium capitalize">{condition?.drivetrain || "—"}</p>
              </div>
            </div>
          )}
          {(s.overall_condition || canEdit) && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Condition</p>
                {canEdit ? (
                  <InlineEdit
                    value={s.overall_condition || "good"}
                    onSave={(val) => handleFieldUpdate("overall_condition", val)}
                    type="select"
                    options={CONDITION_OPTIONS}
                    label="condition"
                    className="text-sm font-medium capitalize"
                  />
                ) : (
                  <p className="text-sm font-medium capitalize">{s.overall_condition}</p>
                )}
              </div>
            </div>
          )}
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

  /* Trade-in explanation */
  const TradeInExplanation = taxRate > 0 && (
    <div ref={explanationRef} className="scroll-mt-40">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="bg-card rounded-xl shadow-lg overflow-hidden border-2 border-success/20"
      >
        <div className="bg-gradient-to-r from-success/5 to-success/10 px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <h3 className="font-bold text-card-foreground">Trade-In Tax Credit Explained</h3>
          </div>
        </div>

        <div className="p-5">

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          When you trade in your vehicle toward a new or pre-owned purchase at {config.dealership_name || "our dealership"}, 
          you receive a <span className="font-semibold text-card-foreground">sales tax credit</span> on 
          the value of your trade.
        </p>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Cash offer value</span>
            <span className="font-semibold">${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" />
              {stateName} sales tax rate
            </span>
            <span className="font-semibold">{taxPercent}%</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Sales tax credit savings</span>
            <span className="font-semibold text-success">+${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="font-bold text-card-foreground">Total trade-in value</span>
            <span className="font-extrabold text-lg text-success">
              ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <p>
            The tax credit is based on {stateName ? `${stateName}'s` : "your state's"} {taxPercent}% sales tax rate, 
            determined by your zip code ({s.zip}). The formula is: 
            <span className="font-mono text-card-foreground"> ${cashOffer.toLocaleString()} × {(1 + taxRate).toFixed(4)} = ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>. 
            Actual tax credit may vary and is subject to qualifications.
          </p>
        </div>
        </div>
      </motion.div>
    </div>
  );

  const NoTaxBlock = (!s.zip || taxRate === 0) && (
    <div className="bg-card rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-bold text-card-foreground text-sm">Trade-In Savings</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {!s.zip 
          ? "We don't have your zip code on file. Contact us to learn about sales tax savings when you trade in your vehicle."
          : `Your state (${stateName || state}) does not have a vehicle sales tax, so the trade-in value equals your cash offer.`
        }
      </p>
    </div>
  );





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
        logoFallback={harteLogoFallback}
        submission={s}
        condition={condition}
        vehicleStr={vehicleStr}
        createdDate={createdDate}
        isEstimate={isEstimate}
        isExpired={isExpired}
        daysRemaining={daysRemaining}
        expiresDate={expiresDate}
        activeTab={activeTab}
        cashOffer={cashOffer}
        estimateLow={estimateLow}
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

      {/* Header */}
      <div className="print:hidden bg-gradient-to-r from-primary via-[hsl(210,100%,30%)] to-primary text-primary-foreground px-6 py-1">
        <div className="max-w-5xl mx-auto">
          <Link to={`/my-submission/${token}`} className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5 print:hidden">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to portal
          </Link>
          <div className="flex items-center gap-3">
            <img src={config.logo_white_url || harteLogoFallback} alt={config.dealership_name || "Dealership"} className="h-[70px] w-auto" />
            <div className="flex-1">
              <h1 className="font-bold text-lg lg:text-xl">Your Offer</h1>
              {firstName && <p className="text-sm opacity-80">{firstName}, here's your personalized offer</p>}
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
                  <div className="overflow-hidden -mx-2 mb-2">
                    <VehicleImage
                      year={s.vehicle_year}
                      make={s.vehicle_make}
                      model={s.vehicle_model}
                      selectedColor={s.exterior_color || ""}
                    />
                  </div>
                )}

                <div className="bg-card rounded-xl p-6 shadow-lg space-y-5">
                  {TabSwitcher}
                  {OfferDisplay}
                  {TradeInBounce}
                  {GuaranteeBadge}
                  {AcceptButton}
                </div>

                <div className="flex gap-3 print:hidden">
                  <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
                    <Printer className="w-4 h-4" />
                    Print Offer
                  </Button>
                </div>
              </div>
            </div>

            {/* Right column — vehicle summary → trade-in → condition */}
            <div className="col-span-3 space-y-5">
              {VehicleSummary}
              {TradeInExplanation}
              {NoTaxBlock}
              {ConditionBlock}
              
              <p className="text-center text-xs text-muted-foreground">
                <InspectionDisclosure /> • 🔒 Your information is kept secure
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE: Single-column layout ─── */}
      <div className="lg:hidden print:hidden">
        {/* Floating Sticky Value Box — collapses on scroll */}
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border shadow-lg print:static print:shadow-none transition-all duration-300">
          <div className="max-w-lg mx-auto px-6 py-3 space-y-2">
            {!stickyCompact && TabSwitcher}
            {OfferDisplay}
            {!stickyCompact && TradeInBounce}
            {!stickyCompact && GuaranteeBadge}
            {AcceptButton}
          </div>
        </div>

        <div className="max-w-lg mx-auto p-6 space-y-5">
          {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
            <div className="overflow-hidden -mx-2 mb-2">
              <VehicleImage
                year={s.vehicle_year}
                make={s.vehicle_make}
                model={s.vehicle_model}
                selectedColor={s.exterior_color || ""}
              />
            </div>
          )}

          {VehicleSummary}
          {TradeInExplanation}
          {NoTaxBlock}
          {ConditionBlock}

          <div className="flex gap-3 print:hidden">
            <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Print Offer
            </Button>
          </div>
          <div className="print:hidden">
            <Link to={`/my-submission/${token}`}>
              <Button variant="default" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Portal
              </Button>
            </Link>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <InspectionDisclosure /> • 🔒 Your information is kept secure
          </p>
        </div>
      </div>
    </div>
  );
};

export default OfferPage;
