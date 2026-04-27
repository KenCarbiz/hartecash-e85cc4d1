import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun, Crown, Menu, PanelLeft, Bell, Search } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { ROLE_LABELS } from "@/lib/adminConstants";
import PushNotificationToggle from "@/components/admin/PushNotificationToggle";
import AppSwitcher from "@/components/platform/AppSwitcher";
import { usePlatform } from "@/contexts/PlatformContext";
import { Badge } from "@/components/ui/badge";

interface AdminHeaderProps {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  userRole: string;
  onLogout: () => void;
  userName?: string;
  isPlatformAdmin?: boolean;
  dealerName?: string;
}

/**
 * Build a CSS background string for the header based on top_bar_style + colors.
 *
 * Styles supported (matches Admin Refresh.html mockup):
 *   - "solid"             → flat top_bar_bg
 *   - "gradient"          → 90deg gradient bg → bg2
 *   - "gradient-diagonal" → 135deg gradient bg → bg2
 *   - "gradient-3stop"    → Hartecash-style 3-stop fade of bg over bg2
 */
const buildHeaderBackground = (
  style: string,
  bg: string,
  bg2: string,
): string => {
  switch (style) {
    case "gradient":
      return `linear-gradient(90deg, ${bg} 0%, ${bg2} 100%)`;
    case "gradient-diagonal":
      return `linear-gradient(135deg, ${bg} 0%, ${bg2} 100%)`;
    case "gradient-3stop":
      // Hartecash signature — bg fades over bg2 base
      return `${bg2} linear-gradient(to right, ${bg} 0%, ${bg}cc 50%, ${bg}99 100%)`;
    case "solid":
    default:
      return bg;
  }
};

