import { motion } from "framer-motion";
import { Award, ArrowRight, Star } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import {
  TestimonialsSection,
  TrustBadgesSection,
  HowItWorksSection,
  FAQSection,
  CTABannerSection,
  ReferralBannerSection,
} from "../sharedSections";

/**
 * ELEGANT — premium, deliberate, dark with gold accents. Inspired by
 * Lexus / Genesis franchise sites. Wide horizontal rules, italicized
 * serif-influenced display type, recessed form card. Best fit for luxury
 * dealers and franchise rooftops.
 */
const ElegantTemplate = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => {
    document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* Cream-on-dark hero with horizontal rule motif */}
      <section className="relative bg-[hsl(220,30%,9%)] text-[hsl(40,30%,92%)] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at center top, hsl(var(--primary) / 0.4), transparent 70%)",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 py-20 lg:py-28 text-center">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-px w-10 bg-amber-300/60" aria-hidden />
            <Award className="w-4 h-4 text-amber-300" />
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-amber-300/90">
              {config.stats_years_in_business || "Trusted since 1947"}
            </span>
            <div className="h-px w-10 bg-amber-300/60" aria-hidden />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="font-display text-[40px] md:text-[60px] lg:text-[76px] font-extrabold tracking-[-0.01em] leading-[1.05]"
          >
            {config.hero_headline || (
              <>
                <span className="block">A more refined way</span>
                <span className="block italic font-light">to sell your car.</span>
              </>
            )}
          </motion.h1>

          <p className="mt-6 max-w-2xl mx-auto text-base lg:text-lg text-[hsl(40,15%,80%)] leading-relaxed">
            {config.hero_subtext ||
              "A real, written cash offer in two minutes — backed by a multi-decade reputation and a price guarantee that holds for a full week."}
          </p>

          <button
            onClick={scrollToForm}
            className="mt-10 inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-300/90 text-[hsl(220,30%,9%)] font-bold text-sm tracking-wide px-8 py-3.5 rounded-full transition-all hover:gap-3 uppercase letter-spacing-wide"
          >
            Begin your appraisal <ArrowRight className="w-4 h-4" />
          </button>

          {/* Bottom rule motif */}
          <div className="mt-14 mx-auto w-32 h-px bg-amber-300/30" aria-hidden />
        </div>
      </section>

      {/* Form sits in a recessed card on cream */}
      <section id="sell-car-form" className="bg-[hsl(40,30%,96%)] px-5 py-20">
        <div className="max-w-[600px] mx-auto">
          <div className="text-center mb-7">
            <span className="text-[10px] tracking-[0.3em] uppercase text-amber-700 font-semibold">Step One</span>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold mt-2 text-[hsl(220,30%,15%)]">
              Tell us about your car
            </h2>
          </div>
          <div className="rounded-3xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.25)] border border-amber-100 bg-card overflow-hidden">
            <SellCarForm variant="split" />
          </div>

          <div className="mt-8 flex items-center justify-center gap-3 text-sm text-[hsl(220,15%,40%)]">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-bold text-[hsl(220,30%,15%)]">{config.stats_rating || "4.9"}</span>
            <span>·</span>
            <span>{config.stats_reviews_count || "2,400+"} reviews</span>
          </div>
        </div>
      </section>

      <HowItWorksSection />
      <TestimonialsSection />
      <TrustBadgesSection />
      <FAQSection />
      <ReferralBannerSection />
      <CTABannerSection />
    </>
  );
};

export default ElegantTemplate;
