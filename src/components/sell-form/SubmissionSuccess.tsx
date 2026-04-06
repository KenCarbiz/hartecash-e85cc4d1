import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, Smartphone, DollarSign } from "lucide-react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import type { VehicleInfo } from "./types";
import type { OfferEstimate } from "@/lib/offerCalculator";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import PostOfferStorePicker from "./PostOfferStorePicker";

interface Props {
  uploadUrl: string;
  vehicleInfo: VehicleInfo | null;
  nextStep: string;
  offerEstimate: OfferEstimate | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const SubmissionSuccess = ({ uploadUrl, vehicleInfo, nextStep, offerEstimate }: Props) => {
  const { config } = useSiteConfig();
  useEffect(() => {
    const duration = 2000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#10b981", "#0056a0", "#e63946"] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#10b981", "#0056a0", "#e63946"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const OfferCard = () => {
    if (!offerEstimate) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="bg-gradient-to-br from-success/10 to-accent/10 border-2 border-success/30 rounded-2xl p-6 mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-success" />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Your Cash Offer
          </span>
        </div>
        <div className="text-center">
          <span className="text-3xl md:text-4xl font-extrabold text-card-foreground">
            {formatCurrency(offerEstimate.high)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">
          This offer is based on the condition you reported and current market data.
          Subject to in-person inspection.
        </p>
      </motion.div>
    );
  };

  if (nextStep === "visit") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="text-center py-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
        </motion.div>
        <h3 className="text-2xl font-bold text-card-foreground mb-2">You're All Set!</h3>
        {vehicleInfo && (
          <p className="text-base font-semibold text-card-foreground mb-4">
            {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
          </p>
        )}
        <OfferCard />
        <p className="text-muted-foreground">
          We'll contact you shortly to schedule your in-person visit.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="text-center py-4">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="text-5xl mb-3">📸</motion.div>
      <h3 className="text-xl font-bold text-card-foreground mb-1">
        Scan to Upload Photos
      </h3>
      {vehicleInfo && (
        <p className="text-sm font-semibold text-card-foreground mb-1">
          {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
        </p>
      )}
      <p className="text-muted-foreground text-sm mb-5">
        Upload photos to lock in your offer. The faster we see your vehicle, the sooner you get paid.
      </p>

      <OfferCard />

      <div className="bg-white p-4 rounded-xl inline-block shadow-lg mb-5 relative">
        <QRCodeSVG value={uploadUrl} size={200} level="H" />
        {config.logo_url && (
          <img
            src={config.logo_url}
            alt=""
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-md bg-white p-1 shadow-sm"
          />
        )}
      </div>

      <div className="flex items-center gap-4 bg-muted/50 rounded-xl p-6 text-left">
        <Smartphone className="w-12 h-12 text-accent shrink-0" />
        <div>
          <p className="text-base font-semibold text-card-foreground">Using your phone?</p>
          <a
            href={uploadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-accent underline font-medium"
          >
            Tap here to upload photos directly →
          </a>
        </div>
      </div>
    </motion.div>
  );
};

export default SubmissionSuccess;
