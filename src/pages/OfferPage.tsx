import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, ArrowDown, TrendingUp, ShieldCheck, Info, Printer, CheckCircle, AlertTriangle, Search, ArrowRight, QrCode, Sparkles, ExternalLink, Car, Gauge, Palette, Wrench, Key, Wind, Cigarette, CircleDot, Settings2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import InspectionDisclosure from "@/components/portal/InspectionDisclosure";
import harteLogoFallback from "@/assets/harte-logo-white.png";
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
  created_at: string | null;
  loan_status: string | null;
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
        .select("accidents, drivable, exterior_damage, interior_damage, mechanical_issues, engine_issues, tech_issues, smoked_in, tires_replaced, num_keys, windshield_damage, modifications, drivetrain")
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

  const AcceptButton = (
    <div className="print:hidden space-y-2">
      <Link to={`/deal/${token}${activeTab === "trade" ? "?mode=trade" : ""}`}>
        <Button className="w-full py-5 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 gap-2 rounded-xl">
          <CheckCircle className="w-5 h-5" />
          Accept & Lock In Your Price
          <ArrowRight className="w-5 h-5" />
        </Button>
      </Link>
      <p className="text-[11px] text-muted-foreground text-center">
        Click to lock in your price · No obligation until inspection
      </p>
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

  /* ─── Vehicle Summary Card (improved) ─── */
  const VehicleSummary = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Vehicle Summary</h3>
        </div>
      </div>
      <div className="p-5">
        {/* Year Make Model — hero line */}
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
                <p className="text-sm font-medium font-mono">{s.vin.slice(-8).toUpperCase()}</p>
              </div>
            </div>
          )}
          {s.mileage && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mileage</p>
                <p className="text-sm font-medium">{Number(s.mileage).toLocaleString()} mi</p>
              </div>
            </div>
          )}
          {s.exterior_color && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Color</p>
                <p className="text-sm font-medium">{s.exterior_color}</p>
              </div>
            </div>
          )}
          {condition?.drivetrain && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Powertrain</p>
                <p className="text-sm font-medium capitalize">{condition.drivetrain}</p>
              </div>
            </div>
          )}
          {s.overall_condition && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Condition</p>
                <p className="text-sm font-medium capitalize">{s.overall_condition}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  /* ─── Condition / "What's Behind Your Offer" block (upgraded) ─── */
  const conditionItems: { label: string; status: "good" | "warn"; icon: React.ReactNode }[] = [];

  // Accidents
  const noAccidents = !condition?.accidents || condition.accidents.toLowerCase().includes("no") || condition.accidents.toLowerCase() === "none";
  conditionItems.push({
    label: noAccidents ? "No accidents reported" : condition!.accidents!,
    status: noAccidents ? "good" : "warn",
    icon: <Car className="w-3.5 h-3.5" />,
  });

  // Exterior damage
  const noExteriorDmg = !condition?.exterior_damage || condition.exterior_damage.length === 0;
  conditionItems.push({
    label: noExteriorDmg ? "No exterior damage" : `Exterior: ${condition!.exterior_damage!.join(", ")}`,
    status: noExteriorDmg ? "good" : "warn",
    icon: <Palette className="w-3.5 h-3.5" />,
  });

  // Interior damage
  const noInteriorDmg = !condition?.interior_damage || condition.interior_damage.length === 0;
  conditionItems.push({
    label: noInteriorDmg ? "No interior damage" : `Interior: ${condition!.interior_damage!.join(", ")}`,
    status: noInteriorDmg ? "good" : "warn",
    icon: <CircleDot className="w-3.5 h-3.5" />,
  });

  // Mechanical issues
  const noMechanical = !condition?.mechanical_issues || condition.mechanical_issues.length === 0;
  conditionItems.push({
    label: noMechanical ? "No mechanical issues" : `Mechanical: ${condition!.mechanical_issues!.join(", ")}`,
    status: noMechanical ? "good" : "warn",
    icon: <Wrench className="w-3.5 h-3.5" />,
  });

  // Engine issues
  const noEngine = !condition?.engine_issues || condition.engine_issues.length === 0;
  conditionItems.push({
    label: noEngine ? "No engine issues" : `Engine: ${condition!.engine_issues!.join(", ")}`,
    status: noEngine ? "good" : "warn",
    icon: <Settings2 className="w-3.5 h-3.5" />,
  });

  // Tech issues
  const noTech = !condition?.tech_issues || condition.tech_issues.length === 0;
  conditionItems.push({
    label: noTech ? "No technology issues" : `Tech: ${condition!.tech_issues!.join(", ")}`,
    status: noTech ? "good" : "warn",
    icon: <Search className="w-3.5 h-3.5" />,
  });

  // Windshield
  const noWindshield = !condition?.windshield_damage || condition.windshield_damage.toLowerCase().includes("none") || condition.windshield_damage.toLowerCase() === "no";
  if (condition?.windshield_damage) {
    conditionItems.push({
      label: noWindshield ? "No windshield damage" : `Windshield: ${condition.windshield_damage}`,
      status: noWindshield ? "good" : "warn",
      icon: <Wind className="w-3.5 h-3.5" />,
    });
  }

  // Smoked in
  const notSmokedIn = !condition?.smoked_in || condition.smoked_in.toLowerCase() === "no";
  if (condition?.smoked_in) {
    conditionItems.push({
      label: notSmokedIn ? "Non-smoker vehicle" : "Smoked in vehicle",
      status: notSmokedIn ? "good" : "warn",
      icon: <Cigarette className="w-3.5 h-3.5" />,
    });
  }

  // Keys
  if (condition?.num_keys) {
    conditionItems.push({
      label: `${condition.num_keys} key${condition.num_keys === "1" ? "" : "s"} available`,
      status: "good",
      icon: <Key className="w-3.5 h-3.5" />,
    });
  }

  // Modifications
  const noMods = !condition?.modifications || condition.modifications.toLowerCase() === "none" || condition.modifications.toLowerCase() === "no";
  if (condition?.modifications) {
    conditionItems.push({
      label: noMods ? "No aftermarket modifications" : `Modified: ${condition.modifications}`,
      status: noMods ? "good" : "warn",
      icon: <Settings2 className="w-3.5 h-3.5" />,
    });
  }

  const goodCount = conditionItems.filter(c => c.status === "good").length;
  const totalCount = conditionItems.length;

  const ConditionBlock = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header with score bar */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold text-card-foreground">What's Behind Your Offer</h3>
          </div>
          <span className="text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
            {goodCount}/{totalCount} clear
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We evaluated your {vehicleStr || "vehicle"} using market data, service records, and the condition details you provided.
        </p>
      </div>

      {/* Condition items grid */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {conditionItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                item.status === "good"
                  ? "bg-success/5 border border-success/15"
                  : "bg-amber-500/5 border border-amber-500/15"
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                item.status === "good" ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-600"
              }`}>
                {item.status === "good" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`shrink-0 ${item.status === "good" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                  {item.icon}
                </span>
                <span className={`text-sm capitalize truncate ${item.status === "good" ? "text-card-foreground" : "text-card-foreground"}`}>
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <p>Your offer is based on these factors combined with real-time market analytics. Final price confirmed at in-person inspection.</p>
        </div>
      </div>
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
        <h3 className="font-bold text-xl text-card-foreground mb-1">Ready to Lock In Your Price?</h3>
        <p className="text-sm text-muted-foreground">
          Accept your offer and we'll reach out to get everything set up.
        </p>
      </div>

      {daysRemaining > 0 && (
        <div className="flex items-center justify-center gap-2 mb-4 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>Price guaranteed for {daysRemaining} {daysRemaining === 1 ? "day" : "days"}</span>
        </div>
      )}

      <Link to={`/deal/${token}${activeTab === "trade" ? "?mode=trade" : ""}`}>
        <Button className="w-full py-5 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 gap-2">
          <CheckCircle className="w-5 h-5" />
          Accept & Lock In Your Price
          <ArrowRight className="w-5 h-5" />
        </Button>
      </Link>

      <div className="flex items-start gap-2 mt-4 pt-3 border-t border-border/50">
        <Sparkles className="w-4 h-4 text-success shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vehicles that arrive in better-than-reported condition at final inspection may qualify for a higher offer.
        </p>
      </div>
    </motion.div>
  );

  // Print layout values
  const isLeaseBuyout = s.loan_status === "Lease Buyout";
  const printIsTrade = activeTab === "trade";
  const printDisplayValue = printIsTrade ? tradeInValue : cashOffer;
  const printDisplayValueLow = printIsTrade ? tradeInValueLow : estimateLow;
  const printDisplayLabel = printIsTrade
    ? "Trade-In Total Value"
    : isLeaseBuyout
    ? "Lease Buyout Cash Offer"
    : "Cash Offer";

  const portalUrl = `${window.location.origin}/my-submission/${token}`;

  const PrintLayout = (
    <div className="hidden print:block print-offer-layout">
      {/* Premium Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b-[3px] border-primary">
        <div className="flex items-center gap-4">
          <img src={config.logo_url || config.logo_white_url || harteLogoFallback} alt={config.dealership_name || "Dealership"} className="h-11 w-auto brightness-0" />
          <div className="border-l-2 border-border pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Vehicle Purchase Program</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {createdDate?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Prepared for</p>
          <p className="text-base font-bold text-foreground">{s.name || "Customer"}</p>
        </div>
      </div>

      {/* Hero: Vehicle Image + Summary side by side */}
      <div className="grid grid-cols-2 gap-6 mb-5">
        {/* Vehicle Image */}
        <div>
          {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
            <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
              <VehicleImage
                year={s.vehicle_year}
                make={s.vehicle_make}
                model={s.vehicle_model}
                selectedColor={s.exterior_color || ""}
              />
            </div>
          )}
        </div>

        {/* Vehicle Summary + Offer */}
        <div className="space-y-3">
          <div>
            <p className="text-lg font-bold text-foreground">{vehicleStr}</p>
            {s.vin && (
              <p className="text-[10px] font-mono text-muted-foreground">VIN: {s.vin}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {s.mileage && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mileage</span>
                <span className="font-semibold">{Number(s.mileage).toLocaleString()} mi</span>
              </div>
            )}
            {s.exterior_color && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Color</span>
                <span className="font-semibold">{s.exterior_color}</span>
              </div>
            )}
            {condition?.drivetrain && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Powertrain</span>
                <span className="font-semibold capitalize">{condition.drivetrain}</span>
              </div>
            )}
            {s.overall_condition && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Condition</span>
                <span className="font-semibold capitalize">{s.overall_condition}</span>
              </div>
            )}
          </div>

          {/* Offer Card inline */}
          <div className="border-2 border-primary rounded-xl p-4 mt-2">
            <div className="flex justify-center mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] bg-primary/10 text-primary px-3 py-1 rounded-full">
                {printIsTrade ? "Trade-In Offer" : "Cash Offer"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground text-center mb-1">
              {isEstimate ? `Estimated ${printDisplayLabel}` : printDisplayLabel}
            </p>
            {isEstimate ? (
              <p className="text-2xl font-extrabold text-foreground tracking-tight text-center">
                ${printDisplayValueLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – ${printDisplayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            ) : (
              <p className="text-2xl font-extrabold text-foreground tracking-tight text-center">
                ${printDisplayValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {isEstimate ? "Preliminary estimate · Final offer after review" : "Subject to in-person inspection"}
            </p>
            {createdDate && !isExpired && (
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-2 pt-2 border-t border-border">
                <ShieldCheck className="w-3 h-3" />
                Price guaranteed for {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                {expiresDate && <span> · expires {expiresDate.toLocaleDateString()}</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Trade-in breakdown (if applicable) */}
      {printIsTrade && taxRate > 0 && (
        <div className="border border-border rounded-lg p-4 mb-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 pb-1.5 border-b border-border">Trade-In Tax Credit Breakdown</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cash offer value</span>
              <span className="font-medium">${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{stateName} tax credit ({taxPercent}%)</span>
              <span className="font-medium text-success">+${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-border font-bold">
              <span>Total Trade-In Value</span>
              <span>${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Condition Report — full-width, improved */}
      <div className="border border-border rounded-lg p-4 mb-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 pb-1.5 border-b border-border">Condition Report</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {conditionItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              {item.status === "good" ? (
                <CheckCircle className="w-3 h-3 text-success shrink-0" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
              )}
              <span className="capitalize">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What to Bring + QR */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-border rounded-lg p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 pb-1.5 border-b border-border">Bring to Your Visit</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />
              <span>Valid driver's license</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />
              <span>Vehicle title</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />
              <span>Current registration</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />
              <span>All vehicle keys</span>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-3 flex items-center gap-3">
          <QRCodeSVG value={portalUrl} size={60} level="M" />
          <div className="flex-1">
            <p className="text-[10px] font-bold text-foreground">Upload Photos</p>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Scan to upload photos & documents to fast-track your deal.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-primary/20 pt-2 flex items-center justify-between text-[9px] text-muted-foreground">
        <p className="font-medium">Offer valid subject to in-person inspection · {config.dealership_name || "Our Dealership"}</p>
        <p>{config.phone} · {config.address}</p>
      </div>
    </div>
  );

  return (
    <div className="print-native min-h-screen bg-background print:bg-white">
      {/* ─── PRINT-ONLY: Custom one-page layout ─── */}
      {PrintLayout}

      {/* Header */}
      <div className="print:hidden bg-gradient-to-r from-primary via-[hsl(210,100%,30%)] to-primary text-primary-foreground px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <Link to={`/my-submission/${token}`} className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5 print:hidden">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to portal
          </Link>
          <div className="flex items-center gap-3">
            <img src={config.logo_white_url || harteLogoFallback} alt={config.dealership_name || "Dealership"} className="h-10 w-auto" />
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
                {/* Vehicle Image */}
                {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
                  <div className="bg-card rounded-xl shadow-lg overflow-hidden">
                    <VehicleImage
                      year={s.vehicle_year}
                      make={s.vehicle_make}
                      model={s.vehicle_model}
                      selectedColor={s.exterior_color || ""}
                    />
                  </div>
                )}

                {/* Offer card */}
                <div className="bg-card rounded-xl p-6 shadow-lg space-y-5">
                  {TabSwitcher}
                  {OfferDisplay}
                  {TradeInBounce}
                  {GuaranteeBadge}
                  {AcceptButton}
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
        {/* Floating Sticky Value Box */}
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border shadow-lg print:static print:shadow-none">
          <div className="max-w-lg mx-auto px-6 py-4 space-y-3">
            {TabSwitcher}
            {OfferDisplay}
            {TradeInBounce}
            {GuaranteeBadge}
            {AcceptButton}
          </div>
        </div>

        <div className="max-w-lg mx-auto p-6 space-y-5">
          {/* Vehicle Image */}
          {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
            <div className="bg-card rounded-xl shadow-lg overflow-hidden">
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

          <p className="text-center text-xs text-muted-foreground">
            <InspectionDisclosure /> • 🔒 Your information is kept secure
          </p>
        </div>
      </div>
    </div>
  );
};

export default OfferPage;
