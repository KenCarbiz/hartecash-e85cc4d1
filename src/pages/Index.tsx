import { lazy, Suspense } from "react";
import SEO from "@/components/SEO";
import { LocalBusinessJsonLd, FAQPageJsonLd, HowToJsonLd } from "@/components/JsonLd";
import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import SellCarForm from "@/components/SellCarForm";
import SiteFooter from "@/components/SiteFooter";

import { useSiteConfig } from "@/hooks/useSiteConfig";
import HeroOffset from "@/components/HeroOffset";
import BackToTop from "@/components/BackToTop";

// Lazy-load below-fold sections for faster LCP
const HowItWorks = lazy(() => import("@/components/HowItWorks"));
const TrustBadges = lazy(() => import("@/components/TrustBadges"));
const CompetitorComparison = lazy(() => import("@/components/CompetitorComparison"));
const ValueProps = lazy(() => import("@/components/ValueProps"));
const Testimonials = lazy(() => import("@/components/Testimonials"));
const FAQ = lazy(() => import("@/components/FAQ"));
const CTABanner = lazy(() => import("@/components/CTABanner"));

const Index = () => {
  const { config } = useSiteConfig();
  const layout = config.hero_layout || "offset_right";

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
        <Suspense fallback={null}>
          <HowItWorks />
          <TrustBadges />
          <CompetitorComparison />
          <ValueProps />
          <Testimonials />
          <FAQ />
          <CTABanner />
        </Suspense>
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
};

export default Index;
