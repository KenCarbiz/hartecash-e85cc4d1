import Hero from "@/components/Hero";
import LandingForm from "@/components/LandingForm";
import { FullBelowFold } from "../sharedSections";

/**
 * LEGACY HARTECASH — the original pre-template-system long-scroll.
 *
 * Resurrects the maximalist marketing layout the public hartecash.com
 * had before the May-2026 design audit collapsed everything under a
 * "Learn more" accordion. Some single-rooftop dealers explicitly want
 * this back: the long scroll with every trust signal, value prop,
 * testimonial, and FAQ visible was their conversion playbook for
 * years.
 *
 * Just the canonical Hero + form, then the canonical FullBelowFold
 * marketing chrome shared with every other template (TrustBadges +
 * HowItWorks + CompetitorComparison + ValueProps + Testimonials +
 * FAQ + ReferralBanner + CTABanner).
 */
const LegacyTemplate = () => {
  return (
    <>
      <Hero />
      <LandingForm />
      <FullBelowFold />
    </>
  );
};

export default LegacyTemplate;
