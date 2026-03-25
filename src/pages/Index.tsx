import SEO from "@/components/SEO";
import { LocalBusinessJsonLd, FAQPageJsonLd, HowToJsonLd } from "@/components/JsonLd";
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
import AboutBlurb from "@/components/AboutBlurb";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Sell Your Car - Get Cash Offer in 2 Minutes | Harte Auto Group"
        description="Get a top-dollar cash offer for your car in 2 minutes. Free pickup, no obligation. Harte Auto Group — trusted since 1952."
        path="/"
      />
      <LocalBusinessJsonLd />
      <FAQPageJsonLd />
      <HowToJsonLd />
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
        <AboutBlurb />
      </main>
      <SiteFooter />
    </div>
  );
};

export default Index;
