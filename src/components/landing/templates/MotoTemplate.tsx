import SellFlow from "@/pages/SellFlow";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { MotoBelowFold, DefaultBelowFold } from "../sharedSections";
import BrandStructuredData from "@/components/BrandStructuredData";
import NAPFooter from "@/components/NAPFooter";
import StickyOfferCTA from "@/components/moto-sections/StickyOfferCTA";

/**
 * "Instant Offer" landing template — the MotoAcquire-style 8-step
 * appraisal flow PLUS a calibrated below-fold marketing chrome.
 *
 * Design intent (third iteration, per the three-agent benchmark vs
 * sellyourcar.online — MotoAcquire's own consumer site):
 *
 *   "Negative space as authority" is the national-brand tell. We
 *   pulled the page back from a six-section marketing wall to four
 *   tight sections that match MotoAcquire's calmer cadence:
 *     HowItWorks → ValueTracker → FAQ → CTA
 *   No testimonials grid (moves to /reviews subpage in a follow-up
 *   PR), no comparison table, no stat strip, no NAP block in the
 *   main scroll. The page reads as one continuous surface with
 *   hairline dividers instead of alternating bg tones.
 *
 * Mobile: keep DefaultBelowFold's LearnMoreFold accordion so the
 * extra SEO content is indexed but compressed visually. Closed-
 * accordion content in the DOM is fully indexed AND fully weighted
 * by Google.
 *
 * NAP block moves to a footer-line slot below the closing CTA so
 * local-pack ranking signals are preserved without breaking the
 * mid-page flow. Hidden when the dealer hasn't filled in NAP fields.
 *
 * Per-tenant correctness: every section reads from useSiteConfig.
 * BrandStructuredData passes faqVariant="moto" so the JSON-LD
 * FAQPage matches the visible 5-question FAQLean (Google's "must
 * match" rule for FAQ rich-result eligibility).
 */
const MotoTemplate = () => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim();
  const h1 = dealerName && dealerName !== "Our Dealership"
    ? `Sell Your Car — Instant Cash Offer from ${dealerName}`
    : "Sell Your Car — Instant Cash Offer";

  return (
    <main>
      <h1 className="sr-only">{h1}</h1>

      <BrandStructuredData faqVariant="moto" />

      <SellFlow />

      {/* Desktop chrome: 4 sections, MotoAcquire-style minimal. */}
      <div className="hidden md:block bg-background">
        <MotoBelowFold />
      </div>

      {/* Mobile chrome: existing LearnMoreFold accordion pattern.
          Mobile lean variants are a follow-up pass. */}
      <div className="md:hidden bg-background">
        <DefaultBelowFold />
      </div>

      {/* NAP footer-line. Demoted from the mid-scroll position so it
          doesn't break the flow but still feeds local-pack ranking
          (NAP discovery + JSON-LD address are still present). */}
      <NAPFooter />

      {/* Sticky desktop pill — a second-look visitor scrolling back
          up through the page is never more than one click from the
          form. Hidden when the form itself is in view. */}
      <StickyOfferCTA />
    </main>
  );
};

export default MotoTemplate;
