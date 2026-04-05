import SEO from "@/components/SEO";
import SiteHeader from "@/components/SiteHeader";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import HeroOffset from "@/components/HeroOffset";
import HowItWorks from "@/components/HowItWorks";
import ValueProps from "@/components/ValueProps";
import TrustBadges from "@/components/TrustBadges";
import CompetitorComparison from "@/components/CompetitorComparison";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import CTABanner from "@/components/CTABanner";
import ReferralBanner from "@/components/ReferralBanner";
import SiteFooter from "@/components/SiteFooter";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const TradeLanding = () => {
  const { config } = useSiteConfig();
  const embed = useEmbedMode();
  const layout = config.hero_layout || "offset_right";

  const tradeHeadline = config.trade_hero_headline || "Submit Your Trade-In Info";
  const tradeSubtext = config.trade_hero_subtext || "Already shopping with us? Send us your trade details from home — we'll have your value ready.";

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Submit Your Trade-In Info | ${config.dealership_name}`}
        description={`Already shopping with us? Submit your trade-in details from home and get your vehicle value ready before you arrive at ${config.dealership_name}.`}
        path="/trade"
      />
      <SiteHeader />
      <main>
        {layout === "offset_right" ? (
          <HeroOffset side="right" leadSource="trade" headlineOverride={tradeHeadline} subtextOverride={tradeSubtext} />
        ) : layout === "offset_left" ? (
          <HeroOffset side="left" leadSource="trade" headlineOverride={tradeHeadline} subtextOverride={tradeSubtext} />
        ) : (
          <HeroOffset side="right" leadSource="trade" headlineOverride={tradeHeadline} subtextOverride={tradeSubtext} />
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
      <SiteFooter />
    </div>
  );
};

export default TradeLanding;
