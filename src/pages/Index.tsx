import SEO from "@/components/SEO";
import { LocalBusinessJsonLd, FAQPageJsonLd, HowToJsonLd } from "@/components/JsonLd";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BackToTop from "@/components/BackToTop";
import LandingTemplateRouter from "@/components/landing/LandingTemplateRouter";
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
      <main>
        <LandingTemplateRouter />
      </main>
      {!embed && <SiteFooter />}
      {!embed && <BackToTop />}
    </div>
  );
};

export default Index;
