import SellFlow from "@/pages/SellFlow";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { FullBelowFold, DefaultBelowFold } from "../sharedSections";
import BrandStructuredData from "@/components/BrandStructuredData";
import NAPFooter from "@/components/NAPFooter";

/**
 * "Instant Offer" landing template — the MotoAcquire-style 8-step
 * appraisal flow PLUS responsive SEO/marketing chrome below.
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │ <SellFlow />        (mobile + desktop)   │
 *   │   the 8-step instant-offer form          │
 *   ├──────────────────────────────────────────┤
 *   │ Desktop (md+):  <FullBelowFold />        │
 *   │   all sections inline, max content       │
 *   │                                          │
 *   │ Mobile (<md):   <DefaultBelowFold />     │
 *   │   trust + comparison + how-it-works      │
 *   │   visible; value-props/testimonials/FAQ  │
 *   │   collapse behind a "Learn more" accordion│
 *   ├──────────────────────────────────────────┤
 *   │ <NAPFooter />                            │
 *   │   semantic <address> for local SEO       │
 *   └──────────────────────────────────────────┘
 *
 * Why mobile shows the chrome (collapsed):
 *   The previous version used `hidden md:block` claiming bots render
 *   at desktop widths. WRONG — Googlebot Smartphone has been the
 *   primary crawler since 2020 (mobile-first indexing). Hiding
 *   content with display:none means Google still INDEXES it but
 *   DISCOUNTS its ranking weight. Content inside a closed accordion
 *   in the DOM is fully indexed AND fully weighted — same SEO payload
 *   as desktop, near-zero mobile UX cost. DefaultBelowFold uses the
 *   existing LearnMoreFold accordion in sharedSections.tsx.
 *
 * SEO additions vs. the prior pass:
 *   * Page-level H1 (sr-only — the form's own headlines are the
 *     visual hero; an H1 added here gives crawlers the
 *     "Sell Your Car ... | {Dealer}" signal without competing with
 *     the form visually).
 *   * Semantic <main> landmark for accessibility + SEO.
 *   * BrandStructuredData emits AutoDealer + FAQPage + WebSite
 *     JSON-LD, all driven by site_config so each tenant gets a
 *     distinct graph.
 *   * NAPFooter is a real <address> element with crawlable
 *     name/address/phone — required for local-pack ranking.
 *
 * Per-tenant correctness:
 *   Every section reads from useSiteConfig. A different dealer
 *   selecting landing_template=moto gets their own:
 *     dealership_name → comparison + ValueProps headers, NAP, JSON-LD
 *     stats_cars_purchased + established_year → TrustBadges, JSON-LD
 *     stats_rating → TrustBadges, AggregateRating in JSON-LD
 *     pickup_offered → HowItWorks step 3 + FAQ + comparison rows
 *     price_guarantee_days → comparison + ValueProps + FAQ
 *     address, phone, email, business_hours → NAP block + JSON-LD
 */
const MotoTemplate = () => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim();
  // H1 leverages the dealer's name when configured; falls back to
  // generic intent-keyword copy for new tenants who haven't
  // completed onboarding yet.
  const h1 = dealerName && dealerName !== "Our Dealership"
    ? `Sell Your Car — Instant Cash Offer from ${dealerName}`
    : "Sell Your Car — Instant Cash Offer";

  return (
    <main>
      {/* Per-page H1. Hidden visually (the form's own headlines are
          the visual hero), but present in the DOM so crawlers and
          screen readers see one clear primary heading. */}
      <h1 className="sr-only">{h1}</h1>

      <BrandStructuredData />

      <SellFlow />

      {/* Desktop chrome: full inline marketing content. */}
      <div className="hidden md:block bg-background">
        <FullBelowFold />
      </div>

      {/* Mobile chrome: trust + comparison + how-it-works visible,
          everything else collapsed behind LearnMoreFold. Same DOM
          content as desktop, just compressed. */}
      <div className="md:hidden bg-background">
        <DefaultBelowFold />
      </div>

      <NAPFooter />
    </main>
  );
};

export default MotoTemplate;
