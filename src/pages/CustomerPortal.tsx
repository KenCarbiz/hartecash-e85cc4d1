import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Car, CheckCircle, Circle, Clock,
  DollarSign, Inbox, Search, BadgeDollarSign, CalendarCheck,
  ClipboardCheck, Handshake, PartyPopper, Printer, type LucideIcon
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

  const handlePrintOffer = () => {
    if (!submission || !submission.offered_price) return;
    const s = submission;
    const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;
    const html = `<!DOCTYPE html><html><head><title>Cash Offer</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Inter, -apple-system, sans-serif; color:#1a2a3a; background:white; }
      .header { background:#2a4365; color:white; padding:24px 32px; text-align:center; }
      .header h1 { font-size:22px; font-weight:700; }
      .content { padding:32px; max-width:600px; margin:0 auto; }
      .offer-box { border:3px solid #2a4365; border-radius:12px; padding:24px; text-align:center; margin:24px 0; }
      .offer-amount { font-size:36px; font-weight:800; color:#2a4365; }
      .detail { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e2e6ea; font-size:14px; }
      .detail:last-child { border-bottom:none; }
      .label { color:#6b7b8d; }
      .value { font-weight:600; }
      .footer { text-align:center; margin-top:32px; font-size:12px; color:#6b7b8d; }
      @page { margin:0.5in; }
    </style></head><body>
    <div class="header"><h1>Cash Offer for Your Vehicle</h1></div>
    <div class="content">
      <div class="offer-box">
        <p style="font-size:14px;color:#6b7b8d;margin-bottom:8px;">Our Cash Offer</p>
        <div class="offer-amount">$${s.offered_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div style="margin-bottom:24px;">
        <div class="detail"><span class="label">Vehicle</span><span class="value">${vehicleStr}</span></div>
        <div class="detail"><span class="label">Mileage</span><span class="value">${s.mileage || "N/A"}</span></div>
        <div class="detail"><span class="label">Color</span><span class="value">${s.exterior_color || "N/A"}</span></div>
        <div class="detail"><span class="label">Condition</span><span class="value">${s.overall_condition || "N/A"}</span></div>
        <div class="detail"><span class="label">Customer</span><span class="value">${s.name || "N/A"}</span></div>
        <div class="detail"><span class="label">Date</span><span class="value">${new Date().toLocaleDateString()}</span></div>
      </div>
      <div class="footer">
        <p>This offer is subject to in-person vehicle inspection and verification of condition.</p>
        <p style="margin-top:8px;">Harte Auto Group</p>
      </div>
    </div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 300);
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
  if (mappedStatus === "contacted" && s.offered_price) {
    mappedStatus = "offer_made";
  }
  const currentStageIdx = CUSTOMER_VISIBLE_STAGES.indexOf(mappedStatus);
  const isComplete = mappedStatus === "purchase_complete";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-[hsl(210,100%,30%)] to-primary text-primary-foreground px-6 py-5">
        <div className="max-w-lg mx-auto">
          <Link to="/my-submission" className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to my submissions
          </Link>
          <div className="flex items-center gap-3">
            <img src={harteLogo} alt="Harte" className="h-12 w-auto" />
            <div className="flex-1">
              <h1 className="font-bold text-lg">{vehicleStr || "My Submission"}</h1>
              {firstName && (
                <p className="text-sm opacity-80">Welcome back, {firstName}!</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-5">
        {/* What's Next */}
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

        {/* Offer Card */}
        {s.offered_price && (
          <div className="bg-card rounded-xl p-5 shadow-lg border-2 border-accent/30">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-card-foreground">Your Cash Offer</h3>
            </div>
            <p className="text-3xl font-extrabold text-accent">
              ${s.offered_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Subject to in-person inspection</p>
            <div className="flex gap-2 mt-3">
              <Link to={`/offer/${s.token}`}>
                <Button size="sm" className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                  View Full Offer
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handlePrintOffer}>
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
            </div>
          </div>
        )}

        {/* Completion Checklist (replaces Actions) */}
        <CompletionChecklist
          photosUploaded={s.photos_uploaded}
          docsUploaded={s.docs_uploaded}
          token={s.token}
        />

        {/* Progress */}
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

        {/* Vehicle Photos */}
        <VehiclePhotos token={s.token} photosUploaded={s.photos_uploaded} />

        {/* Vehicle Info - only show if there's actual data */}
        {(vehicleStr || s.mileage || s.exterior_color || s.overall_condition || s.loan_status) && (
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
        )}

        {/* Payment Info */}
        <PaymentInfoCard />

        {/* Loan Payoff Guidance - only show if user has a loan */}
        {s.loan_status && ["has_loan", "lease"].includes(s.loan_status) && (
          <LoanPayoffCard />
        )}

        {/* What to Bring */}
        {currentStageIdx >= CUSTOMER_VISIBLE_STAGES.indexOf("offer_made") && !isComplete && (
          <WhatToBringCard />
        )}

        {/* Schedule Visit CTA */}
        {currentStageIdx >= CUSTOMER_VISIBLE_STAGES.indexOf("offer_made") && !isComplete && (
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
        )}

        {/* Portal FAQ */}
        <PortalFAQ />

        {/* Dealer Contact */}
        <DealerContactCard />

        {/* Submitted Date */}
        <p className="text-center text-xs text-muted-foreground">
          Submitted {new Date(s.created_at).toLocaleDateString()} • 🔒 Your information is kept secure
        </p>
      </div>
    </div>
  );
};

export default CustomerPortal;
