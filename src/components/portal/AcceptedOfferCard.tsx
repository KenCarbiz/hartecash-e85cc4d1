import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DollarSign, TrendingUp, CheckCircle, ShieldCheck, Clock, PartyPopper } from "lucide-react";
import { motion } from "framer-motion";
import { getTaxRateFromZip, calcTradeInValue, STATE_NAMES } from "@/lib/salesTax";

interface AcceptedOfferCardProps {
  offeredPrice: number;
  zip: string | null;
  vehicleStr: string;
  token: string;
  createdAt: string | null;
  guaranteeDays: number;
  /** Compact mode for portal sidebar */
  compact?: boolean;
}

function useCountdown(expiresDate: Date | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!expiresDate) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [expiresDate]);

  if (!expiresDate) return { days: 0, hours: 0, isExpired: true };
  const ms = expiresDate.getTime() - now;
  if (ms <= 0) return { days: 0, hours: 0, isExpired: true };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return { days, hours, isExpired: false };
}

const AcceptedOfferCard = ({
  offeredPrice,
  zip,
  vehicleStr,
  token,
  createdAt,
  guaranteeDays,
  compact = false,
}: AcceptedOfferCardProps) => {
  const { state, rate: taxRate } = getTaxRateFromZip(zip || "");
  const stateName = state ? STATE_NAMES[state] || state : null;
  const taxPercent = (taxRate * 100).toFixed(2);
  const taxSavings = offeredPrice * taxRate;
  const tradeInValue = calcTradeInValue(offeredPrice, taxRate);

  const expiresDate = createdAt
    ? new Date(new Date(createdAt).getTime() + guaranteeDays * 86_400_000)
    : null;
  const { days, hours, isExpired } = useCountdown(expiresDate);

  const hasTax = taxRate > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="relative overflow-hidden rounded-2xl shadow-xl bg-card border-2 border-success/30"
    >
      {/* Celebration header */}
      <div className="bg-gradient-to-r from-success via-success/90 to-success/80 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <PartyPopper className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Offer Accepted!</p>
            <p className="text-white/70 text-xs">Your price is locked in</p>
          </div>
          <CheckCircle className="w-5 h-5 text-white/80 ml-auto" />
        </div>
      </div>

      <div className={compact ? "p-4 space-y-4" : "p-5 space-y-5"}>
        {/* Cash offer — always shown */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            Accepted Cash Offer
          </div>
          <p className={`font-extrabold text-success tracking-tight ${compact ? "text-3xl" : "text-3xl md:text-4xl"}`}>
            ${offeredPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Trade-in section — shown when tax applies */}
        {hasTax && (
          <div className="bg-success/5 border border-success/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs font-bold text-success uppercase tracking-wider">Trade-In Total Value</span>
            </div>
            <p className={`font-extrabold text-success tracking-tight text-center ${compact ? "text-2xl" : "text-2xl md:text-3xl"}`}>
              ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>

            {/* Tax breakdown */}
            <div className="bg-card rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cash offer</span>
                <span className="font-semibold">
                  ${offeredPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                <span className="font-semibold text-success">
                  +${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="font-bold text-card-foreground">Total trade-in value</span>
                <span className="font-extrabold text-success">
                  ${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Countdown badge */}
        <div
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${
            isExpired
              ? "bg-destructive/10 text-destructive"
              : days <= 2
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-success/10 text-success"
          }`}
        >
          {isExpired ? (
            <>
              <Clock className="w-4 h-4" />
              <span>Price guarantee expired — contact us for renewal</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>
                {days > 0
                  ? `${days}d ${hours}h remaining`
                  : `${hours}h remaining`}
                {expiresDate && (
                  <span className="opacity-70">
                    {" "}· expires {expiresDate.toLocaleDateString()}
                  </span>
                )}
              </span>
            </>
          )}
        </div>

        {/* Link to full offer */}
        <Link
          to={`/offer/${token}`}
          className="block text-center text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          View full offer details →
        </Link>
      </div>
    </motion.div>
  );
};

export default AcceptedOfferCard;
