import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Shield, Clock, Users, FileText, DollarSign, ChevronDown, ChevronUp, Award } from "lucide-react";

interface CompetitorComparisonProps {
  cashOffer: number;
  wholesaleAvg: number | null;
  tradeinAvg: number | null;
  retailAvg: number | null;
  vehicleStr: string;
}

interface ValueTier {
  label: string;
  sublabel: string;
  value: number;
  color: string;
  bgColor: string;
  borderColor: string;
  badge?: string;
  hassle?: string;
}

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const CompetitorComparison = ({
  cashOffer,
  wholesaleAvg,
  tradeinAvg,
  retailAvg,
  vehicleStr,
}: CompetitorComparisonProps) => {
  const [expanded, setExpanded] = useState(false);

  // Don't render if we have no wholesale data
  if (!wholesaleAvg || wholesaleAvg <= 0) return null;

  // Build value tiers
  const instantOfferLow = Math.round(wholesaleAvg * 1.05);
  const instantOfferHigh = Math.round(wholesaleAvg * 1.10);
  const instantOfferMid = Math.round((instantOfferLow + instantOfferHigh) / 2);

  // Private sale estimate: use retail avg or estimate from trade-in
  const privateSaleEstimate = retailAvg && retailAvg > 0
    ? Math.round(retailAvg * 0.92) // Private sale typically ~92% of retail
    : tradeinAvg && tradeinAvg > 0
    ? Math.round(tradeinAvg * 1.15)
    : Math.round(cashOffer * 1.20);

  const tiers: ValueTier[] = [
    {
      label: "Wholesale (auction)",
      sublabel: "What dealers pay at auction",
      value: wholesaleAvg,
      color: "text-muted-foreground",
      bgColor: "bg-muted/60",
      borderColor: "border-border/40",
    },
    {
      label: "Instant offer sites",
      sublabel: "CarMax, Carvana, etc.",
      value: instantOfferMid,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/8",
      borderColor: "border-amber-500/20",
    },
    {
      label: "Our Offer",
      sublabel: "Sell to us today",
      value: cashOffer,
      color: "text-accent",
      bgColor: "bg-accent/8",
      borderColor: "border-accent/25",
      badge: "YOUR PRICE",
    },
    {
      label: "Private sale",
      sublabel: "Sell it yourself",
      value: privateSaleEstimate,
      color: "text-muted-foreground/70",
      bgColor: "bg-muted/30",
      borderColor: "border-border/20",
      hassle: "Weeks of waiting, strangers, risk",
    },
  ];

  // Calculate bar widths relative to the max value
  const maxValue = Math.max(...tiers.map(t => t.value));

  const whyBullets = [
    { icon: Users, text: "No strangers test-driving your car" },
    { icon: DollarSign, text: "Get paid today, not in weeks" },
    { icon: FileText, text: "No listing fees or marketplace commissions" },
    { icon: Shield, text: "We handle all the paperwork" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl overflow-hidden border border-border/30 shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
    >
      {/* Gradient header */}
      <div className="relative bg-gradient-to-br from-primary/8 via-accent/5 to-transparent px-5 py-4 border-b border-border/20 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/8 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="font-bold text-card-foreground text-sm">How Your Offer Compares</h3>
            <p className="text-[10px] text-muted-foreground/60">
              {vehicleStr} market positioning
            </p>
          </div>
        </div>
      </div>

      {/* Bar chart comparison */}
      <div className="p-5 space-y-3 bg-card">
        {tiers.map((tier, idx) => {
          const barWidth = Math.max(25, Math.round((tier.value / maxValue) * 100));
          const isOurOffer = !!tier.badge;

          return (
            <motion.div
              key={tier.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.3 + idx * 0.08 }}
              className={`rounded-xl p-3 border transition-all ${
                isOurOffer
                  ? `${tier.bgColor} ${tier.borderColor} ring-1 ring-accent/15 shadow-sm`
                  : `${tier.bgColor} ${tier.borderColor}`
              }`}
            >
              {/* Label row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-semibold ${tier.color} truncate`}>
                    {tier.label}
                  </span>
                  {tier.badge && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider bg-accent text-white px-2 py-0.5 rounded-full shadow-sm">
                      <Award className="w-2.5 h-2.5" />
                      {tier.badge}
                    </span>
                  )}
                </div>
                <span className={`text-sm font-bold tabular-nums ${isOurOffer ? "text-accent" : tier.color}`}>
                  {fmt(tier.value)}
                </span>
              </div>

              {/* Bar */}
              <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.6, delay: 0.4 + idx * 0.1, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    isOurOffer
                      ? "bg-gradient-to-r from-accent to-accent/80"
                      : tier.label.includes("Wholesale")
                      ? "bg-muted-foreground/30"
                      : tier.label.includes("Instant")
                      ? "bg-amber-500/50"
                      : "bg-muted-foreground/20"
                  }`}
                />
              </div>

              {/* Sublabel + hassle note */}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground/50">{tier.sublabel}</span>
                {tier.hassle && (
                  <span className="text-[9px] text-muted-foreground/40 italic flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {tier.hassle}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Why sell to us — expandable */}
      <div className="border-t border-border/20">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-xs font-bold text-card-foreground hover:bg-muted/20 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Why sell to us?
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="px-5 pb-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {whyBullets.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="flex items-center gap-2.5 bg-muted/20 rounded-xl px-3 py-2.5 border border-border/10"
                >
                  <div className="w-6 h-6 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <item.icon className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium leading-tight">
                    {item.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default CompetitorComparison;
