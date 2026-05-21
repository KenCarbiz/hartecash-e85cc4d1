// Moto-aesthetic "How it works" — second iteration per the 3-agent
// benchmark vs sellyourcar.online (MotoAcquire's own consumer site).
//
// Visual rules:
//   * Each step uses an uploaded illustration asset — navy stroke
//     glyph on a transparent background. No grey-circle wrapper
//     here or in code: the section is part of the landing's
//     "negative space as authority" rhythm, and naked icons read
//     cleaner / more confident at this size than a feature-card-
//     style tile. (Grey-circle variants exist in /brand/autocurb
//     history if we ever need to swap back.)
//   * Uppercase "STEP 1 / STEP 2 / STEP 3" eyebrow above each
//     heading at 11px tracking-[0.12em].
//   * Per-step inline CTA link (`text-primary underline-offset-4
//     hover:underline`) anchoring back to #sell-car-form so each
//     step is its own micro-conversion ramp — not inert copy.
//
// Per-tenant: pickup_offered still flips step 3 between "we pick up"
// and "drop off" — same as the original.
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { DollarSign, TrendingUp, ShieldCheck } from "lucide-react";



const scrollToForm = () => {
  const form = document.getElementById("sell-car-form");
  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

const HowItWorksLean = () => {
  const { config } = useSiteConfig();
  const pickupOffered = config.pickup_offered !== false;

  const steps = [
    {
      Icon: DollarSign,
      title: "Get an instant valuation",
      desc: "Enter your license plate or VIN and basic details. Takes less than 2 minutes.",
      cta: "Get started",
    },
    {
      Icon: TrendingUp,
      title: "Track your vehicle's value",
      desc: "Not ready to sell? Our free tracking tool monitors your car's value so you know the right moment.",
      cta: "Track my value",
    },
    {
      Icon: ShieldCheck,
      title: pickupOffered ? "Get paid & we pick up" : "Drop off & get paid",
      desc: pickupOffered
        ? "Accept your offer, get paid on the spot, and we'll pick up your car for free."
        : "Bring your car to us when it's convenient. We'll inspect, pay you on the spot, and handle the paperwork.",
      cta: "Get my offer",
    },
  ];

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="py-20 lg:py-24 px-5 bg-background border-t border-border/60"
    >
      <h2
        id="how-heading"
        className="text-3xl font-semibold tracking-tight text-foreground text-center mb-14 lg:mb-16"
      >
        How our process works
      </h2>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
        {steps.map((step, i) => (
          <div key={i} className="text-center">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center">
              <step.Icon
                className="w-9 h-9 text-primary"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>

            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-2">
              Step {i + 1}
            </p>
            <h3 className="text-lg font-semibold text-foreground mb-3">
              {step.title}
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto mb-5">
              {step.desc}
            </p>
            <button
              type="button"
              onClick={scrollToForm}
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {step.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorksLean;

