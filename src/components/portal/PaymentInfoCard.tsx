import { Banknote, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const PaymentInfoCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.2 }}
    className="bg-gradient-to-br from-success/5 to-success/10 rounded-xl p-5 shadow-lg border border-success/20"
  >
    <div className="flex items-center gap-2 mb-2">
      <Banknote className="w-5 h-5 text-success" />
      <h3 className="font-bold text-card-foreground">How You Get Paid</h3>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed">
      You'll receive a <span className="font-semibold text-card-foreground">check on the spot</span> the same day we purchase your vehicle. No waiting for bank transfers or mailed checks.
    </p>
    <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
      <ShieldCheck className="w-3.5 h-3.5 text-success" />
      <span>Fast, secure, hassle-free payment</span>
    </div>
  </motion.div>
);

export default PaymentInfoCard;
