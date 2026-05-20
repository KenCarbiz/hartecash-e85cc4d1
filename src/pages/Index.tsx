import SEO from "@/components/SEO";
import { LocalBusinessJsonLd, FAQPageJsonLd, HowToJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BrandFooter from "@/components/BrandFooter";
import BackToTop from "@/components/BackToTop";
import LandingTemplateRouter from "@/components/landing/LandingTemplateRouter";
import NearestRooftopBanner from "@/components/NearestRooftopBanner";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useEmbedMode } from "@/hooks/useEmbedMode";

const Index = () => {
  const { config } = useSiteConfig();
  const embed = useEmbedMode();

  // The Moto template uses the new minimal BrandFooter (one row of
  // identity + mission + last-CTA + legal). Every other template
  // keeps the existing 3-column SiteFooter — they're styled to
  // expect it and changing them is out of scope here.
  const isMoto = config.landing_template === "moto";

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Sell Your Car for Cash in 2 Minutes | ${config.dealership_name}`}
        description={`Get a top-dollar cash offer for your car in 2 minutes. Free pickup, no obligation. ${config.dealership_name}.`}
        path="/"
      />
      <WebSiteJsonLd />
      <LocalBusinessJsonLd />
      <FAQPageJsonLd />
      <HowToJsonLd />
      {!embed && <SiteHeader />}
      {/* Geo banner only renders on the corporate group hub (location_id null
          AND multiple rooftops with their own URLs). It self-hides on
          rooftop-specific pages, on single-location dealers, and once the
          customer dismisses it for the session. */}
      {!embed && <NearestRooftopBanner />}
      <main>
        <LandingTemplateRouter />
      </main>
      {!embed && (isMoto ? <BrandFooter /> : <SiteFooter />)}
      {!embed && <BackToTop />}
    </div>
  );
};

export default Index;
