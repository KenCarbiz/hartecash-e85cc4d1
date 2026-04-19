import { motion } from "framer-motion";
import { ArrowRight, Car, ClipboardCheck, FileCheck, HandCoins, Truck } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import {
  TrustBadgesSection,
  TestimonialsSection,
  FAQSection,
  CTABannerSection,
  ReferralBannerSection,
} from "../sharedSections";

const steps = [
  {
    n: "01",
    icon: Car,
    title: "Tell Us About Your Car",
    body: "Start with your license plate or VIN. We pull year, make, model and trim in seconds — no paperwork to dig up, no VIN photos to take.",
  },
  {
    n: "02",
    icon: ClipboardCheck,
    title: "Rate Its Condition",
    body: "Answer a handful of honest questions about your car's condition and history. Each one gets us closer to a number you can count on.",
  },
  {
    n: "03",
    icon: FileCheck,
    title: "Get a Real Offer",
    body: "You'll see a cash offer backed by live market data — not a guess, not a teaser. Price is guaranteed for a full week.",
  },
  {
    n: "04",
    icon: HandCoins,
    title: "Choose How You Get Paid",
    body: "Direct deposit, same-day check, or wire — your choice. We handle the title, the DMV paperwork, and the loan payoff if there is one.",
  },
  {
    n: "05",
    icon: Truck,
    title: "We Pick It Up",
    body: "Schedule a window that works for you. We'll come to your driveway, verify the car, and hand over payment before we drive away.",
  },
];

const EditorialTemplate = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => {
    document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* Hero — tall, typographic, asymmetric */}
      <section className="relative bg-background pt-16 lg:pt-24 pb-10 px-5 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-primary/70">
            {config.dealership_name}
          </span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-[40px] md:text-[64px] lg:text-[88px] font-extrabold tracking-tight leading-[0.95] mt-4 mb-6"
          >
            {config.hero_headline || "A better way to sell your car."}
          </motion.h1>
          <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
            {config.hero_subtext ||
              "Five honest steps, one fair number, zero runaround. Here's how it works."}
          </p>
          <button
            onClick={scrollToForm}
            className="mt-8 inline-flex items-center gap-2 bg-foreground hover:bg-foreground/90 text-background font-semibold px-8 py-3.5 rounded-full transition-all hover:gap-3"
          >
            Start My Offer <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Five-step narrative — alternating layout, magazine feel */}
      <section className="py-12 lg:py-20 px-5 bg-card">
        <div className="max-w-5xl mx-auto space-y-20 lg:space-y-28">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const reverse = i % 2 === 1;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center ${
                  reverse ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="lg:col-span-5">
                  <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-primary/90 to-primary/60 text-primary-foreground flex flex-col items-center justify-center p-10 shadow-xl">
                    <div className="text-[120px] font-display font-extrabold leading-none opacity-20 tracking-tight">
                      {step.n}
                    </div>
                    <Icon className="w-20 h-20 mt-[-60px]" strokeWidth={1.5} />
                  </div>
                </div>
                <div className="lg:col-span-7">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70 mb-3">
                    Step {step.n}
                  </div>
                  <h3 className="font-display text-3xl lg:text-4xl font-extrabold mb-4 leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Form */}
      <section id="sell-car-form" className="py-16 lg:py-24 px-5 bg-background">
        <div className="max-w-[580px] mx-auto">
          <div className="text-center mb-6">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary/70">
              Begin
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold mt-2">
              Get Your Offer
            </h2>
          </div>
          <div className="rounded-2xl shadow-xl">
            <SellCarForm variant="split" />
          </div>
        </div>
      </section>

      <TrustBadgesSection />
      <TestimonialsSection />
      <FAQSection />
      <ReferralBannerSection />
      <CTABannerSection />
    </>
  );
};

export default EditorialTemplate;
