import SEO from "@/components/SEO";
import MotoDetailedFlow from "@/components/moto-detailed/MotoDetailedFlow";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import BrandStructuredData from "@/components/BrandStructuredData";
import { MotoBelowFold, MotoMobileBelowFold } from "../sharedSections";
import StickyOfferCTA from "@/components/moto-sections/StickyOfferCTA";
import type { JourneyPresetId } from "@/components/moto-detailed/presets";

/**
 * "Instant Offer — Detailed" landing template.
 *
 * Reads the dealer's saved journey preset + offer-timing from
 * site_config and renders MotoDetailedFlow accordingly. Falls back
 * to safe defaults so a half-provisioned tenant still gets a
 * working premium flow instead of a blank screen.
 *
 * Below-fold chrome mirrors MotoTemplate (the original Instant Offer)
 * — both should present the same landing page experience and only
 * differ in the appraisal flow itself. Per product-owner direction
 * ("the new Detail version is missing all the lower information on
 * the landing page that's there for the earlier version — please
 * make them the same").
 *
 * DESKTOP (md+) — 4 sections: HowItWorks → ValueTracker → FAQ → CTA
 * MOBILE (<md)  — 3 sections (watered-down): HowItWorks → FAQ → CTA
 *
 * StickyOfferCTA is desktop-only; mobile gets the in-flow CTAs from
 * MotoShell so adding another floating pill would break thumb-zone
 * ergonomics.
 *
 * Footer is owned by Index.tsx (BrandFooter for Moto templates,
 * SiteFooter elsewhere) — mounting one here would double-render.
 */
const MotoDetailedTemplate = () => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim();
  const h1 = dealerName && dealerName !== "Our Dealership"
    ? `Sell Your Car — Instant Valuation from ${dealerName}`
    : "Sell Your Car — Instant Vehicle Valuation";

  const preset: JourneyPresetId =
    (config.moto_detailed_preset as JourneyPresetId) || "moto_detailed";
  const offerMode = config.moto_detailed_offer_display_mode || "after_contact_info";

  return (
    <main>
      <h1 className="sr-only">{h1}</h1>
      <BrandStructuredData faqVariant="moto" />
      <SEO
        title={`Get an Instant Vehicle Valuation | ${config.dealership_name}`}
        description={`Get a guided, premium offer from ${config.dealership_name}. See your estimated value in seconds.`}
        path="/sell"
      />
      <MotoDetailedFlow preset={preset} offerDisplayMode={offerMode} />

      {/* Below-fold chrome — same set as MotoTemplate so the two
          journeys present an identical landing experience. */}
      <div className="hidden md:block bg-background">
        <MotoBelowFold />
      </div>
      <div className="md:hidden bg-background">
        <MotoMobileBelowFold />
      </div>

      {/* Sticky desktop pill — second-look visitor scrolling back up
          is never more than one click from the form. */}
      <StickyOfferCTA />
    </main>
  );
};

export default MotoDetailedTemplate;
