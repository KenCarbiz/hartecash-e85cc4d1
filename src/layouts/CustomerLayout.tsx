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
// Embed mode (?embed=true) keeps chrome stripped so the page can be
// iframed onto a dealer's existing site without nested headers.
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
      <Outlet />
      {!embed && (isMoto ? <BrandFooter /> : <SiteFooter />)}
      {!embed && <BackToTop />}
    </div>
  );
};

export default CustomerLayout;
