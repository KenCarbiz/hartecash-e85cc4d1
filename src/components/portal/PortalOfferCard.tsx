import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DollarSign, TrendingUp, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { getTaxRateFromZip, calcTradeInValue, STATE_NAMES } from "@/lib/salesTax";
import AcceptedOfferCard from "@/components/portal/AcceptedOfferCard";

interface PortalOfferCardProps {
  offeredPrice: number | null;
  estimatedOfferLow: number | null;
  estimatedOfferHigh: number | null;
  zip: string | null;
  vehicleStr: string;
  token: string;
  createdAt: string | null;
  guaranteeDays: number;
}

const PortalOfferCard = ({
  offeredPrice,
  estimatedOfferLow,
  estimatedOfferHigh,
  zip,
  vehicleStr,
  token,
}: PortalOfferCardProps) => {
  const [activeTab, setActiveTab] = useState<"sell" | "trade">("sell");

  const hasOffer = !!offeredPrice || !!estimatedOfferHigh;
  if (!hasOffer) return null;

  const isAccepted = !!offeredPrice;
  const cashOffer = offeredPrice || estimatedOfferHigh || 0;
  const estimateLow = estimatedOfferLow || 0;
  const isEstimate = !offeredPrice && !!estimatedOfferHigh;

  const { state, rate: taxRate } = getTaxRateFromZip(zip || "");
  const stateName = state ? STATE_NAMES[state] || state : null;
  const taxPercent = (taxRate * 100).toFixed(2);
  const taxSavings = cashOffer * taxRate;
  const tradeInValue = calcTradeInValue(cashOffer, taxRate);
  const tradeInValueLow = isEstimate ? calcTradeInValue(estimateLow, taxRate) : tradeInValue;

  // Accepted: simple green card
  if (isAccepted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Link to={`/offer/${token}`}>
          <div className="relative overflow-hidden bg-gradient-to-r from-success to-success/80 rounded-2xl p-6 shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-0.5 transition-all">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle className="w-4 h-4 text-white/80" />
                  <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">
                    Accepted Offer
                  </p>
                </div>
                <p className="text-3xl md:text-4xl font-extrabold text-white">
                  ${offeredPrice!.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-white/70 text-sm mt-1">Tap to view full offer details →</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // Not accepted: sell/trade tab switcher with range
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card rounded-2xl shadow-xl overflow-hidden"
    >
      {/* Tab Switcher */}
      <div className="p-4 pb-0">
        <div className="relative flex bg-muted/60 rounded-2xl p-1 border border-border/50">
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
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3 px-4 rounded-xl transition-colors duration-200 ${
              activeTab === "sell"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-card-foreground"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Cash Offer
          </button>
          <button
            onClick={() => setActiveTab("trade")}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 text-sm font-bold py-3 px-4 rounded-xl transition-colors duration-200 ${
              activeTab === "trade"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-card-foreground"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Trade-In Value
          </button>
        </div>
      </div>

      {/* Offer Display */}
      <div className="p-5">
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
                Estimated Cash Offer
              </p>
              <p className="text-3xl md:text-4xl font-extrabold text-accent tracking-tight">
                ${estimateLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Preliminary estimate • Final offer after review
              </p>
              {taxRate > 0 && (
                <button
                  onClick={() => setActiveTab("trade")}
                  className="mt-2 mx-auto flex items-center gap-1.5 text-xs font-medium text-success hover:text-success/80 transition-colors"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Worth ${tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} as a trade-in
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="trade"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-center mb-4">
                <p className="text-xs text-muted-foreground mb-1">
                  Estimated Trade-In Total Value
                </p>
                <p className="text-3xl md:text-4xl font-extrabold text-success tracking-tight">
                  ${tradeInValueLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – ${tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Includes ${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sales tax credit
                </p>
              </div>

              {/* Trade-in breakdown */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cash offer</span>
                  <span className="font-semibold">
                    ${estimateLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – ${cashOffer.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {stateName} tax rate
                  </span>
                  <span className="font-semibold">{taxPercent}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tax credit savings</span>
                  <span className="font-semibold text-success">+${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="font-bold text-card-foreground">Total trade-in value</span>
                  <span className="font-extrabold text-success">
                    ${tradeInValueLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – ${tradeInValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Accept button */}
        <Link to={`/offer/${token}`}>
          <Button className="w-full py-5 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 gap-2 rounded-xl mt-4">
            <CheckCircle className="w-5 h-5" />
            Accept & Lock In Your Price
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>

        {/* Link to full offer page */}
        <Link
          to={`/offer/${token}`}
          className="mt-3 block text-center text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          View full offer details →
        </Link>
      </div>
    </motion.div>
  );
};

export default PortalOfferCard;
