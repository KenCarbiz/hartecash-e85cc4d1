import { Check, Shield } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const Hero = () => {
  const { config } = useSiteConfig();

  const benefits = [
    { label: "Faster", desc: "Cash in 24 hours" },
    { label: "Safer", desc: "No strangers at your home" },
    { label: "Convenient", desc: "One visit, we handle paperwork" },
    { label: "Private", desc: "We never share your info" },
  ];

  return (
    <section className="bg-gradient-to-b from-primary to-[hsl(210,100%,36%)] text-primary-foreground px-5 py-4 lg:py-5 pb-5 lg:pb-6 text-center relative">
      <div className="max-w-4xl mx-auto">
        {/* Price Guarantee Badge */}
        <div className="inline-flex items-center gap-2 bg-success/20 border border-success/40 rounded-full px-4 py-1 mb-2">
          <Shield className="w-4 h-4 text-success fill-success/30" />
          <span className="text-sm font-bold tracking-wide text-success-foreground">
            {config.price_guarantee_days}-DAY PRICE GUARANTEE
          </span>
        </div>

        <h1 className="text-[24px] md:text-[30px] lg:text-[38px] font-extrabold tracking-wide leading-tight mb-1.5 uppercase">
          {config.hero_headline || "Sell Your Car\nThe Easy Way"}
        </h1>
        <p className="text-base lg:text-lg font-normal opacity-95 mb-3 lg:mb-4 leading-relaxed max-w-xl mx-auto">
          {config.hero_subtext || "Get a top-dollar cash offer in 2 minutes. No haggling, no stress."}
        </p>

        <div className="max-w-[500px] lg:max-w-none mx-auto mb-3 text-left px-5 md:px-0">
          <div className="lg:grid lg:grid-cols-2 lg:gap-y-1.5 lg:max-w-3xl lg:mx-auto">
            {benefits.map((b, i) => (
              <div key={i} className={`flex items-start gap-2 mb-1.5 lg:mb-0 ${i % 2 === 0 ? 'lg:justify-self-start' : 'lg:justify-self-end'}`}>
                <Check className="w-5 h-5 text-success flex-shrink-0 stroke-[3] mt-0.5" />
                <span className="text-[13px] md:text-[14px] font-medium leading-snug">
                  <strong>{b.label}:</strong> {b.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default Hero;
