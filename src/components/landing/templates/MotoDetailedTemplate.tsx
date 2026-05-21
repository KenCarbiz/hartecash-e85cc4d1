import SEO from "@/components/SEO";
import MotoDetailedFlow from "@/components/moto-detailed/MotoDetailedFlow";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import BrandStructuredData from "@/components/BrandStructuredData";

/**
 * "Instant Offer — Detailed" landing template.
 *
 * Mounts the premium guided MotoDetailedFlow journey (left rail on
 * desktop, top stepper on mobile, live valuation right-rail). The
 * underlying journey is a modular engine driven by JourneyConfig —
 * dealers can pick a preset, switch offer timing, or supply a fully
 * custom step order without touching template code.
 *
 * The original "moto" template is unchanged; this is a sibling, not
 * a replacement.
 */
const MotoDetailedTemplate = () => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim();
  const h1 = dealerName && dealerName !== "Our Dealership"
    ? `Sell Your Car — Instant Valuation from ${dealerName}`
    : "Sell Your Car — Instant Vehicle Valuation";

  const offerMode =
    ((config as any).moto_detailed_offer_display_mode as
      | "before_contact_info"
      | "after_contact_info"
      | undefined) ?? "after_contact_info";

  return (
    <main>
      <h1 className="sr-only">{h1}</h1>
      <BrandStructuredData faqVariant="moto" />
      <SEO
        title={`Get an Instant Vehicle Valuation | ${config.dealership_name}`}
        description={`Get a guided, premium offer from ${config.dealership_name}. See your estimated value in seconds.`}
        path="/sell"
      />
      <MotoDetailedFlow offerDisplayMode={offerMode} />
    </main>
  );
};

export default MotoDetailedTemplate;
