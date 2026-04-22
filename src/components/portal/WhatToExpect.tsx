import { motion } from "framer-motion";
import { Car, ClipboardList, Wrench, Handshake, Clock, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Car,
    title: "Pull Up & Check In",
    duration: "~2 min",
    description: "Drive to our service entrance. A team member will greet you and take your keys — no appointment line.",
  },
  {
    icon: ClipboardList,
    title: "Paperwork Review",
    duration: "~3 min",
    description: "We'll verify your title, registration, and ID while you relax in our lounge with complimentary Wi-Fi and refreshments.",
  },
  {
    icon: Wrench,
    title: "Quick Vehicle Inspection",
    duration: "~8 min",
    description: "Our appraiser checks the exterior, interior, tires, brakes, and takes a short test drive — all while you wait comfortably.",
  },
  {
    icon: Sparkles,
    title: "Final Offer Presented",
    duration: "~2 min",
    description: "We'll walk you through the final number. Vehicles in better-than-reported condition may qualify for a higher offer on the spot.",
  },
  {
    icon: Handshake,
    title: "Get Paid & Go",
    duration: "~5 min",
    description: "Accept the offer, sign a few forms, and receive your check — or have it direct-deposited. That's it!",
  },
];

const WhatToExpect = () => {
  return (
    <div className="bg-card rounded-xl shadow-lg overflow-hidden print:hidden">
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">What to Expect at Your Visit</h3>
        </div>
      </div>
      <div className="p-5">
        <p className="text-xs text-muted-foreground mb-5">
          The whole process takes about 15–20 minutes. Here's how it works:
        </p>

        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border" />

          <div className="space-y-0">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex gap-4 py-3"
                >
                  {/* Step node */}
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-card-foreground">{step.title}</span>
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {step.duration}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatToExpect;
