// Shared customer-facing layout — hoists SiteHeader and the
// template-aware footer (BrandFooter for Moto / SiteFooter for the
// rest) out of individual page components so they stay mounted
// across route changes. Without this, clicking a footer link from
// the landing to /privacy (or between any two legal pages) would
// unmount the SiteHeader from the source page and remount it on
// the destination page — the customer reads that visual swap as
// "the whole page refreshed."
//
// React Router renders the page component into the <Outlet />. Only
// the slot under the header changes between route transitions; the
// header, footer, and back-to-top stay put.
//
// CRITICAL: the inner Suspense around <Outlet /> is what keeps the
// sticky header mounted while a destination page's lazy chunk
// downloads. Every page on this router is React.lazy(...), and
// without an inner Suspense the closest fallback boundary is the
// outer one in App.tsx (AnimatedRoutes), which sits ABOVE this
// layout — when the destination page suspends, that outer fallback
// replaces the entire layout subtree (header + footer included)
// with null, then re-mounts everything once the chunk arrives.
// Catching the suspension inside the layout means only the body
// area goes blank for the (usually invisible) chunk load.
//
// Embed mode (?embed=true) keeps chrome stripped so the page can be
// iframed onto a dealer's existing site without nested headers.
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BrandFooter from "@/components/BrandFooter";
import BackToTop from "@/components/BackToTop";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useEmbedMode } from "@/hooks/useEmbedMode";

const CustomerLayout = () => {
  const { config } = useSiteConfig();
  const embed = useEmbedMode();
  const isMoto = config.landing_template === "moto";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Skip-link lives in App.tsx so it stays focusable across
          every route, including non-CustomerLayout routes. */}
      {!embed && <SiteHeader />}
      <Suspense fallback={<div className="flex-1" aria-hidden="true" />}>
        <Outlet />
      </Suspense>
      {!embed && (isMoto ? <BrandFooter /> : <SiteFooter />)}
      {!embed && <BackToTop />}
    </div>
  );
};

export default CustomerLayout;

