import { useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserRound, CalendarCheck, FileText, ArrowLeftRight, Phone, Info, HelpCircle, TrendingUp, MessageSquare, Workflow, LogIn } from "lucide-react";
import logoFallback from "@/assets/logo-placeholder.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useLocationLogos } from "@/hooks/useLocationLogos";

const LANDING_ROUTES = ["/", "/trade", "/service", "/about", "/schedule"];

// Moto-template nav per the three-agent benchmark (PRs #263–#272
// design work). Four single-noun anchors + a "Sign In" link for
// returning customers. Each in-page anchor goes to /#section so the
// link works from any route — on the landing page browser scrolls
// smoothly, on /reviews etc. it routes to / and lands on the section.
const MOTO_NAV = [
  { hash: "how-it-works",   label: "How It Works" },
  { hash: "value-tracking", label: "Value Tracking" },
  { hash: "reviews",        label: "Reviews" },
  { hash: "faq",            label: "FAQ" },
];

const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const { config } = useSiteConfig();
  const logos = useLocationLogos();
  const location = useLocation();
  const navigate = useNavigate();

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

  // National-brand minimal nav on the Moto template. Other templates
  // keep the historical 5-item nav until they're individually
  // retooled — this scopes the change to the surface the design
  // review covered (Moto-template landing).
  const useMotoNav = config.landing_template === "moto";

  // Hash anchors need to work from any route. On the home page we
  // smooth-scroll without a route change; from /reviews etc. we
  // navigate to / and let the browser pick up the hash.
  const goToHash = (hash: string) => (e: React.MouseEvent) => {
    if (location.pathname === "/") {
      e.preventDefault();
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      e.preventDefault();
      navigate(`/#${hash}`);
    }
  };

  return (
    <header className="bg-card/95 backdrop-blur-md sticky top-0 z-50 shadow-[0_1px_3px_0_hsl(var(--foreground)/0.08),0_1px_2px_-1px_hsl(var(--foreground)/0.08)] border-b border-border/50">
      <div className="max-w-6xl mx-auto px-5 py-1.5">
        <div className="flex items-center justify-between">
          {/* Logo cluster */}
          <Link to="/" className={`flex ${isStacked ? "flex-col" : "flex-row items-center"} gap-2 group`}>
            {showCorporate && (
              <img
                src={corporateUrl!}
                alt="Corporate"
                className="h-[36px] md:h-[43px] w-auto object-contain"
              />
            )}
            <img
              src={logoSrc}
              alt={dealerName}
              className="h-[62px] md:h-[72px] w-auto transition-transform duration-300 group-hover:scale-[1.02]"
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

          {/* ── DESKTOP NAV ──────────────────────────────────────────── */}
          {useMotoNav ? (
            // Moto minimal: 4 single-noun anchors + Sign In separated
            // visually. Right-aligned, terminating at container edge.
            // Visual rules from the three-agent header benchmark:
            //   14px (text-sm), font-medium (~500), single near-black
            //   color, 32px (gap-8) between items, no caps, no
            //   separators. Sign In gets an extra ml-6 + thin vertical
            //   divider to read as a secondary-utility link.
            <nav className="hidden lg:flex items-center text-sm font-medium text-foreground">
              <div className="flex items-center gap-8">
                {MOTO_NAV.map((item) => (
                  <a
                    key={item.hash}
                    href={`/#${item.hash}`}
                    onClick={goToHash(item.hash)}
                    className="hover:text-primary transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <span className="mx-6 h-4 w-px bg-border/80" aria-hidden />
              <a
                href="/#find-offer"
                onClick={goToHash("find-offer")}
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" strokeWidth={2} />
                Sign In
              </a>
            </nav>
          ) : (
            // Historical nav — preserved unchanged for the 19 other
            // landing templates that still expect this set.
            <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold text-card-foreground">
              {[
                { href: "#compare", label: `Why ${dealerName.split(" ")[0]}`, isAnchor: true },
                { to: "/trade", label: "Trade-In" },
                { to: "/about", label: "About Us", scrollOnCurrent: true },
                { to: "/schedule", label: "Schedule a Visit" },
                { to: "/my-submission", label: "View My Offer" },
              ].map((item, i) => {
                const onCurrentPage = item.to && location.pathname === item.to;
                if (item.scrollOnCurrent && onCurrentPage) {
                  return (
                    <a
                      key={i}
                      href="#about-content"
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById("about-content")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="px-3 py-2 rounded-lg hover:bg-muted/70 hover:text-primary transition-all duration-200"
                    >
                      {item.label}
                    </a>
                  );
                }
                return item.isAnchor ? (
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
                );
              })}
            </nav>
          )}

          {/* ── MOBILE ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* Phone icon stays on the historical nav only. The Moto
                template treats the phone as a funnel off-ramp
                (consistent with footer + value-tracker decisions
                from the design review) — customers should go through
                the form, not pivot to a phone call. */}
            {!useMotoNav && config.phone && (
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
                aria-label="Menu"
                className="p-2.5 rounded-full hover:bg-muted/70 transition-colors active:scale-95"
                onClick={() => setOpen((v) => !v)}
              >
                <UserRound className="w-6 h-6 text-primary" />
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-card/95 backdrop-blur-xl rounded-xl shadow-[0_20px_60px_-15px_hsl(var(--foreground)/0.15)] border border-border/60 py-1.5 z-50 animate-scale-in">
                  {(useMotoNav
                    ? [
                        { hash: "how-it-works", icon: Workflow, label: "How It Works" },
                        { hash: "value-tracking", icon: TrendingUp, label: "Value Tracking" },
                        { hash: "reviews", icon: MessageSquare, label: "Reviews" },
                        { hash: "faq", icon: HelpCircle, label: "FAQ" },
                        { hash: "find-offer", icon: LogIn, label: "Sign In", separated: true },
                      ]
                    : [
                        { to: "/trade", icon: ArrowLeftRight, label: "Trade-In" },
                        { to: "/about", icon: Info, label: "About Us", scrollOnCurrent: true },
                        { to: "/my-submission", icon: FileText, label: "View My Offer" },
                        { to: "/schedule", icon: CalendarCheck, label: "Schedule a Visit" },
                      ]
                  ).map((item) => {
                    if ("hash" in item) {
                      return (
                        <a
                          key={item.hash}
                          href={`/#${item.hash}`}
                          onClick={(e) => {
                            setOpen(false);
                            goToHash(item.hash)(e);
                          }}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-card-foreground hover:bg-primary/5 hover:text-primary transition-all duration-150 mx-1.5 rounded-lg"
                        >
                          <item.icon className="w-4 h-4 text-primary/70" />
                          {item.label}
                        </a>
                      );
                    }
                    const onCurrentPage = location.pathname === item.to;
                    if ((item as { scrollOnCurrent?: boolean }).scrollOnCurrent && onCurrentPage) {
                      return (
                        <a
                          key={item.to}
                          href="#about-content"
                          onClick={(e) => {
                            e.preventDefault();
                            setOpen(false);
                            setTimeout(() => {
                              document.getElementById("about-content")?.scrollIntoView({ behavior: "smooth" });
                            }, 50);
                          }}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-card-foreground hover:bg-primary/5 hover:text-primary transition-all duration-150 mx-1.5 rounded-lg"
                        >
                          <item.icon className="w-4 h-4 text-primary/70" />
                          {item.label}
                        </a>
                      );
                    }
                    return (
                      <div key={item.to}>
                        {(item as { separated?: boolean }).separated && (
                          <div className="h-px bg-border/70 mx-3 my-1" />
                        )}
                        <Link
                          to={item.to!}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-card-foreground hover:bg-primary/5 hover:text-primary transition-all duration-150 mx-1.5 rounded-lg"
                          onClick={() => setOpen(false)}
                        >
                          <item.icon className="w-4 h-4 text-primary/70" />
                          {item.label}
                        </Link>
                      </div>
                    );
                  })}
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
