import { Check, Star, Shield } from "lucide-react";
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
    <section className="bg-gradient-to-b from-primary to-[hsl(210,100%,36%)] text-primary-foreground px-5 py-8 lg:py-10 pb-10 lg:pb-14 text-center relative">
      <div className="max-w-4xl mx-auto">
        {/* Price Guarantee Badge */}
        <div className="inline-flex items-center gap-2 bg-success/20 border border-success/40 rounded-full px-4 py-1.5 mb-5">
          <Shield className="w-4 h-4 text-success fill-success/30" />
          <span className="text-sm font-bold tracking-wide text-success-foreground">
            {config.price_guarantee_days}-DAY PRICE GUARANTEE
          </span>
        </div>

        <h1 className="text-[26px] md:text-[32px] lg:text-[44px] font-extrabold tracking-wide leading-tight mb-4 uppercase">
          {config.hero_headline || "Sell Your Car\nThe Easy Way"}
        </h1>
        <p className="text-lg lg:text-xl font-normal opacity-95 mb-6 lg:mb-10 leading-relaxed max-w-xl mx-auto">
          {config.hero_subtext || "Get a top-dollar cash offer in 2 minutes. No haggling, no stress."}
        </p>

        <div className="max-w-[500px] lg:max-w-none mx-auto mb-8 text-left px-5 md:px-0">
          <div className="lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-4 lg:max-w-2xl lg:mx-auto">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-3 mb-3 lg:mb-0">
                <Check className="w-6 h-6 text-success flex-shrink-0 stroke-[3] mt-0.5" />
                <span className="text-[15px] md:text-base font-medium leading-snug">
                  <strong>{b.label}:</strong> {b.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-6">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <span className="text-xl font-bold">{config.stats_rating || "4.9"}</span>
          <span className="text-sm opacity-80">{config.stats_reviews_count || "2,400+"} reviews</span>
        </div>
      </div>
    </section>
  );
};

export default Hero;
