import { Star, ShieldCheck, Award } from "lucide-react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import {
  HowItWorksSection,
  TrustBadgesSection,
  TestimonialsSection,
  FAQSection,
  CTABannerSection,
  ReferralBannerSection,
} from "../sharedSections";

const TrustTemplate = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => {
    document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* Minimal hero. Let testimonials do the heavy lifting below. */}
      <section className="relative bg-background pt-20 pb-16 px-5 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 mb-6">
            <Award className="w-4 h-4" />
            <span className="text-xs font-bold tracking-wider uppercase">
              {config.stats_years_in_business || "Trusted by thousands"}
            </span>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-[32px] md:text-[48px] lg:text-[60px] font-extrabold tracking-tight leading-[1.1] mb-6 text-foreground"
          >
            {config.hero_headline || "The Neighborhood's Most-Trusted Car Buyer"}
          </motion.h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {config.hero_subtext || "Real offers, real people, real reviews. Get your cash offer in two minutes."}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 mb-10">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="font-bold text-foreground">{config.stats_rating || "4.9"}</span>
              <span className="text-sm text-muted-foreground">
                · {config.stats_reviews_count || "2,400+"} reviews
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="w-5 h-5 text-success" />
              <span>{config.price_guarantee_days}-day price guarantee</span>
            </div>
          </div>

          <button
            onClick={scrollToForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg px-10 py-4 rounded-full shadow-lg transition-all hover:scale-[1.02]"
          >
            Get My Cash Offer
          </button>
        </div>
      </section>

      {/* Review wall is prioritized — testimonials sit above the fold scroll */}
      <TestimonialsSection />
      <TrustBadgesSection />

      {/* Form */}
      <section id="sell-car-form" className="py-16 lg:py-20 px-5 bg-muted/30">
        <div className="max-w-[560px] mx-auto">
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl md:text-3xl font-extrabold">
              Ready to Join Them?
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tell us about your car — we'll handle the rest.
            </p>
          </div>
          <div className="rounded-2xl shadow-lg">
            <SellCarForm variant="split" />
          </div>
        </div>
      </section>

      <HowItWorksSection />
      <FAQSection />
      <ReferralBannerSection />
      <CTABannerSection />
    </>
  );
};

export default TrustTemplate;
