import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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

const FindOfferLean = lazy(() => import("@/components/moto-sections/FindOfferLean"));

const Index = () => {
  const { config } = useSiteConfig();
  const embed = useEmbedMode();
  const location = useLocation();
  const navigate = useNavigate();

  const isMoto = config.landing_template === "moto";

  // Hash-driven "Find Your Offer" view. The sticky header's Sign In
  // link sets the hash to #find-offer — we swap the <main> body
  // without unmounting the header/footer so the sticky bar never
  // flashes or "refreshes".
  const [showFindOffer, setShowFindOffer] = useState(location.hash === "#find-offer");
  useEffect(() => {
    const next = location.hash === "#find-offer";
    setShowFindOffer(next);
    if (next) window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.hash]);

  const exitFindOffer = () => navigate("/", { replace: false });

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
      {!embed && !showFindOffer && <NearestRooftopBanner />}
      <main>
        {showFindOffer ? (
          <Suspense fallback={<div className="min-h-[60vh]" />}>
            <div className="max-w-md mx-auto px-5 pt-6">
              <button
                onClick={exitFindOffer}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to home
              </button>
            </div>
            <FindOfferLean />
          </Suspense>
        ) : (
          <LandingTemplateRouter />
        )}
      </main>
      {!embed && (isMoto ? <BrandFooter /> : <SiteFooter />)}
      {!embed && <BackToTop />}
    </div>
  );
};

export default Index;
