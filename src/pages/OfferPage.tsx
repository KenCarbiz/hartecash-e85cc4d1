import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, ArrowDown, TrendingUp, ShieldCheck, Info, Printer, CheckCircle, AlertTriangle, Search, Camera, FileText, ArrowRight, QrCode, Zap, Clock, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import harteLogo from "@/assets/harte-logo-white.png";
import PortalSkeleton from "@/components/PortalSkeleton";
import CalculatingOffer from "@/components/CalculatingOffer";
import { getTaxRateFromZip, calcTradeInValue, STATE_NAMES } from "@/lib/salesTax";
import VehicleImage from "@/components/sell-form/VehicleImage";
import { useSiteConfig } from "@/hooks/useSiteConfig";

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
}

const OfferPage = () => {
  const { token } = useParams<{ token: string }>();
  const [submission, setSubmission] = useState<OfferSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"sell" | "trade">("sell");
  const [condition, setCondition] = useState<ConditionDetails | null>(null);
  const [calculatingDone, setCalculatingDone] = useState(false);
  const { config } = useSiteConfig();

  const explanationRef = useRef<HTMLDivElement>(null);

  const handleCalculatingComplete = useCallback(() => {
    setCalculatingDone(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const { data, error: err } = await supabase.rpc("get_submission_portal", { _token: token });
      if (err || !data || data.length === 0) { setError("Offer not found."); setLoading(false); return; }
      const sub = data[0] as unknown as OfferSubmission;
      setSubmission(sub);
      setLoading(false);

      const { data: condData } = await supabase
        .from("submissions")
        .select("accidents, drivable, exterior_damage, interior_damage, mechanical_issues, engine_issues, tech_issues, smoked_in, tires_replaced, num_keys, windshield_damage, modifications")
        .eq("token", token)
        .maybeSingle();
      if (condData) setCondition(condData as ConditionDetails);
    };
    fetchData();
  }, [token]);

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

  const handlePrint = () => {
    window.print();
  };

  /* ─── Shared sub-components rendered inline ─── */

  const TabSwitcher = (
    <div className="flex gap-1 bg-muted rounded-lg p-1 print:hidden">
      <button
        onClick={() => setActiveTab("sell")}
        className={`flex-1 text-sm font-semibold py-2 px-3 rounded-md transition-all ${
          activeTab === "sell"
            ? "bg-card text-card-foreground shadow-sm"
            : "text-muted-foreground hover:text-card-foreground"
        }`}
      >
        Sell to Us
      </button>
      <button
        onClick={scrollToExplanation}
        className={`flex-1 text-sm font-semibold py-2 px-3 rounded-md transition-all ${
          activeTab === "trade"
            ? "bg-card text-card-foreground shadow-sm"
            : "text-muted-foreground hover:text-card-foreground"
        }`}
      >
        Trade-In Value
      </button>
    </div>
  );

  const OfferDisplay = (
    <AnimatePresence mode="wait">
      {activeTab === "sell" ? (
        <motion.div
          key="sell"
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
              ${estimateLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
          key="trade"
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
              ${tradeInValueLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – ${tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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

  /* Condition details */
  const ConditionBlock = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-card rounded-xl p-5 shadow-lg"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Search className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-card-foreground">What's Behind Your Offer</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        We combine what you told us about your {vehicleStr || "vehicle"} with market data, service history records, 
        and condition details to create a fair cash offer just for you.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Left: Key details */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Key Details</p>
          {s.vin && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-mono text-xs">VIN</span>
              <span className="font-medium text-xs">{s.vin.slice(-6).toUpperCase()}</span>
            </div>
          )}
          {s.overall_condition && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              <span className="capitalize">{s.overall_condition} condition</span>
            </div>
          )}
          {s.mileage && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              <span>{Number(s.mileage).toLocaleString()} miles</span>
            </div>
          )}
          {condition?.accidents && (
            <div className="flex items-center gap-2 text-sm">
              {condition.accidents.toLowerCase().includes("no") ? (
                <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span>{condition.accidents}</span>
            </div>
          )}
          {condition?.num_keys && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              <span>{condition.num_keys} keys</span>
            </div>
          )}
          {condition?.smoked_in && (
            <div className="flex items-center gap-2 text-sm">
              {condition.smoked_in.toLowerCase() === "no" ? (
                <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span>{condition.smoked_in === "No" ? "Non-smoker" : "Smoked in"}</span>
            </div>
          )}
        </div>

        {/* Right: Condition factors */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Condition</p>
          {(!condition?.exterior_damage || condition.exterior_damage.length === 0) ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              <span>No exterior damage</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="capitalize">{condition.exterior_damage.join(", ")}</span>
            </div>
          )}
          {(!condition?.interior_damage || condition.interior_damage.length === 0) ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              <span>No interior damage</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="capitalize">{condition.interior_damage.join(", ")}</span>
            </div>
          )}
          {(!condition?.mechanical_issues || condition.mechanical_issues.length === 0) ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              <span>No mechanical issues</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="capitalize">{condition.mechanical_issues.join(", ")}</span>
            </div>
          )}
          {condition?.windshield_damage && (
            <div className="flex items-center gap-2 text-sm">
              {condition.windshield_damage.toLowerCase().includes("none") ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>No windshield damage</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{condition.windshield_damage}</span>
                </>
              )}
            </div>
          )}
          {condition?.modifications && condition.modifications.toLowerCase() !== "none" && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Modified</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
        We use the details you provided along with market analytics to create your offer.
      </p>
    </motion.div>
  );

  /* Trade-in explanation */
  const TradeInExplanation = taxRate > 0 && (
    <div ref={explanationRef} className="scroll-mt-40">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="bg-card rounded-xl p-5 shadow-lg border-2 border-success/20"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <h3 className="font-bold text-card-foreground">Trade-In Tax Credit Explained</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          When you trade in your vehicle toward a new or pre-owned purchase at Harte Auto Group, 
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
            Actual tax may vary. Applies when used as trade-in on a new or pre-owned vehicle purchase.
          </p>
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

  /* Accept CTA */
  const AcceptCTA = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-br from-accent/10 via-accent/5 to-transparent border-2 border-accent/30 rounded-xl p-6 print:hidden"
    >
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-1.5 bg-accent/10 text-accent text-xs font-semibold px-3 py-1 rounded-full mb-2">
          <Zap className="w-3.5 h-3.5" />
          Fast-Track Your Deal
        </div>
        <h3 className="font-bold text-lg text-card-foreground mb-1">Ready to Lock In Your Price?</h3>
        <p className="text-sm text-muted-foreground">
          Upload photos and documents now to speed up your appointment and get paid faster.
        </p>
      </div>

      {/* Speed benefits */}
      <div className="flex items-center gap-4 justify-center mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-success" />
          Faster processing
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5 text-success" />
          Less time at visit
        </span>
      </div>

      <div className="space-y-2.5 mb-5">
        <Link
          to={`/upload/${token}`}
          className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors border border-border"
        >
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <Camera className="w-4.5 h-4.5 text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-card-foreground">Upload Vehicle Photos</p>
            <p className="text-xs text-muted-foreground">Exterior, interior & odometer shots</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>

        <Link
          to={`/docs/${token}`}
          className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors border border-border"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-card-foreground">Upload Documents</p>
            <p className="text-xs text-muted-foreground">Title, registration & license</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      </div>

      <Link to={`/upload/${token}`}>
        <Button className="w-full py-5 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 gap-2">
          Accept & Continue <ArrowRight className="w-5 h-5" />
        </Button>
      </Link>

      {/* Subtle inspection upside note */}
      <div className="flex items-start gap-2 mt-4 pt-3 border-t border-border/50">
        <Sparkles className="w-4 h-4 text-success shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vehicles that arrive in better-than-reported condition at final inspection may qualify for a higher offer.
        </p>
      </div>
    </motion.div>
  );

  /* Print QR section */
  const PrintQR = (
    <div className="hidden print:block border-2 border-border rounded-xl p-6 mt-4">
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg text-foreground">Continue Your Process Online</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Scan a QR code below with your phone to upload photos or documents and lock in your offer.
        </p>
      </div>
      <div className="flex justify-center gap-12">
        <div className="flex flex-col items-center gap-2">
          <QRCodeSVG value={`${window.location.origin}/upload/${token}`} size={120} level="M" />
          <div className="flex items-center gap-1.5 mt-1">
            <Camera className="w-4 h-4" />
            <span className="text-sm font-semibold">Upload Photos</span>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-[140px]">Exterior, interior & odometer</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <QRCodeSVG value={`${window.location.origin}/docs/${token}`} size={120} level="M" />
          <div className="flex items-center gap-1.5 mt-1">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-semibold">Upload Documents</span>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-[140px]">Title, registration & license</p>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
        Or visit: {window.location.origin}/offer/{token}
      </p>
    </div>
  );

  return (
    <div className="print-native min-h-screen bg-background print:bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-[hsl(210,100%,30%)] to-primary text-primary-foreground px-6 py-5 print:py-3">
        <div className="max-w-5xl mx-auto">
          <Link to={`/my-submission/${token}`} className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5 print:hidden">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to portal
          </Link>
          <div className="flex items-center gap-3">
            <img src={harteLogo} alt="Harte Auto Group" className="h-10 w-auto" />
            <div className="flex-1">
              <h1 className="font-bold text-lg lg:text-xl">Your Offer</h1>
              {firstName && <p className="text-sm opacity-80">{firstName}, here's your personalized offer</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP: Two-column layout ─── */}
      <div className="hidden lg:block">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-5 gap-8">
            {/* Left column — vehicle + offer (sticky) */}
            <div className="col-span-2">
              <div className="sticky top-6 space-y-5">
                {/* Vehicle Image */}
                {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
                  <VehicleImage
                    year={s.vehicle_year}
                    make={s.vehicle_make}
                    model={s.vehicle_model}
                    selectedColor={s.exterior_color || ""}
                    compact
                  />
                )}

                {/* Offer card */}
                <div className="bg-card rounded-xl p-6 shadow-lg space-y-4">
                  {TabSwitcher}
                  {OfferDisplay}
                  {TradeInBounce}
                </div>

                {/* Vehicle Summary */}
                <div className="bg-card rounded-xl p-5 shadow-lg">
                  <h3 className="font-bold text-card-foreground text-sm mb-3">Vehicle Summary</h3>
                  <div className="space-y-1.5 text-sm">
                    {vehicleStr && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vehicle</span>
                        <span className="font-semibold">{vehicleStr}</span>
                      </div>
                    )}
                    {s.mileage && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mileage</span>
                        <span className="font-medium">{s.mileage}</span>
                      </div>
                    )}
                    {s.exterior_color && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Color</span>
                        <span className="font-medium">{s.exterior_color}</span>
                      </div>
                    )}
                    {s.overall_condition && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Condition</span>
                        <span className="font-medium capitalize">{s.overall_condition}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Print / Actions */}
                <div className="flex gap-3 print:hidden">
                  <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
                    <Printer className="w-4 h-4" />
                    Print Offer
                  </Button>
                  <Link to={`/my-submission/${token}`} className="flex-1">
                    <Button variant="default" className="w-full gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      Back to Portal
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Right column — details + CTA */}
            <div className="col-span-3 space-y-5">
              {ConditionBlock}
              {TradeInExplanation}
              {NoTaxBlock}
              {AcceptCTA}
              <p className="text-center text-xs text-muted-foreground">
                Offer valid subject to in-person inspection • 🔒 Your information is kept secure
              </p>
            </div>
          </div>
        </div>
        {PrintQR}
      </div>

      {/* ─── MOBILE: Single-column layout (original) ─── */}
      <div className="lg:hidden">
        {/* Floating Sticky Value Box */}
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border shadow-lg print:static print:shadow-none">
          <div className="max-w-lg mx-auto px-6 py-4">
            <div className="mb-3">{TabSwitcher}</div>
            {OfferDisplay}
            {TradeInBounce}
          </div>
        </div>

        <div className="max-w-lg mx-auto p-6 space-y-5">
          {/* Vehicle Image */}
          {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
            <VehicleImage
              year={s.vehicle_year}
              make={s.vehicle_make}
              model={s.vehicle_model}
              selectedColor={s.exterior_color || ""}
              compact
            />
          )}

          {/* Vehicle Summary */}
          <div className="bg-card rounded-xl p-5 shadow-lg">
            <h3 className="font-bold text-card-foreground text-sm mb-3">Vehicle Summary</h3>
            <div className="space-y-1.5 text-sm">
              {vehicleStr && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle</span>
                  <span className="font-semibold">{vehicleStr}</span>
                </div>
              )}
              {s.mileage && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mileage</span>
                  <span className="font-medium">{s.mileage}</span>
                </div>
              )}
              {s.exterior_color && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Color</span>
                  <span className="font-medium">{s.exterior_color}</span>
                </div>
              )}
              {s.overall_condition && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Condition</span>
                  <span className="font-medium capitalize">{s.overall_condition}</span>
                </div>
              )}
            </div>
          </div>

          {ConditionBlock}
          {TradeInExplanation}
          {NoTaxBlock}
          {AcceptCTA}

          {/* Print / Actions */}
          <div className="flex gap-3 print:hidden">
            <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Print Offer
            </Button>
            <Link to={`/my-submission/${token}`} className="flex-1">
              <Button variant="default" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Portal
              </Button>
            </Link>
          </div>

          {PrintQR}

          <p className="text-center text-xs text-muted-foreground">
            Offer valid subject to in-person inspection • 🔒 Your information is kept secure
          </p>
        </div>
      </div>
    </div>
  );
};

export default OfferPage;
