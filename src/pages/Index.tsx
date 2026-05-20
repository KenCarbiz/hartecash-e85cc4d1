// Landing page content. SiteHeader / BrandFooter / SiteFooter /
// BackToTop now live in CustomerLayout (src/layouts/CustomerLayout.tsx)
// so they stay mounted across route changes to /reviews, /privacy,
// /terms, /disclosure. This page renders just the landing-specific
// pieces: SEO + JSON-LD, the NearestRooftopBanner (landing-only),
// and the Find-Offer hash-driven body swap below the sticky header.
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { LocalBusinessJsonLd, FAQPageJsonLd, HowToJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
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

  // Hash-driven "Find Your Offer" view. The sticky header's Sign In
  // link sets the hash to #find-offer — we swap the <main> body
  // without unmounting the header/footer so the sticky bar never
  // flashes or "refreshes". (Same effect now extends to footer
  // links across the landing/legal/reviews set via CustomerLayout.)
  const [showFindOffer, setShowFindOffer] = useState(location.hash === "#find-offer");
  useEffect(() => {
    const next = location.hash === "#find-offer";
    setShowFindOffer(next);
    if (next) window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.hash]);

  const exitFindOffer = () => navigate("/", { replace: false });

  return (
    <>
      <SEO
        title={`Sell Your Car for Cash in 2 Minutes | ${config.dealership_name}`}
        description={`Get a top-dollar cash offer for your car in 2 minutes. Free pickup, no obligation. ${config.dealership_name}.`}
        path="/"
      />
      <WebSiteJsonLd />
      <LocalBusinessJsonLd />
      <FAQPageJsonLd />
      <HowToJsonLd />
      {!embed && !showFindOffer && <NearestRooftopBanner />}
      <main className="flex-1">
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
    </>
  );
};

export default Index;