const AdminHeader = ({ darkMode, setDarkMode, userRole, onLogout, userName, isPlatformAdmin, dealerName }: AdminHeaderProps) => {
  const { config } = useSiteConfig();
  const { toggleSidebar, isMobile } = useSidebar();
  const { subscription, bundles } = usePlatform();
  const currentBundle = bundles.find((b) => b.id === subscription?.bundle_id);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = userName?.split(" ")[0] || "";

  // New top-bar config fields (from Step 6 migration)
  const topBarStyle = (config as any).top_bar_style || "solid";
  const topBarBg = (config as any).top_bar_bg || "#00407f";
  const topBarBg2 = (config as any).top_bar_bg_2 || "#005bb5";
  const topBarText = (config as any).top_bar_text || "#ffffff";
  const topBarHeight = Number((config as any).top_bar_height ?? 64);
  const topBarShimmer = (config as any).top_bar_shimmer ?? true;
  const topBarShimmerStyle = (config as any).top_bar_shimmer_style || "sheen";
  const topBarShimmerSpeed = Number((config as any).top_bar_shimmer_speed ?? 3.2);

  const headerBackground = buildHeaderBackground(topBarStyle, topBarBg, topBarBg2);

  // Shimmer overlay — only render if enabled and user hasn't requested reduced motion.
  // The CSS prefers-reduced-motion check is also applied via media query at the
  // animation level (animation-duration becomes 0 below).
  const shimmerOverlay = topBarShimmer ? (
    <div
      className="absolute inset-0 pointer-events-none motion-reduce:hidden"
      style={
        topBarShimmerStyle === "hartecash"
          ? {
              background:
                "linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
              animation: `shimmer ${topBarShimmerSpeed}s ease-in-out infinite`,
            }
          : {
              background:
                "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.10) 50%, transparent 60%)",
              animation: `shimmer ${Math.max(topBarShimmerSpeed * 2, 6)}s ease-in-out infinite`,
            }
      }
    />
  ) : null;

  // Initials for the avatar pill (right cluster).
  const initials = (userName || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("") || "?";

  const roleLabel = ROLE_LABELS[userRole] || userRole;

  // Click/focus on the search input opens the existing AdminCommandPalette
  // by dispatching a synthetic ⌘K keydown — same path the breadcrumb kbd uses
  // in AdminDashboard.tsx. Keeps a single source of truth for global search.
  const openCommandPalette = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <header
      data-admin-topbar
      className="sticky top-0 z-50 shadow-lg overflow-hidden"
      style={{
        background: headerBackground,
        color: topBarText,
        minHeight: `${topBarHeight}px`,
      }}
    >
      {shimmerOverlay}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${topBarText}33, transparent)` }}
      />

      <div
        className="relative px-3 md:px-5 py-2 flex items-center gap-3 md:gap-4"
        style={{ minHeight: `${topBarHeight}px` }}
      >
        {/* ── LEFT CLUSTER ── sidebar toggle, brand mark, greeting + role pill */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hover:bg-white/10 -ml-1 shrink-0 transition-colors h-7 w-7"
            style={{ color: `${topBarText}b3` }}
            aria-label="Toggle Sidebar"
          >
            {isMobile ? <Menu className="h-5 w-5" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          
          {config.logo_white_url ? (
            <img src={config.logo_white_url} alt="Dashboard" className="h-10 md:h-16 w-auto shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" />
          ) : (
            <span className="text-sm md:text-base font-bold shrink-0" style={{ color: topBarText }}>
              {config.dealership_name}
            </span>
          )}
          
          <div className="hidden sm:block h-8 w-px" style={{ background: `${topBarText}26` }} />
          
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm md:text-[22px] leading-tight font-semibold tracking-tight" style={{ color: topBarText }}>
                {firstName ? `${greeting}, ${firstName}` : "Dashboard"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isPlatformAdmin && (
                <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  <Crown className="w-2.5 h-2.5" />
                  SUPER ADMIN
                </span>
              )}
              {!isPlatformAdmin && (
                <span
                  className="text-[12px] px-2 py-0.5 rounded-full font-medium border w-fit"
                  style={{
                    background: `${topBarText}1a`,
                    color: `${topBarText}b3`,
                    borderColor: `${topBarText}1a`,
                  }}
                >
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* ── CENTER ── global search (opens command palette) + dealer name beneath */}
        <div className="hidden md:flex flex-1 min-w-0 items-center justify-center">
          <div className="w-full max-w-xl flex flex-col items-center gap-0.5">
            <div className="relative w-full">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: `${topBarText}80` }}
              />
              <input
                readOnly
                placeholder="Search leads, VIN, plate…"
                onClick={openCommandPalette}
                onFocus={openCommandPalette}
                className="w-full h-9 pl-9 pr-14 text-[13px] rounded-lg outline-none cursor-pointer transition-colors"
                style={{
                  background: `${topBarText}14`,
                  border: `1px solid ${topBarText}26`,
                  color: topBarText,
                }}
                aria-label="Open command palette"
              />
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: `${topBarText}1a`,
                  color: `${topBarText}b3`,
                  border: `1px solid ${topBarText}26`,
                }}
              >
                ⌘K
              </span>
            </div>
            {(dealerName || currentBundle) && (
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: `${topBarText}99` }}>
                {dealerName && <span className="truncate max-w-[200px]">{dealerName}</span>}
                {currentBundle && (
                  <>
                    {dealerName && <span style={{ color: `${topBarText}66` }}>·</span>}
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 px-1.5 font-semibold uppercase tracking-wider"
                      style={{
                        borderColor: `${topBarText}33`,
                        color: `${topBarText}cc`,
                        background: `${topBarText}14`,
                      }}
                    >
                      {currentBundle.name}
                    </Badge>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT CLUSTER ── AppSwitcher → dark/light → bell → push → avatar+name → logout */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0 ml-auto md:ml-0">
          {/* AutoCurb cross-product switcher */}
          <AppSwitcher currentApp="autocurb" />

          {/* Dark / light toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="h-9 w-9 hover:bg-white/10 transition-all"
            style={{ color: `${topBarText}b3` }}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* Bell + notification dot. Push-toggle UI lives in staff profile;
               here we just expose the bell affordance. The dot is a static
               visual indicator until a real unread-count source is wired. */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-white/10 transition-all"
              style={{ color: `${topBarText}b3` }}
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Button>
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: "hsl(var(--destructive))", boxShadow: `0 0 0 2px ${topBarBg}` }}
              aria-hidden
            />
          </div>

          {/* Hidden push-notification toggle stays mounted so the
               useEffect logic that subscribes to push events keeps firing.
               The visible bell above is the user-facing affordance. */}
          <div className="sr-only">
            <PushNotificationToggle compact />
          </div>

          {/* Role pill (right side, mockup spec). Mirrors the left-side
               role label but lives in the right cluster as a quick visual
               anchor for the avatar block. */}
          <span
            className="hidden md:inline-flex items-center text-[12px] h-9 px-3 rounded-full font-medium border"
            style={{
              background: `${topBarText}14`,
              color: `${topBarText}cc`,
              borderColor: `${topBarText}26`,
            }}
          >
            {roleLabel}
          </span>

          {/* Avatar + name */}
          <div
            className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l"
            style={{ borderColor: `${topBarText}26` }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
              style={{
                background: `${topBarText}1f`,
                color: topBarText,
                border: `1px solid ${topBarText}26`,
              }}
              aria-hidden
            >
              {initials}
            </div>
            <div className="leading-tight">
              <div className="text-[12px] font-medium" style={{ color: topBarText }}>
                {firstName || "Staff"}
              </div>
              <div className="text-[10px]" style={{ color: `${topBarText}99` }}>
                {roleLabel}
              </div>
            </div>
          </div>

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="h-9 px-2 hover:bg-white/10 transition-all"
            style={{ color: `${topBarText}b3` }}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline ml-1.5 text-[12px]">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
