import SEO from "@/components/SEO";
import { LocalBusinessJsonLd, FAQPageJsonLd, HowToJsonLd } from "@/components/JsonLd";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BackToTop from "@/components/BackToTop";
import LandingTemplateRouter from "@/components/landing/LandingTemplateRouter";
import NearestRooftopBanner from "@/components/NearestRooftopBanner";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useEmbedMode } from "@/hooks/useEmbedMode";

const Index = () => {
  const { config } = useSiteConfig();
  const embed = useEmbedMode();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Sell Your Car - Get Cash Offer in 2 Minutes | ${config.dealership_name}`}
        description={`Get a top-dollar cash offer for your car in 2 minutes. Free pickup, no obligation. ${config.dealership_name}.`}
        path="/"
      />
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
      {!embed && <SiteFooter />}
      {!embed && <BackToTop />}
    </div>
  );
};

export default Index;
