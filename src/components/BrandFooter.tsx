// Minimal national-brand footer for the Moto landing.
//
// Per the three-footer-agent benchmark (PR #265) — and follow-up
// CTA-redundancy audit by a second three-agent panel (UX +
// visual-hierarchy + CRO data) that all converged on "cut the footer
// button" — the footer is now pure typography. The sticky
// StickyOfferCTA pill (bottom-right of the viewport) carries the
// scroll-end click; the footer carries the brand sign-off. Two
// identical navy pills in the same viewport flatten hierarchy and
// cannibalize each other (~15-30% of footer-button clicks would
// otherwise route through the higher-performing sticky).
//
// The footer's only jobs now:
//   1. Identity      (logo + dealer name, single lockup)
//   2. Mission       (one sentence signature under the wordmark)
//   3. Legal         (Privacy / Terms / Offer Disclosure + copyright)
//   4. One internal trust link (Customer Reviews)
//   5. Optional platform credit (AutoCurb.io) per resolved attribution
//
// EXPLICITLY EXCLUDED per product-owner direction:
//   * Phone number   — funnel off-ramp; appt time is given at booking
//   * Business hours — implies "drive to a dealership" frame
//   * Schedule a Visit / Our Locations / Quick Links grid — all
//     route the customer OUT of the form before they have an offer
//   * Referral Program — wrong audience pre-sale
//   * Sitemap link — vestigial exit surface
//   * Closing "Get my offer" button — cannibalizes the sticky pill
//
// Mission-line copy: "The modern way to sell your car." — intent-first
// pattern (Carvana cadence). Single sentence, present tense, no
// exclamation marks, no superlatives, no "no X / no Y" defensive
// posture. Tenant-overridable via site_config.brand_mission (string,
// optional column — falls back to the default if absent).
import { Link } from "react-router-dom";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const DEFAULT_MISSION = "The modern way to sell your car.";

const BrandFooter = () => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim();
  const showDealerName = dealerName && dealerName !== "Our Dealership";
  const year = new Date().getFullYear();

  // Per-tenant override hook. If the dealer hasn't set a brand_mission
  // (or the column doesn't exist), use the brand-voice default. We
  // intentionally do NOT fall back to `config.tagline` — the legacy
  // tagline default is "Sell Your Car The Easy Way" which is exactly
  // the DTC-promo copy the brand-voice agent diagnosed as off-brand.
  const mission =
    ((config as { brand_mission?: string }).brand_mission || "").trim() ||
    DEFAULT_MISSION;

  // Resolve platform attribution the same way SiteFooter does — a
  // super-admin force override always wins; otherwise the dealer's
  // white_label_settings dictate.
  const wl = config.white_label_settings as {
    hide_branding?: boolean;
    powered_by_mode?: "autocurb" | "dealer" | "hidden";
  } | null;
  const resolvedMode: "autocurb" | "dealer" | "hidden" =
    config.force_autocurb_attribution
      ? "autocurb"
      : wl?.powered_by_mode ?? (wl?.hide_branding ? "hidden" : "autocurb");

  return (
    <footer
      aria-labelledby="brand-footer-heading"
      className="border-t border-border/60 bg-background"
    >
      <h2 id="brand-footer-heading" className="sr-only">
        {showDealerName ? dealerName : "Site"} footer
      </h2>

      <div className="max-w-4xl mx-auto px-5 py-14 lg:py-16 text-center">
        {/* Identity lockup — logo if configured, else dealer name. */}
        {config.logo_url ? (
          <img
            src={config.logo_url}
            alt={showDealerName ? dealerName : "Logo"}
            className="h-10 lg:h-12 w-auto mx-auto mb-4 opacity-90"
            width={120}
            height={48}
            loading="lazy"
          />
        ) : showDealerName ? (
          <p className="text-lg font-semibold text-foreground tracking-tight mb-4">
            {dealerName}
          </p>
        ) : null}

        {/* Mission signature — one size step down from identity, ~70%
            opacity. Treated as signature, not paragraph. The footer
            ends here — no closing button. Sticky StickyOfferCTA pill
            (bottom-right) carries scroll-end conversion intent. */}
        <p className="text-base text-foreground/70 max-w-md mx-auto">
          {mission}
        </p>
      </div>

      {/* Hairline divider + legal row. Inline, muted, single line on
          desktop. */}
      <div className="border-t border-border/60 px-5 py-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>
            © {year} {showDealerName ? dealerName : "All rights reserved"}
          </span>
          <Link to="/reviews" className="hover:text-foreground transition-colors">
            Customer reviews
          </Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link to="/disclosure" className="hover:text-foreground transition-colors">
            Offer disclosure
          </Link>
          {resolvedMode === "autocurb" ? (
            <a
              href="https://autocurb.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              AutoCurb.io
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
};

export default BrandFooter;
