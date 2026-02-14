import { ClipboardList, Check } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  "Valid driver's license or state ID",
  "Vehicle registration",
  "Vehicle title (if available)",
  "All sets of keys & remotes",
  "Loan payoff information (if applicable)",
];

const WhatToBringCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.2 }}
    className="bg-card rounded-xl p-5 shadow-lg"
  >
    <div className="flex items-center gap-2 mb-3">
      <ClipboardList className="w-5 h-5 text-primary" />
      <h3 className="font-bold text-card-foreground">What to Bring</h3>
    </div>
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
    <p className="text-xs text-muted-foreground/70 mt-3 italic">
      The whole process takes approximately 15–25 minutes.
    </p>
  </motion.div>
);

export default WhatToBringCard;
