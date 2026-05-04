import Hero from "@/components/Hero";
import LandingForm from "@/components/LandingForm";
import {
  TrustBadgesSection,
  CompetitorComparisonSection,
  HowItWorksSection,
  ValuePropsSection,
  TestimonialsSection,
  FAQSection,
  ReferralBannerSection,
  CTABannerSection,
} from "../sharedSections";

/**
 * LEGACY HARTECASH — the original pre-template-system look.
 *
 * Resurrects the maximalist marketing layout the public hartecash.com
 * had before the May-2026 design audit collapsed everything under a
 * "Learn more" accordion. Some single-rooftop dealers explicitly want
 * this back: the long scroll with every trust signal, value prop,
 * testimonial, and FAQ visible was their conversion playbook for
 * years.
 *
 * Differs from ClassicTemplate in two ways:
 *   1. Always uses the centered Hero + form layout (no offset variants).
 *   2. Renders ValueProps / Testimonials / FAQ INLINE rather than
 *      tucked behind the LearnMoreFold accordion.
 *
 * Order on the page (top → bottom):
 *   Hero (with embedded LandingForm)
 *   TrustBadges
 *   CompetitorComparison (vs Carvana / CarMax)
 *   HowItWorks (3 steps)
 *   ValueProps
 *   Testimonials
 *   FAQ
 *   ReferralBanner
 *   CTABanner ("still here? get your offer.")
 */
const LegacyTemplate = () => {
  return (
    <>
      <Hero />
      <LandingForm />
      <TrustBadgesSection />
      <CompetitorComparisonSection />
      <HowItWorksSection />
      <ValuePropsSection />
      <TestimonialsSection />
      <FAQSection />
      <ReferralBannerSection />
      <CTABannerSection />
    </>
  );
};

export default LegacyTemplate;
