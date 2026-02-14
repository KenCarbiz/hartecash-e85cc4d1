import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

const faqs = [
  {
    q: "How do I get paid?",
    a: "You'll receive a check on the spot at the time of purchase. No waiting, no wire transfers — just a check you can deposit immediately.",
  },
  {
    q: "What if I still owe money on my car?",
    a: "No problem! We handle the payoff directly with your lender and pay you the difference. You don't have to lift a finger.",
  },
  {
    q: "How long does the process take?",
    a: "The in-person visit takes about 15–25 minutes. Most customers drive in and leave with a check the same day.",
  },
  {
    q: "Is the offer negotiable?",
    a: "Our offers are based on current market data and your vehicle's condition. We aim to give you a fair, competitive price from the start.",
  },
  {
    q: "Do I need an appointment?",
    a: "We recommend scheduling a visit so we can have everything ready for you, but walk-ins are welcome during business hours.",
  },
];

const PortalFAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="bg-card rounded-xl p-5 shadow-lg"
    >
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-card-foreground">Common Questions</h3>
      </div>
      <div className="space-y-1">
        {faqs.map((faq, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between py-2.5 text-left text-sm font-medium text-card-foreground hover:text-accent transition-colors"
            >
              {faq.q}
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform ${
                  openIndex === i ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                openIndex === i ? "max-h-[200px] pb-2" : "max-h-0"
              }`}
            >
              <p className="text-sm text-muted-foreground leading-relaxed pl-0.5">
                {faq.a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PortalFAQ;
