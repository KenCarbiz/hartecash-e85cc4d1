import SEO from "@/components/SEO";
import { LocalBusinessJsonLd, FAQPageJsonLd, HowToJsonLd } from "@/components/JsonLd";
import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import SellCarForm from "@/components/SellCarForm";
import SiteFooter from "@/components/SiteFooter";
import HowItWorks from "@/components/HowItWorks";
import TrustBadges from "@/components/TrustBadges";
import CompetitorComparison from "@/components/CompetitorComparison";
import ValueProps from "@/components/ValueProps";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import CTABanner from "@/components/CTABanner";
import ReferralBanner from "@/components/ReferralBanner";

import { useSiteConfig } from "@/hooks/useSiteConfig";
import HeroOffset from "@/components/HeroOffset";
import BackToTop from "@/components/BackToTop";
import { useEmbedMode } from "@/hooks/useEmbedMode";

const Index = () => {
  const { config } = useSiteConfig();
  const embed = useEmbedMode();
  const layout = config.hero_layout || "offset_right";

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
          {layout === "offset_right" ? (
            <HeroOffset side="right" />
          ) : layout === "offset_left" ? (
            <HeroOffset side="left" />
          ) : (
            <>
              <Hero />
              <SellCarForm />
            </>
          )}
          <HowItWorks />
          <TrustBadges />
          <CompetitorComparison />
          <ValueProps />
          <Testimonials />
          <FAQ />
          <ReferralBanner />
          <CTABanner />
        </main>
      {!embed && <SiteFooter />}
      {!embed && <BackToTop />}
    </div>
  );
};

export default Index;
