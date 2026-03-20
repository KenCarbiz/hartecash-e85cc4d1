import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Car, CheckCircle, Circle, Clock,
  DollarSign, Inbox, Search, BadgeDollarSign, CalendarCheck,
  ClipboardCheck, Handshake, PartyPopper, type LucideIcon
} from "lucide-react";
import harteLogo from "@/assets/harte-logo.png";
import { motion } from "framer-motion";
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
}

interface StageInfo {
  label: string;
  icon: LucideIcon;
  helperText: string;
}

const STAGE_CONFIG: Record<string, StageInfo> = {
  new: { label: "Submission Received", icon: Inbox, helperText: "We've received your vehicle info and our team will begin reviewing it shortly." },
  contacted: { label: "Under Review", icon: Search, helperText: "Our team is evaluating your vehicle details. We'll be in touch soon!" },
  offer_made: { label: "Initial Offer", icon: BadgeDollarSign, helperText: "We've prepared a cash offer for your vehicle. Check it out above!" },
  inspection_scheduled: { label: "Inspection Scheduled", icon: CalendarCheck, helperText: "Your in-person inspection is booked. Bring your vehicle and we'll take a look!" },
  inspection_completed: { label: "Inspection Complete", icon: ClipboardCheck, helperText: "We've inspected your vehicle and are finalizing the details." },
  price_agreed: { label: "Final Offer Accepted", icon: Handshake, helperText: "We've agreed on a price! We're preparing everything for the purchase." },
  purchase_complete: { label: "Purchase Complete 🎉", icon: PartyPopper, helperText: "Congratulations! The deal is done. Thank you for choosing Harte Auto Group!" },
};

const STAGE_MAPPING: Record<string, string> = {
  title_verified: "inspection_completed",
  ownership_verified: "inspection_completed",
  appraisal_completed: "inspection_completed",
  manager_approval: "inspection_completed",
  dead_lead: "new",
};

const CUSTOMER_VISIBLE_STAGES = [
  "new", "contacted", "offer_made", "inspection_scheduled", "inspection_completed",
  "price_agreed", "purchase_complete",
];

const LOAN_STATUS_LABELS: Record<string, string> = {
  "paid_off": "Paid Off",
  "has_loan": "Has Loan",
  "sell": "Looking to Sell",
  "trade": "Looking to Trade",
  "lease": "Lease",
};

