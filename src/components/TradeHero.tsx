import { Check, Star, Shield } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const TradeHero = () => {
  const { config } = useSiteConfig();

  const benefits = [
    { label: "Quick & Easy", desc: "Submit your trade-in info in just a few minutes" },
    { label: "No Waiting", desc: "Get your trade value before you arrive — or after you leave" },
    { label: "Connected", desc: "Your info goes straight to the salesperson you're working with" },
    { label: "Privacy Protected", desc: "Your data is secure and only shared with your sales team" },
  ];

  return (
    <section className="bg-gradient-to-b from-primary to-[hsl(210,100%,36%)] text-primary-foreground px-5 py-12 lg:py-20 pb-16 lg:pb-24 text-center relative">
      <div className="max-w-4xl mx-auto">
        {/* Price Guarantee Badge */}
        <div className="inline-flex items-center gap-2 bg-success/20 border border-success/40 rounded-full px-4 py-1.5 mb-5">
          <Shield className="w-4 h-4 text-success fill-success/30" />
          <span className="text-sm font-bold tracking-wide text-success-foreground">
            {config.price_guarantee_days}-DAY PRICE GUARANTEE
          </span>
        </div>

        <h1 className="text-[26px] md:text-[32px] lg:text-[44px] font-extrabold tracking-wide leading-tight mb-4 uppercase">
          {config.trade_hero_headline || "Submit Your Trade-In Info"}
        </h1>
        <p className="text-lg lg:text-xl font-normal opacity-95 mb-6 lg:mb-10 leading-relaxed max-w-xl mx-auto">
          {config.trade_hero_subtext || "Already shopping with us? Send us your trade details from home — we'll have your value ready."}
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

export default TradeHero;
