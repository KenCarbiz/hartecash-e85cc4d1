import SEO from "@/components/SEO";
import SiteHeader from "@/components/SiteHeader";
import TradeHero from "@/components/TradeHero";
import SellCarForm from "@/components/SellCarForm";
import HowItWorks from "@/components/HowItWorks";
import ValueProps from "@/components/ValueProps";
import TrustBadges from "@/components/TrustBadges";
import CompetitorComparison from "@/components/CompetitorComparison";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import CTABanner from "@/components/CTABanner";
import SiteFooter from "@/components/SiteFooter";

const TradeLanding = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <TradeHero />
        <SellCarForm leadSource="trade" />
        <HowItWorks />
        <TrustBadges />
        <CompetitorComparison />
        <ValueProps />
        <Testimonials />
        <FAQ />
        <CTABanner />
      </main>
      <SiteFooter />
    </div>
  );
};

export default TradeLanding;
