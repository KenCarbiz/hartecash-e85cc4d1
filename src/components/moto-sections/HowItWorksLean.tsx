// Moto-aesthetic variant of HowItWorks.
//
// Visual rules:
//   * White bg, no radial dot grid
//   * Outlined circle numerals (border + primary color), no gradient fill,
//     no shadow-lg, no glow-ring hover
//   * Section eyebrow ("SIMPLE PROCESS" uppercase tracking-wider) removed —
//     it was template-era noise. H2 alone is enough.
//
// Step content + pickup_offered toggle preserved from the original.
import { useSiteConfig } from "@/hooks/useSiteConfig";

const HowItWorksLean = () => {
  const { config } = useSiteConfig();
  const pickupOffered = config.pickup_offered !== false;

  const steps = [
    {
      num: 1,
      title: "Tell us about your car",
      desc: "Enter your license plate or VIN and basic details. Takes less than 2 minutes.",
    },
    {
      num: 2,
      title: "Get your cash offer",
      desc: "Receive a competitive, no-obligation offer based on real market data.",
    },
    pickupOffered
      ? {
          num: 3,
          title: "Get paid & we pick up",
          desc: "Accept your offer, get paid on the spot, and we'll pick up your car for free.",
        }
      : {
          num: 3,
          title: "Drop off & get paid",
          desc: "Bring your car to us when it's convenient. We'll inspect, pay you on the spot, and handle the paperwork.",
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
        className="text-3xl font-semibold tracking-tight text-foreground text-center mb-12 lg:mb-16"
      >
        How it works
      </h2>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
        {steps.map((step) => (
          <div key={step.num} className="text-center">
            <div className="mx-auto mb-5 w-14 h-14 rounded-full border-2 border-primary flex items-center justify-center text-lg font-semibold text-primary">
              {step.num}
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {step.title}
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorksLean;