const CustomerPortal = () => {
  const { token } = useParams<{ token: string }>();
  const [submission, setSubmission] = useState<PortalSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const minDelay = new Promise(r => setTimeout(r, 1200));
      const fetchData = supabase.rpc("get_submission_portal", { _token: token });
      const [, { data, error: err }] = await Promise.all([minDelay, fetchData]);
      if (err || !data || data.length === 0) setError("Submission not found. Please check your link.");
      else setSubmission(data[0] as PortalSubmission);
      setLoading(false);
    };
    fetch();
  }, [token]);

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
  if (mappedStatus === "contacted" && s.offered_price) {
    mappedStatus = "offer_made";
  }
  const currentStageIdx = CUSTOMER_VISIBLE_STAGES.indexOf(mappedStatus);
  const isComplete = mappedStatus === "purchase_complete";

  /* ─── Shared blocks ─── */

  const OfferCTA = (s.offered_price || s.estimated_offer_high) && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Link to={`/offer/${s.token}`}>
        <div className="relative overflow-hidden bg-gradient-to-r from-accent to-[hsl(210,100%,45%)] rounded-2xl p-6 shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-0.5 transition-all">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-accent-foreground/80 text-xs font-semibold uppercase tracking-wider mb-1">
                {s.offered_price ? "Your Cash Offer" : "Your Estimated Offer"}
              </p>
              <p className="text-3xl md:text-4xl font-extrabold text-accent-foreground">
                {s.offered_price
                  ? `$${s.offered_price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                  : `$${s.estimated_offer_low?.toLocaleString('en-US', { maximumFractionDigits: 0 })} – $${s.estimated_offer_high?.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                }
              </p>
              <p className="text-accent-foreground/70 text-sm mt-1">
                Tap to see your full offer with trade-in value →
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <DollarSign className="w-7 h-7 text-accent-foreground" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );

  const ProgressTracker = (
    <div className="bg-card rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-card-foreground">Your Progress</h3>
      </div>
      <div className="relative pl-6">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
        <motion.div
          className="absolute left-[11px] top-2 w-0.5 bg-success"
          initial={{ height: 0 }}
          animate={{ height: currentStageIdx >= 0 ? `${Math.min((currentStageIdx / (CUSTOMER_VISIBLE_STAGES.length - 1)) * 100, 100)}%` : "0%" }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
        />
        {CUSTOMER_VISIBLE_STAGES.map((stage, i) => {
          const isStageComplete = currentStageIdx > i || isComplete;
          const isCurrent = currentStageIdx === i && !isComplete;
          const config = STAGE_CONFIG[stage];
          const StageIcon = config?.icon || Circle;
          return (
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className="relative flex items-start gap-3 py-2.5"
            >
              <div className="absolute -left-6 flex items-center justify-center mt-0.5">
                {isStageComplete ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08 + 0.2, type: "spring" }}>
                    <CheckCircle className="w-6 h-6 text-success" />
                  </motion.div>
                ) : isCurrent ? (
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                      <StageIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="absolute inset-0 rounded-full animate-ping bg-accent/30" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center">
                    <StageIcon className="w-3.5 h-3.5 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div>
                <span className={`text-sm ${isCurrent ? "font-bold text-card-foreground" : isStageComplete ? "text-card-foreground" : "text-muted-foreground/60"}`}>
                  {config?.label || stage}
                </span>
                {isCurrent && config?.helperText && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                    className="text-xs text-muted-foreground mt-0.5 leading-relaxed"
                  >
                    {config.helperText}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const VehicleDetails = (vehicleStr || s.mileage || s.exterior_color || s.overall_condition || s.loan_status) && (
    <div className="bg-card rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Car className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-card-foreground">Vehicle Details</h3>
      </div>
      <div className="space-y-1 text-sm">
        {vehicleStr && <div className="flex justify-between"><span className="text-muted-foreground">Vehicle</span><span className="font-medium">{vehicleStr}</span></div>}
        {s.mileage && <div className="flex justify-between"><span className="text-muted-foreground">Mileage</span><span className="font-medium">{s.mileage}</span></div>}
        {s.exterior_color && <div className="flex justify-between"><span className="text-muted-foreground">Color</span><span className="font-medium">{s.exterior_color}</span></div>}
        {s.overall_condition && <div className="flex justify-between"><span className="text-muted-foreground">Condition</span><span className="font-medium capitalize">{s.overall_condition}</span></div>}
        {s.loan_status && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loan</span>
            <span className="font-medium">{LOAN_STATUS_LABELS[s.loan_status] || s.loan_status}</span>
          </div>
        )}
      </div>
    </div>
  );

  const ScheduleVisitCTA = currentStageIdx >= CUSTOMER_VISIBLE_STAGES.indexOf("offer_made") && !isComplete && (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Link to={`/schedule?token=${s.token}&vehicle=${encodeURIComponent(vehicleStr)}&name=${encodeURIComponent(s.name || "")}&email=${encodeURIComponent(s.email || "")}&phone=${encodeURIComponent(s.phone || "")}`}>
        <Button className="w-full gap-2 text-base py-6 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg">
          <CalendarCheck className="w-5 h-5" />
          Schedule Your Visit
        </Button>
      </Link>
      <p className="text-xs text-muted-foreground text-center mt-1.5">
        Estimated visit: 15–25 minutes • Book your appointment now
      </p>
    </motion.div>
  );

  const SubmittedFooter = (
    <p className="text-center text-xs text-muted-foreground">
      Submitted {new Date(s.created_at).toLocaleDateString()} • 🔒 Your information is kept secure
    </p>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-[hsl(210,100%,30%)] to-primary text-primary-foreground px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <Link to="/my-submission" className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to my submissions
          </Link>
          <div className="flex items-center gap-3">
            <img src={harteLogo} alt="Harte" className="h-12 w-auto" />
            <div className="flex-1">
              <h1 className="font-bold text-lg lg:text-xl">{vehicleStr || "My Submission"}</h1>
              {firstName && (
                <p className="text-sm opacity-80">Welcome back, {firstName}!</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP: Two-column layout ─── */}
      <div className="hidden lg:block">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-5 gap-8">
            {/* Left column — sticky: offer, progress, vehicle info, dealer */}
            <div className="col-span-2">
              <div className="sticky top-6 space-y-5">
                {OfferCTA}
                {ProgressTracker}
                {VehicleDetails}
                <DealerContactCard />
                {SubmittedFooter}
              </div>
            </div>

            {/* Right column — actions, content, FAQ */}
            <div className="col-span-3 space-y-5">
              <WhatsNextCard
                mappedStatus={mappedStatus}
                photosUploaded={s.photos_uploaded}
                docsUploaded={s.docs_uploaded}
                token={s.token}
                vehicleStr={vehicleStr}
                name={s.name || ""}
                email={s.email || ""}
                phone={s.phone || ""}
              />

              <CompletionChecklist
                photosUploaded={s.photos_uploaded}
                docsUploaded={s.docs_uploaded}
                token={s.token}
              />

              <VehiclePhotos token={s.token} photosUploaded={s.photos_uploaded} />

              <PaymentInfoCard />

              {s.loan_status && ["has_loan", "lease"].includes(s.loan_status) && (
                <LoanPayoffCard />
              )}

              {currentStageIdx >= CUSTOMER_VISIBLE_STAGES.indexOf("offer_made") && !isComplete && (
                <WhatToBringCard />
              )}

              {ScheduleVisitCTA}

              <PortalFAQ />

              <CommunicationPreferences token={s.token} email={s.email} phone={s.phone} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE: Single-column layout (original) ─── */}
      <div className="lg:hidden">
        <div className="max-w-lg mx-auto p-6 space-y-5">
          <WhatsNextCard
            mappedStatus={mappedStatus}
            photosUploaded={s.photos_uploaded}
            docsUploaded={s.docs_uploaded}
            token={s.token}
            vehicleStr={vehicleStr}
            name={s.name || ""}
            email={s.email || ""}
            phone={s.phone || ""}
          />

          {OfferCTA}

          <CompletionChecklist
            photosUploaded={s.photos_uploaded}
            docsUploaded={s.docs_uploaded}
            token={s.token}
          />

          {ProgressTracker}

          <VehiclePhotos token={s.token} photosUploaded={s.photos_uploaded} />

          {VehicleDetails}

          <PaymentInfoCard />

          {s.loan_status && ["has_loan", "lease"].includes(s.loan_status) && (
            <LoanPayoffCard />
          )}

          {currentStageIdx >= CUSTOMER_VISIBLE_STAGES.indexOf("offer_made") && !isComplete && (
            <WhatToBringCard />
          )}

          {ScheduleVisitCTA}

          <PortalFAQ />

          <DealerContactCard />

          {SubmittedFooter}
        </div>
      </div>
    </div>
  );
};

export default CustomerPortal;
