import { Landmark, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const LoanPayoffCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.2 }}
    className="bg-card rounded-xl shadow-lg overflow-hidden"
  >
    <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-3 border-b border-border/50">
      <div className="flex items-center gap-2">
        <Landmark className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-card-foreground">Have a Loan?</h3>
      </div>
    </div>
    <div className="p-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Don't worry — <span className="font-semibold text-card-foreground">we handle it for you</span>. We'll pay off your lender directly and give you a check for the difference. Just bring your loan payoff information to your appointment.
      </p>
      <div className="mt-3 bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-3 h-3 text-accent" />
          <span>We contact your lender</span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowRight className="w-3 h-3 text-accent" />
          <span>We pay off the remaining balance</span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowRight className="w-3 h-3 text-accent" />
          <span>You get a check for the equity</span>
        </div>
      </div>
    </div>
  </motion.div>
);

export default LoanPayoffCard;
