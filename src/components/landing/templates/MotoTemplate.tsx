import SellFlow from "@/pages/SellFlow";
import { FullBelowFold } from "../sharedSections";

/**
 * "Instant Offer" landing template — the MotoAcquire-style 8-step
 * appraisal flow.
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │ <SellFlow />        (mobile + desktop)   │
 *   │   the 8-step instant-offer form          │
 *   ├──────────────────────────────────────────┤
 *   │ <FullBelowFold />   (desktop only)       │
 *   │   How It Works, TrustBadges,             │
 *   │   CompetitorComparison, ValueProps,      │
 *   │   Testimonials, FAQ, Referral, CTA       │
 *   └──────────────────────────────────────────┘
 *
 * Why the desktop-only gate:
 *   * The Moto flow is mobile-first and the form alone is the right
 *     mobile experience — anything below the fold on mobile just adds
 *     thumb-swipes between the customer and the price they came for.
 *   * On desktop the form sits in the top portion of a wide viewport
 *     and there's vertical room for the marketing content beneath it
 *     without competing for the customer's primary attention.
 *   * Crawler bots (Google, Bing, social previews) render the page at
 *     desktop widths by default, so the SEO content is indexed
 *     regardless of what mobile users see.
 *
 * SEO purpose:
 *   The Moto template was previously hero-less and form-only, which
 *   meant the landing had ~50 words of indexable text — terrible for
 *   ranking on "sell my car <city>" / "trade-in <make>" queries.
 *   FullBelowFold adds ~800-1000 words of dealer-specific marketing
 *   content (How It Works, comparison vs. competitors, testimonials,
 *   FAQ) that's all wired to site_config, so each dealer's landing
 *   gets unique indexable copy without per-tenant authoring.
 *
 * The flow itself is responsive (MotoShell), respects ?embed=true to
 * strip its top + disclosure bars when iframed, and reads
 * pricing_reveal_mode + landing_cta_color from the tenant's
 * site_config + offer_settings.
 */
const MotoTemplate = () => (
  <>
    <SellFlow />
    {/* Desktop-only marketing chrome. md: == 768px+ in our Tailwind
        config. Hidden on mobile so the form alone owns small screens.
        bg-background keeps the chrome on the same neutral surface as
        the form above; individual sections (TrustBadges' deep-blue
        stat strip, etc.) bring their own contrast. */}
    <div className="hidden md:block bg-background">
      <FullBelowFold />
    </div>
  </>
);

export default MotoTemplate;
