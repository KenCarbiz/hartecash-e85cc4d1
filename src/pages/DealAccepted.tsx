import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { Camera, FileText, CalendarCheck, ArrowRight, Zap, Clock, CheckCircle, Sparkles, ShieldCheck, ArrowLeft, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import VehicleImage from "@/components/sell-form/VehicleImage";
import WhatToExpect from "@/components/portal/WhatToExpect";
import InspectionDisclosure from "@/components/portal/InspectionDisclosure";
import harteLogoFallback from "@/assets/harte-logo-white.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { getTaxRateFromZip, calcTradeInValue } from "@/lib/salesTax";

interface DealSubmission {
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
  zip: string | null;
  token: string;
  created_at: string | null;
}

const DealAccepted = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [submission, setSubmission] = useState<DealSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const { config } = useSiteConfig();

  // Confetti celebration on mount
  useEffect(() => {
    const duration = 2500;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#10b981", "#0056a0", "#e63946"] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#10b981", "#0056a0", "#e63946"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) { setLoading(false); return; }
      
      // Mark the offer as accepted (updates status to 'contacted')
      await supabase.rpc("accept_offer", { _token: token });
      
      const { data } = await supabase.rpc("get_submission_portal", { _token: token });
      if (data && data.length > 0) {
        setSubmission(data[0] as unknown as DealSubmission);
      }
      setLoading(false);
    };
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Not Found</h1>
          <p className="text-muted-foreground">We couldn't find this submission.</p>
        </div>
      </div>
    );
  }

  const s = submission;
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
  const firstName = s.name?.split(" ")[0] || "";
  const cashOffer = s.offered_price || s.estimated_offer_high || 0;
  const estimateLow = s.estimated_offer_low || 0;
  const isEstimate = !s.offered_price && !!s.estimated_offer_high;

  const guaranteeDays = config.price_guarantee_days || 8;
  const createdDate = s.created_at ? new Date(s.created_at) : null;
  const expiresDate = createdDate ? new Date(createdDate.getTime() + guaranteeDays * 24 * 60 * 60 * 1000) : null;
  const daysRemaining = expiresDate ? Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  const scheduleLink = `/schedule?token=${token}&vehicle=${encodeURIComponent(vehicleStr)}&name=${encodeURIComponent(s.name || "")}&email=${encodeURIComponent(s.email || "")}&phone=${encodeURIComponent(s.phone || "")}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-[hsl(210,100%,30%)] to-primary text-primary-foreground px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <Link to={`/offer/${token}`} className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to offer
          </Link>
          <div className="flex items-center gap-3">
            <img src={config.logo_white_url || harteLogoFallback} alt={config.dealership_name || "Dealership"} className="h-10 w-auto" />
            <div className="flex-1">
              <h1 className="font-bold text-lg lg:text-xl">Deal Accepted!</h1>
              {firstName && <p className="text-sm opacity-80">{firstName}, your price is locked in</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Success banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-success/10 border-b border-success/20"
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="font-bold text-card-foreground text-sm">Your offer is locked in!</p>
            <p className="text-xs text-muted-foreground">
              {daysRemaining > 0
                ? `Price guaranteed for ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} — a team member will be reaching out shortly.`
                : "A team member will be reaching out shortly."
              }
            </p>
          </div>
          {daysRemaining > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-success/10 text-success text-xs font-semibold px-3 py-1.5 rounded-full ml-auto shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
            </div>
          )}
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Vehicle + offer recap */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-card rounded-xl p-6 shadow-lg mb-8 flex flex-col md:flex-row items-center gap-6"
        >
          {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
            <div className="w-full md:w-64 shrink-0">
              <VehicleImage
                year={s.vehicle_year}
                make={s.vehicle_make}
                model={s.vehicle_model}
                selectedColor={s.exterior_color || ""}
                compact
              />
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
              {isEstimate ? "Estimated Offer" : "Your Locked-In Price"}
            </p>
            <p className="text-3xl md:text-4xl font-extrabold text-accent tracking-tight">
              {isEstimate
                ? `$${estimateLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – $${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                : `$${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            </p>
            <p className="font-semibold text-card-foreground mt-1">{vehicleStr}</p>
            {s.mileage && (
              <p className="text-sm text-muted-foreground">{Number(s.mileage).toLocaleString()} miles · {s.overall_condition || "—"} condition</p>
            )}
          </div>
        </motion.div>

        {/* Two action cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Left: Schedule Inspection */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-5"
          >
            <div className="bg-card rounded-xl p-6 shadow-lg border-2 border-primary/20 h-auto">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-card-foreground">Schedule Your Inspection</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Book a convenient time to bring your {vehicleStr || "vehicle"} in. The whole process takes about 15–20 minutes — drive in, get inspected, get paid.
              </p>

              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  15–20 minutes
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                  Get paid same day
                </span>
              </div>

              <Link to={scheduleLink}>
                <Button className="w-full mt-5 py-5 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-2">
                  <CalendarCheck className="w-5 h-5" />
                  Schedule Inspection
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>

            {/* What to Expect — directly below schedule */}
            <WhatToExpect />
          </motion.div>

          {/* Right: Fast Track */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="bg-gradient-to-br from-accent/5 via-accent/3 to-transparent rounded-xl p-6 shadow-lg border-2 border-accent/20 h-full">
              <div className="flex items-center gap-2 mb-1">
                <div className="inline-flex items-center gap-1.5 bg-accent/10 text-accent text-xs font-semibold px-3 py-1 rounded-full">
                  <Zap className="w-3.5 h-3.5" />
                  Optional
                </div>
              </div>
              <h3 className="font-bold text-card-foreground text-lg mt-3">Fast-Track Your Deal</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Upload photos and documents now to speed up your appointment. Less time at the dealership, faster payment.
              </p>

              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-success" />
                  Faster processing
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                  Less time at visit
                </span>
              </div>

              <div className="space-y-3 mt-5">
                <Link
                  to={`/upload/${token}`}
                  className="flex items-center gap-3 p-4 rounded-lg bg-card hover:bg-muted/50 transition-colors border border-border"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-card-foreground">Upload Vehicle Photos</p>
                    <p className="text-xs text-muted-foreground">Exterior, interior & odometer shots</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>

                <Link
                  to={`/docs/${token}`}
                  className="flex items-center gap-3 p-4 rounded-lg bg-card hover:bg-muted/50 transition-colors border border-border"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-card-foreground">Upload Documents</p>
                    <p className="text-xs text-muted-foreground">Title, registration & license</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>

              {/* Upside note */}
              <div className="flex items-start gap-2 mt-5 pt-4 border-t border-border/50">
                <Sparkles className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Vehicles that arrive in better-than-reported condition may qualify for a higher offer at inspection.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          <InspectionDisclosure /> • 🔒 Your information is kept secure
        </p>
      </div>
    </div>
  );
};

export default DealAccepted;
