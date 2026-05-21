import SEO from "@/components/SEO";
import MotoDetailedFlow from "@/components/moto-detailed/MotoDetailedFlow";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import BrandStructuredData from "@/components/BrandStructuredData";
import type { JourneyPresetId } from "@/components/moto-detailed/presets";

/**
 * "Instant Offer — Detailed" landing template.
 *
 * Reads the dealer's saved journey preset + offer-timing from
 * site_config and renders MotoDetailedFlow accordingly. Falls back
 * to safe defaults so a half-provisioned tenant still gets a
 * working premium flow instead of a blank screen.
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
    </main>
  );
};

export default MotoDetailedTemplate;
