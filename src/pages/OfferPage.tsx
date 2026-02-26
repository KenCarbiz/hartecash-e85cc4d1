import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, ArrowDown, TrendingUp, ShieldCheck, Info, Printer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import harteLogo from "@/assets/harte-logo-white.png";
import PortalSkeleton from "@/components/PortalSkeleton";
import { getTaxRateFromZip, calcTradeInValue, STATE_NAMES } from "@/lib/salesTax";

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
  token: string;
  zip: string | null;
}

const OfferPage = () => {
  const { token } = useParams<{ token: string }>();
  const [submission, setSubmission] = useState<OfferSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"sell" | "trade">("sell");
  const explanationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const minDelay = new Promise(r => setTimeout(r, 1200));
      const query = supabase.rpc("get_submission_portal", { _token: token });
      const [, { data, error: err }] = await Promise.all([minDelay, query]);
      if (err || !data || data.length === 0) setError("Offer not found.");
      else setSubmission(data[0] as unknown as OfferSubmission);
      setLoading(false);
    };
    fetchData();
  }, [token]);

  const scrollToExplanation = () => {
    setActiveTab("trade");
    setTimeout(() => {
      explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  if (loading) return <PortalSkeleton />;

  if (error || !submission || !submission.offered_price) return (
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
  const cashOffer = s.offered_price;

  const { state, rate: taxRate } = getTaxRateFromZip(s.zip || "");
  const stateName = state ? STATE_NAMES[state] || state : null;
  const taxPercent = (taxRate * 100).toFixed(2);
  const taxSavings = cashOffer * taxRate;
  const tradeInValue = calcTradeInValue(cashOffer, taxRate);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-[hsl(210,100%,30%)] to-primary text-primary-foreground px-6 py-5 print:py-3">
        <div className="max-w-lg mx-auto">
          <Link to={`/my-submission/${token}`} className="inline-flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-1.5 print:hidden">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to portal
          </Link>
          <div className="flex items-center gap-3">
            <img src={harteLogo} alt="Harte Auto Group" className="h-10 w-auto" />
            <div className="flex-1">
              <h1 className="font-bold text-lg">Your Offer</h1>
              {firstName && <p className="text-sm opacity-80">{firstName}, here's your personalized offer</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Sticky Value Box */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border shadow-lg print:static print:shadow-none">
        <div className="max-w-lg mx-auto px-6 py-4">
          {/* Tab Switcher */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 mb-3 print:hidden">
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
                <p className="text-xs text-muted-foreground mb-1">Cash Offer for Your {vehicleStr}</p>
                <p className="text-4xl font-extrabold text-accent tracking-tight">
                  ${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Subject to in-person inspection</p>
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
                <p className="text-xs text-muted-foreground mb-1">Trade-In Total Value</p>
                <p className="text-4xl font-extrabold text-success tracking-tight">
                  ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Includes ${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sales tax credit
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === "sell" && taxRate > 0 && (
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
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-lg mx-auto p-6 space-y-5">

        {/* Vehicle Summary Card */}
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

        {/* Trade-In Explanation Section */}
        {taxRate > 0 && (
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
                the value of your trade. This means you save on the sales tax you'd otherwise pay on your new vehicle.
              </p>

              {/* Breakdown */}
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
        )}

        {/* No tax info available */}
        {(!s.zip || taxRate === 0) && (
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
        )}

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

        {/* Fine print */}
        <p className="text-center text-xs text-muted-foreground">
          Offer valid subject to in-person inspection • 🔒 Your information is kept secure
        </p>
      </div>
    </div>
  );
};

export default OfferPage;
