import { Check, Shield } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const Hero = () => {
  const { config } = useSiteConfig();

  const benefits = [
    { label: "Faster", desc: "Get cash in 24 hours, not weeks of meetups" },
    { label: "Safer", desc: "No strangers at your home or getting your personal info" },
    { label: "More Convenient", desc: "One visit, we handle all paperwork" },
    { label: "Privacy Protected", desc: "We never share your address, name, or phone number" },
  ];

  return (
    <section className="bg-gradient-to-b from-primary via-primary to-[hsl(210,100%,32%)] text-primary-foreground px-5 py-12 lg:py-20 pb-16 lg:pb-24 text-center relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[hsl(210,100%,50%,0.08)] rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-4xl mx-auto relative">
        {/* Price Guarantee Badge */}
        <div className="inline-flex items-center gap-2 bg-success/20 backdrop-blur-sm border border-success/40 rounded-full px-5 py-1.5 mb-5 shadow-lg shadow-success/10">
          <Shield className="w-4 h-4 text-success fill-success/30" />
          <span className="text-sm font-bold tracking-wide text-success-foreground">
            {config.price_guarantee_days}-DAY PRICE GUARANTEE
          </span>
        </div>

        <h1 className="font-display text-[28px] md:text-[34px] lg:text-[42px] font-extrabold tracking-wide leading-tight mb-4 uppercase">
          {config.hero_headline || "Sell Your Car\nThe Easy Way"}
        </h1>
        <p className="text-base lg:text-lg font-normal opacity-90 mb-8 lg:mb-10 leading-relaxed max-w-xl mx-auto">
          {config.hero_subtext || "Get a top-dollar cash offer in 2 minutes. No haggling, no stress."}
        </p>

        <div className="max-w-[500px] lg:max-w-none mx-auto mb-6 text-left px-5 md:px-0">
          <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 lg:gap-y-3 lg:max-w-2xl lg:mx-auto">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-3 mb-3 lg:mb-0 group">
                <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-success/30 transition-colors">
                  <Check className="w-3.5 h-3.5 text-success stroke-[3]" />
                </div>
                <span className="text-[14px] md:text-[15px] font-medium leading-snug opacity-95">
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
