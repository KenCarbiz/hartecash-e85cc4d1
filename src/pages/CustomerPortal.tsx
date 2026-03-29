import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import harteLogoFallback from "@/assets/harte-logo.png";
import harteLogoWhiteFallback from "@/assets/harte-logo-white.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import PortalSkeleton from "@/components/PortalSkeleton";
import WhatsNextCard from "@/components/portal/WhatsNextCard";
import VehiclePhotos from "@/components/portal/VehiclePhotos";
import CompletionChecklist from "@/components/portal/CompletionChecklist";
import DealerContactCard from "@/components/portal/DealerContactCard";
import WhatToBringCard from "@/components/portal/WhatToBringCard";
import PortalFAQ from "@/components/portal/PortalFAQ";
import PaymentInfoCard from "@/components/portal/PaymentInfoCard";
import LoanPayoffCard from "@/components/portal/LoanPayoffCard";
import CommunicationPreferences from "@/components/portal/CommunicationPreferences";
import InspectionDisclosure from "@/components/portal/InspectionDisclosure";
import WhatToExpect from "@/components/portal/WhatToExpect";

import ProgressSteps, { mapStatusToStepIndex } from "@/components/portal/ProgressSteps";
import PortalOfferCard from "@/components/portal/PortalOfferCard";
import PortalVehicleSummary from "@/components/portal/PortalVehicleSummary";
import { recalculateFromSubmission, type SubmissionCondition } from "@/lib/recalculateOffer";
import type { OfferSettings, OfferRule } from "@/lib/offerCalculator";
import { resolveEffectiveSettings } from "@/lib/resolvePricingModel";
import { useToast } from "@/hooks/use-toast";

interface ConditionData {
  drivetrain: string | null;
  accidents: string | null;
  exterior_damage: string[] | null;
  interior_damage: string[] | null;
  mechanical_issues: string[] | null;
  engine_issues: string[] | null;
  tech_issues: string[] | null;
  windshield_damage: string | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  drivable: string | null;
}

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
  acv_value: number | null;
  photos_uploaded: boolean;
  docs_uploaded: boolean;
  created_at: string;
  loan_status: string | null;
  token: string;
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  bb_tradein_avg: number | null;
  appointment_set: boolean;
  zip: string | null;
  vin: string | null;
  brake_lf: number | null;
  brake_rf: number | null;
  brake_lr: number | null;
  brake_rr: number | null;
  tire_lf: number | null;
  tire_rf: number | null;
  tire_lr: number | null;
  tire_rr: number | null;
  inspector_grade: string | null;
}

const STAGE_MAPPING: Record<string, string> = {
  title_verified: "inspection_completed",
  ownership_verified: "inspection_completed",
  appraisal_completed: "inspection_completed",
  manager_approval: "inspection_completed",
  dead_lead: "new",
};

const ACCEPTED_PORTAL_STATUSES = new Set([
  "contacted",
  "offer_made",
  "offer_accepted",
  "inspection_scheduled",
  "inspection_completed",
  "deal_finalized",
  "title_ownership_verified",
  "check_request_submitted",
  "purchase_complete",
]);

