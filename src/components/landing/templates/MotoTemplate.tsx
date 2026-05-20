import SellFlow from "@/pages/SellFlow";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { MotoBelowFold, MotoMobileBelowFold } from "../sharedSections";
import BrandStructuredData from "@/components/BrandStructuredData";
import StickyOfferCTA from "@/components/moto-sections/StickyOfferCTA";

/**
 * "Instant Offer" landing template — the MotoAcquire-style 8-step
 * appraisal flow PLUS a calibrated below-fold marketing chrome.
 *
 * Design intent (per the three-agent benchmark vs sellyourcar.online):
 *
 *   "Negative space as authority" is the national-brand tell. The
 *   page reads as one continuous surface with hairline dividers
 *   instead of alternating bg tones.
 *
 * DESKTOP (md+) — 4 sections:
 *   HowItWorks → ValueTracker → FAQ → CTA
 *
 * MOBILE (<md) — 3 sections, watered down per product-owner direction:
 *   HowItWorks → FAQ → CTA
 *
 *   Skipped on mobile: ValueTrackerCard. Its inline-SVG illustration
 *   doubles the vertical scroll on small viewports without
 *   commensurate value — the value-tracker opt-in already lives on
 *   the form's contact step via MotoTrackValueBlock.
 *
 *   Skipped from both viewports (cut by the three-agent benchmark):
 *     * TrustBadges stat strip
 *     * CompetitorComparison table
 *     * Testimonials grid (moved to /reviews subpage)
 *     * ValueProps card row
 *     * ReferralBanner
 *     * NAP "Visit X" block (NAP now lives in JSON-LD only)
 *
 * Per-tenant correctness: every section reads from useSiteConfig.
 * BrandStructuredData passes faqVariant="moto" so the JSON-LD
 * FAQPage matches the visible 5-question FAQLean (Google's "must
 * match" rule for FAQ rich-result eligibility).
 *
 * Sticky CTA pill: desktop-only (≥lg). Floats bottom-right after the
 * hero is scrolled past; hides when the form anchor is in view.
 * Mobile gets the existing in-flow CTAs plus MotoStickyFooter from
 * MotoShell, so adding another floating pill there would break
 * thumb-zone ergonomics.
 *
 * Footer is owned by Index.tsx — picks BrandFooter for Moto and
 * SiteFooter for every other template. Mounting one here would
 * double-render.
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

      {/* Mobile chrome: 3 sections, watered down. */}
      <div className="md:hidden bg-background">
        <MotoMobileBelowFold />
      </div>

      {/* Sticky desktop pill — second-look visitor scrolling back up
          is never more than one click from the form. */}
      <StickyOfferCTA />
    </main>
  );
};

export default MotoTemplate;
