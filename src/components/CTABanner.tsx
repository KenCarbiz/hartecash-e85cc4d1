import { Shield, ArrowRight } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const CTABanner = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => {
    const form = document.getElementById("sell-car-form");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <section className="bg-gradient-to-br from-accent via-accent to-[hsl(0,77%,38%)] text-accent-foreground py-14 lg:py-24 px-5 text-center relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent-foreground/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-accent-foreground/5 blur-3xl pointer-events-none" />
      
      <div className="max-w-3xl mx-auto relative">
        <h2 className="font-display text-[28px] lg:text-[42px] font-extrabold mb-4 tracking-[0.04em] leading-tight">
          Ready to Sell Your Car?
        </h2>
        <p className="text-base lg:text-lg mb-5 opacity-90 max-w-xl mx-auto">
          Join {config.stats_reviews_count || "2,400+"} happy sellers. Get your cash offer today.
        </p>
        <div className="inline-flex items-center gap-2 bg-accent-foreground/10 backdrop-blur-sm border border-accent-foreground/20 rounded-full px-5 py-2 mb-8">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-bold">{config.price_guarantee_days || 8}-Day Price Guarantee — No Pressure</span>
        </div>
        <div>
          <button
            onClick={scrollToForm}
            className="inline-flex items-center gap-2 px-12 py-4 bg-card text-accent rounded-xl text-[17px] font-bold shadow-[0_20px_60px_-15px_hsl(var(--foreground)/0.3)] hover:-translate-y-1 hover:shadow-[0_25px_70px_-15px_hsl(var(--foreground)/0.4)] transition-all duration-300 active:scale-[0.98]"
          >
            Get My Free Offer
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default CTABanner;