const CustomerPortal = () => {
  const { token } = useParams<{ token: string }>();
  const { config } = useSiteConfig();
  const { toast } = useToast();
  const [submission, setSubmission] = useState<PortalSubmission | null>(null);
  const [condition, setCondition] = useState<ConditionData | null>(null);
  const [offerSettings, setOfferSettings] = useState<OfferSettings | null>(null);
  const [offerRules, setOfferRules] = useState<OfferRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const minDelay = new Promise(r => setTimeout(r, 1200));
      const query = supabase.rpc("get_submission_portal", { _token: token });
      const [, { data, error: err }] = await Promise.all([minDelay, query]);
      if (err || !data || data.length === 0) { setError("Submission not found. Please check your link."); setLoading(false); return; }
      setSubmission(data[0] as unknown as PortalSubmission);
      setLoading(false);

      // Fetch condition + offer config for mileage recalculation
      const [condRes, pricingRes] = await Promise.all([
        supabase
          .from("submissions")
          .select("drivetrain, accidents, drivable, exterior_damage, interior_damage, mechanical_issues, engine_issues, tech_issues, smoked_in, tires_replaced, num_keys, windshield_damage")
          .eq("token", token)
          .maybeSingle(),
        resolveEffectiveSettings("default"),
      ]);
      if (condRes.data) setCondition(condRes.data as ConditionData);
      if (pricingRes.settings) setOfferSettings(pricingRes.settings);
      if (pricingRes.rules) setOfferRules(pricingRes.rules);
    };
    fetchData();
  }, [token]);

  /* ─── Mileage update handler ─── */
  const handleMileageUpdate = async (newMileage: string) => {
    if (!submission || !condition) return;

    const newSubmission = { ...submission, mileage: newMileage };

    // Recalculate offer if we have bb data and no manual offered_price
    if (submission.bb_tradein_avg && !submission.offered_price) {
      const subCond: SubmissionCondition = {
        overall_condition: submission.overall_condition,
        mileage: newMileage,
        vehicle_year: submission.vehicle_year,
        vehicle_make: submission.vehicle_make,
        vehicle_model: submission.vehicle_model,
        accidents: condition.accidents,
        exterior_damage: condition.exterior_damage,
        interior_damage: condition.interior_damage,
        mechanical_issues: condition.mechanical_issues,
        engine_issues: condition.engine_issues,
        tech_issues: condition.tech_issues,
        windshield_damage: condition.windshield_damage,
        smoked_in: condition.smoked_in,
        tires_replaced: condition.tires_replaced,
        num_keys: condition.num_keys,
        drivable: condition.drivable,
      };

      const newEstimate = recalculateFromSubmission(
        submission.bb_tradein_avg,
        subCond,
        offerSettings,
        offerRules
      );

      if (newEstimate) {
        newSubmission.estimated_offer_low = newEstimate.low;
        newSubmission.estimated_offer_high = newEstimate.high;
      }
    }

    setSubmission(newSubmission);

    // Save to database
    try {
      const updateData: Record<string, any> = { mileage: newMileage };
      if (newSubmission.estimated_offer_low !== submission.estimated_offer_low ||
          newSubmission.estimated_offer_high !== submission.estimated_offer_high) {
        updateData.estimated_offer_low = newSubmission.estimated_offer_low;
        updateData.estimated_offer_high = newSubmission.estimated_offer_high;
      }

      await supabase
        .from("submissions")
        .update(updateData as any)
        .eq("token", token!);

      toast({ title: "Mileage updated", description: "Your offer has been recalculated." });
    } catch {
      toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
    }
  };

  if (loading) return <PortalSkeleton />;

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Oops!</h1>
        <p className="text-muted-foreground">{error}</p>
        <Link to="/my-submission" className="text-accent underline mt-4 inline-block text-sm">
          Try looking up your submission
        </Link>
      </div>
    </div>
  );

  if (!submission) return null;

  const s = submission;
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
  const firstName = s.name?.split(" ")[0] || "";
  let mappedStatus = STAGE_MAPPING[s.progress_status] || s.progress_status;
  if (mappedStatus === "contacted" && s.offered_price) mappedStatus = "offer_made";
  const stepIdx = mapStatusToStepIndex(mappedStatus);
  const isComplete = mappedStatus === "purchase_complete";
  const isOfferAccepted = ACCEPTED_PORTAL_STATUSES.has(s.progress_status) || !!s.offered_price;

  // Mileage editable only when no manual offered price is set and offer hasn't been accepted yet
  const canEditMileage = !isOfferAccepted && !s.offered_price && !!s.bb_tradein_avg;

  const scheduleLink = `/schedule?token=${s.token}&vehicle=${encodeURIComponent(vehicleStr)}&name=${encodeURIComponent(s.name || "")}&email=${encodeURIComponent(s.email || "")}&phone=${encodeURIComponent(s.phone || "")}`;

  const SubmittedFooter = (
    <p className="text-center text-xs text-muted-foreground">
      Submitted {new Date(s.created_at).toLocaleDateString()} •{" "}
      <InspectionDisclosure /> •{" "}
      🔒 Your information is kept secure
    </p>
  );

  const checklistProps = {
    photosUploaded: s.photos_uploaded,
    docsUploaded: s.docs_uploaded,
    appointmentSet: s.appointment_set,
    token: s.token,
    scheduleLink,
  };

  const whatsNextProps = {
    mappedStatus,
    photosUploaded: s.photos_uploaded,
    docsUploaded: s.docs_uploaded,
    appointmentSet: s.appointment_set,
    token: s.token,
    vehicleStr,
    name: s.name || "",
    email: s.email || "",
    phone: s.phone || "",
  };

  const offerCardProps = {
    offeredPrice: s.offered_price,
    estimatedOfferLow: s.estimated_offer_low,
    estimatedOfferHigh: s.estimated_offer_high,
    zip: s.zip,
    vehicleStr,
    token: s.token,
    createdAt: s.created_at,
    guaranteeDays: config.price_guarantee_days || 8,
    isAccepted: isOfferAccepted,
  };

  const vehicleSummaryProps = {
    vehicleStr,
    vin: s.vin,
    mileage: s.mileage,
    exteriorColor: s.exterior_color,
    overallCondition: s.overall_condition,
    drivetrain: condition?.drivetrain || null,
    canEdit: canEditMileage,
    inspectorGrade: s.inspector_grade,
    brakeDepths: (s.brake_lf != null || s.brake_rf != null || s.brake_lr != null || s.brake_rr != null)
      ? { lf: s.brake_lf, rf: s.brake_rf, lr: s.brake_lr, rr: s.brake_rr }
      : null,
    tireDepths: (s.tire_lf != null || s.tire_rf != null || s.tire_lr != null || s.tire_rr != null)
      ? { lf: s.tire_lf, rf: s.tire_rf, lr: s.tire_lr, rr: s.tire_rr }
      : null,
    onFieldUpdate: canEditMileage
      ? (field: string, value: string) => {
          if (field === "mileage") handleMileageUpdate(value);
        }
      : undefined,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-[hsl(210,100%,30%)] to-primary text-primary-foreground px-6 py-1">
        <div className="max-w-5xl mx-auto">
          <Link to="/my-submission" className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to my submissions
          </Link>
          <div className="flex items-center gap-3">
            <img src={config.logo_white_url || harteLogoWhiteFallback} alt={config.dealership_name || "Dealership"} className="h-[70px] w-auto" />
            <div className="flex-1">
              <h1 className="font-bold text-lg lg:text-xl">{vehicleStr || "My Submission"}</h1>
              {firstName && <p className="text-sm opacity-80">Welcome back, {firstName}!</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-5xl mx-auto px-6 -mt-0 pt-5">
        <ProgressSteps currentStageIdx={stepIdx} isComplete={isComplete} appointmentSet={s.appointment_set} scheduleLink={scheduleLink} />
      </div>

      {/* ─── DESKTOP: Two-column layout ─── */}
      <div className="hidden lg:block">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="grid grid-cols-5 gap-8">
            {/* Left column — sticky */}
            <div className="col-span-2">
              <div className="sticky top-6 space-y-5">
                <PortalOfferCard {...offerCardProps} />
                <PortalVehicleSummary {...vehicleSummaryProps} />
                <DealerContactCard />
                <CommunicationPreferences token={s.token} email={s.email} phone={s.phone} />
              </div>
            </div>

            {/* Right column */}
            <div className="col-span-3 space-y-5">
              <WhatsNextCard {...whatsNextProps} />
              <CompletionChecklist {...checklistProps} />
              <VehiclePhotos token={s.token} photosUploaded={s.photos_uploaded} />
              <PaymentInfoCard />
              {s.loan_status && ["has_loan", "lease"].includes(s.loan_status) && <LoanPayoffCard />}
              {stepIdx >= 2 && !isComplete && (
                <>
                  <WhatToBringCard />
                  <WhatToExpect />
                </>
              )}
              <PortalFAQ />
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE: Single-column ─── */}
      <div className="lg:hidden">
        <div className="max-w-lg mx-auto p-6 space-y-5">
          <WhatsNextCard {...whatsNextProps} />
          <PortalOfferCard {...offerCardProps} />
          <CompletionChecklist {...checklistProps} />
          <VehiclePhotos token={s.token} photosUploaded={s.photos_uploaded} />
          
          <PortalVehicleSummary {...vehicleSummaryProps} />
          <PaymentInfoCard />
          {s.loan_status && ["has_loan", "lease"].includes(s.loan_status) && <LoanPayoffCard />}
          {stepIdx >= 2 && !isComplete && (
            <>
              <WhatToBringCard />
              <WhatToExpect />
            </>
          )}
          <PortalFAQ />
          <DealerContactCard />
          <CommunicationPreferences token={s.token} email={s.email} phone={s.phone} />
        </div>
      </div>

      {/* Full-width centered footer */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {SubmittedFooter}
      </div>
    </div>
  );
};

export default CustomerPortal;
