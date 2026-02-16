import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import SellCarForm from "@/components/SellCarForm";
import HowItWorks from "@/components/HowItWorks";
import ValueProps from "@/components/ValueProps";
import TrustBadges from "@/components/TrustBadges";
import CompetitorComparison from "@/components/CompetitorComparison";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import CTABanner from "@/components/CTABanner";
import SiteFooter from "@/components/SiteFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <SellCarForm />
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

export default Index;
