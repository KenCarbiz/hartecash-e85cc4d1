import { useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserRound, CalendarCheck, FileText, ArrowLeftRight, Phone, Info, ChevronDown } from "lucide-react";
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

  const rawLogoSrc = config.logo_url || logoFallback;
  // Serve a smaller, compressed version via Supabase image transforms to reduce LCP payload
  const logoSrc = rawLogoSrc.includes("supabase.co/storage/")
    ? `${rawLogoSrc}?width=200&resize=contain&quality=75&format=origin`
    : rawLogoSrc;
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
    <header className="bg-card/95 backdrop-blur-md sticky top-0 z-50 shadow-[0_1px_3px_0_hsl(var(--foreground)/0.08),0_1px_2px_-1px_hsl(var(--foreground)/0.08)] border-b border-border/50">
      <div className="max-w-6xl mx-auto px-5 py-2">
        <div className="flex items-center justify-between">
          {/* Logo cluster */}
          <Link to="/" className={`flex ${isStacked ? "flex-col" : "flex-row items-center"} gap-2 group`}>
            {showCorporate && (
              <img
                src={corporateUrl!}
                alt="Corporate"
                className="h-[40px] md:h-[48px] w-auto object-contain"
              />
            )}
            <img
              src={logoSrc}
              alt={dealerName}
              className="h-[72px] md:h-[84px] w-auto transition-transform duration-300 group-hover:scale-[1.02]"
              width={189}
              height={67}
              fetchPriority="high"
            />
            {secondaryUrl && (
              <img
                src={secondaryUrl}
                alt="Secondary"
                className="h-[36px] md:h-[44px] w-auto object-contain"
              />
            )}
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
          </Link>

          <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold text-card-foreground">
            {[
              { href: "#compare", label: `Why ${dealerName.split(" ")[0]}`, isAnchor: true },
              { to: "/trade", label: "Trade-In" },
              { to: "/about", label: "About Us" },
              { to: "/schedule", label: "Schedule a Visit" },
              { to: "/my-submission", label: "View My Offer" },
            ].map((item, i) =>
              item.isAnchor ? (
                <a
                  key={i}
                  href={item.href}
                  className="px-3 py-2 rounded-lg hover:bg-muted/70 hover:text-primary transition-all duration-200"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={i}
                  to={item.to!}
                  className="px-3 py-2 rounded-lg hover:bg-muted/70 hover:text-primary transition-all duration-200"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            {config.phone && (
              <a
                href={`tel:${config.phone.replace(/\D/g, "")}`}
                aria-label="Call us"
                className="p-2.5 rounded-full hover:bg-muted/70 transition-colors active:scale-95"
              >
                <Phone className="w-5 h-5 text-primary" />
              </a>
            )}
            <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
              <button
                aria-label="Customer menu"
                className="p-2.5 rounded-full hover:bg-muted/70 transition-colors active:scale-95"
                onClick={() => setOpen((v) => !v)}
              >
                <UserRound className="w-6 h-6 text-primary" />
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-card/95 backdrop-blur-xl rounded-xl shadow-[0_20px_60px_-15px_hsl(var(--foreground)/0.15)] border border-border/60 py-1.5 z-50 animate-scale-in">
                  {[
                    { to: "/trade", icon: ArrowLeftRight, label: "Trade-In" },
                    { to: "/about", icon: Info, label: "About Us" },
                    { to: "/my-submission", icon: FileText, label: "View My Offer" },
                    { to: "/schedule", icon: CalendarCheck, label: "Schedule a Visit" },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-card-foreground hover:bg-primary/5 hover:text-primary transition-all duration-150 mx-1.5 rounded-lg"
                      onClick={() => setOpen(false)}
                    >
                      <item.icon className="w-4 h-4 text-primary/70" />
                      {item.label}
                    </Link>
                  ))}
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
