import { useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserRound, CalendarCheck, FileText, ArrowLeftRight, Phone, Info } from "lucide-react";
import logoFallback from "@/assets/logo-placeholder.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useLocationLogos } from "@/hooks/useLocationLogos";

const LANDING_ROUTES = ["/", "/trade", "/service", "/about", "/schedule"];

const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const { config } = useSiteConfig();
  const logos = useLocationLogos();
  const location = useLocation();

  const show = () => { clearTimeout(timeout.current); setOpen(true); };
  const hide = () => { timeout.current = setTimeout(() => setOpen(false), 200); };

  const logoSrc = config.logo_url || logoFallback;
  const dealerName = config.dealership_name || "Our Dealership";

  const isLandingPage = LANDING_ROUTES.includes(location.pathname);
  const isDark = document.documentElement.classList.contains("dark");
  const corporateUrl = isDark ? (logos.corporate_logo_url || logos.corporate_logo_dark_url) : (logos.corporate_logo_dark_url || logos.corporate_logo_url);
  const showCorporate = logos.show_corporate_logo && corporateUrl &&
    (!logos.show_corporate_on_landing_only || isLandingPage);
  const secondaryUrl = isDark ? (logos.secondary_logo_url || logos.secondary_logo_dark_url) : (logos.secondary_logo_dark_url || logos.secondary_logo_url);
  const hasOemLogos = logos.oem_logo_urls && logos.oem_logo_urls.length > 0;
  const isStacked = logos.logo_layout === "stacked";

  return (
    <header className="bg-card sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-5 py-2">
        <div className="flex items-center justify-between">
          {/* Logo cluster */}
          <div className={`flex ${isStacked ? "flex-col" : "flex-row items-center"} gap-2`}>
            {/* Corporate logo */}
            {showCorporate && (
              <img
                src={corporateUrl!}
                alt="Corporate"
                className="h-[40px] md:h-[48px] w-auto object-contain"
              />
            )}
            {/* Main dealership logo */}
            <img src={logoSrc} alt={dealerName} className="h-[72px] md:h-[84px] w-auto" width={317} height={112} fetchPriority="high" />
            {/* Secondary logo */}
            {secondaryUrl && (
              <img
                src={secondaryUrl}
                alt="Secondary"
                className="h-[36px] md:h-[44px] w-auto object-contain"
              />
            )}
            {/* OEM brand logos */}
            {hasOemLogos && (
              <div className="flex items-center gap-1.5">
                {logos.oem_logo_urls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Brand ${i + 1}`}
                    className="h-[28px] md:h-[36px] w-auto object-contain"
                  />
                ))}
              </div>
            )}
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-card-foreground">
            <a href="#compare" className="hover:text-accent transition-colors">Why {dealerName.split(" ")[0]}</a>
            <Link to="/trade" className="hover:text-accent transition-colors">Trade-In</Link>
            <Link to="/about" className="hover:text-accent transition-colors">About Us</Link>
            <Link to="/schedule" className="hover:text-accent transition-colors">Schedule a Visit</Link>
            <Link to="/my-submission" className="hover:text-accent transition-colors">View My Offer</Link>
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            {config.phone && (
              <a
                href={`tel:${config.phone.replace(/\D/g, "")}`}
                aria-label="Call us"
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <Phone className="w-5 h-5 text-primary" />
              </a>
            )}
          <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
            <button
              aria-label="Customer menu"
              className="p-2 rounded-full hover:bg-muted transition-colors"
              onClick={() => setOpen((v) => !v)}
            >
              <UserRound className="w-6 h-6 text-primary" />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-card rounded-xl shadow-lg border border-border py-2 z-50">
                <Link
                  to="/trade"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <ArrowLeftRight className="w-4 h-4 text-accent" />
                  Trade-In
                </Link>
                <Link
                  to="/about"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <Info className="w-4 h-4 text-accent" />
                  About Us
                </Link>
                <Link
                  to="/my-submission"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <FileText className="w-4 h-4 text-accent" />
                  View My Offer
                </Link>
                <Link
                  to="/schedule"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <CalendarCheck className="w-4 h-4 text-accent" />
                  Schedule a Visit
                </Link>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
