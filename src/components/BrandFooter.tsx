// Unified closing slab for the Moto landing.
//
// Iteration history:
//   * PR #265: minimal footer (logo + mission + legal). Removed the
//     mid-page NAPFooter "Visit X" block.
//   * PR #266: cut the closing "Get my offer" button from inside
//     the footer — it cannibalized the StickyOfferCTA pill.
//   * (now): merged CTABannerLean's "Get started with a 30-second
//     valuation" closer INTO the footer. The previous separate
//     CTABannerLean + BrandFooter rendered as two padded blocks with
//     a tonal seam between them, which read as "page ended twice."
//     One continuous soft-gray slab now does the closing job:
//
//       ┌────────────────────────────────────────┐
//       │  See what {Dealer} will pay            │
//       │  for your car.                         │
//       │           [  Get my offer  ]           │  ← in-flow closer
//       │                                        │
//       │             [Dealer Logo]              │
//       │  The modern way to sell your car.      │  ← identity
//       │  ───────── hairline ─────────          │
//       │  © · Reviews · Privacy · Terms · …     │  ← legal
//       └────────────────────────────────────────┘
//
// Why a closing CTA can come back here without cannibalizing the
// sticky pill (which is still on screen at scroll-end):
//   * The previously-cut button was a CLONE of the sticky — same
//     label, same role. This one is reframed as a VALUE-PROP CLOSE
//     (outcome-focused headline + button) — different container,
//     different framing, different intent (deliberate end-of-content
//     decision vs mid-scroll utility).
//   * The CRO data agent's note: "Sticky ≠ scroll-end CTA in
//     function. Sticky serves mid-scroll impulse; in-flow block
//     serves deliberate end-of-content decision. Removing the
//     in-flow block typically costs 5-15% of bottom-page
//     conversions in tested DTC/auto funnels."
//
// EXPLICITLY EXCLUDED per product-owner direction:
//   * Phone number / business hours / NAP grid / Schedule-a-Visit
//   * Referral Program / Sitemap link
//
// Tone rules: no exclamation marks, no superlatives. Assert, don't
// reassure. One sentence per element.
//
// Per-tenant: dealership_name powers the CTA headline + copyright;
// site_config.brand_mission overrides the default mission line.
import { Link } from "react-router-dom";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { tenantLogoSrc } from "@/lib/tenantLogo";

const scrollToForm = () => {
  const form = document.getElementById("sell-car-form");
  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

const DEFAULT_MISSION = "The modern way to sell your car.";

const BrandFooter = () => {
  const { config } = useSiteConfig();
  const footerLogo = tenantLogoSrc(config);
  const dealerName = (config.dealership_name || "").trim();
  const showDealerName = dealerName && dealerName !== "Our Dealership";
  const year = new Date().getFullYear();

  // First word of the dealer name reads more like brand voice than
  // "Harte Auto Group" (e.g. "Harte" vs full legal name).
  const shortName = showDealerName ? dealerName.split(/\s+/)[0] : null;

  // CTA headline — outcome-framed per the CRO agent's call (banner
  // should be a value-prop close, not a second sticky). Falls back
  // gracefully when no dealer name is configured.
  const ctaHeadline = shortName
    ? `See what ${shortName} will pay for your car.`
    : "See what your car is worth.";

  // Mission line. Tenant-overridable via site_config.brand_mission.
  // Falls back to the brand-voice default — NOT to config.tagline,
  // whose legacy default ("Sell Your Car The Easy Way") is the
  // exact DTC-promo copy the brand-voice agent flagged.
  const mission =
    ((config as { brand_mission?: string }).brand_mission || "").trim() ||
    DEFAULT_MISSION;

  // Resolve platform attribution.
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
      className="border-t border-border/60"
      style={{ background: "hsl(220 14% 96%)" }}
    >
      <h2 id="brand-footer-heading" className="sr-only">
        {showDealerName ? dealerName : "Site"} footer
      </h2>

      {/* CTA close — value-prop framing + button. Sits inside the
          unified slab, not its own section, so there's no tonal
          seam between this and the identity block below. */}
      <div className="max-w-3xl mx-auto px-5 pt-20 lg:pt-24 pb-10 text-center">
        <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-foreground mb-8">
          {ctaHeadline}
        </h2>
        <button
          type="button"
          onClick={scrollToForm}
          className="inline-flex items-center justify-center px-10 py-4 bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:bg-primary/95 transition-colors"
        >
          Get my offer
        </button>
      </div>

      {/* Identity — logo + mission signature, no separator above
          (the slab is continuous). Reduced top padding pulls this
          tight under the CTA. */}
      <div className="max-w-4xl mx-auto px-5 pb-10 text-center">
        {footerLogo ? (
          <img
            src={footerLogo}
            alt={showDealerName ? dealerName : "Logo"}
            className="h-11 lg:h-[3.125rem] w-auto mx-auto mb-3 opacity-90"
            width={125}
            height={50}
            loading="lazy"
          />
        ) : showDealerName ? (
          <p className="text-base font-semibold text-foreground tracking-tight mb-3">
            {dealerName}
          </p>
        ) : null}
        <p className="text-sm text-foreground/70 max-w-md mx-auto">
          {mission}
        </p>
      </div>

      {/* Legal row. Hairline divider above is the only visual break
          inside the slab — the slab itself is one continuous
          background tone from CTA through legal. */}
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
