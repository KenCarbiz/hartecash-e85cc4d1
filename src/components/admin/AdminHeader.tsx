import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun, Crown, Menu, PanelLeft } from "lucide-react";
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

  return (
    <header
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
        className="relative px-3 md:px-5 py-2 flex items-center justify-between gap-2"
        style={{ minHeight: `${topBarHeight}px` }}
      >
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
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
              <span className="text-sm md:text-lg font-semibold tracking-tight" style={{ color: topBarText }}>
                {firstName ? `${greeting}, ${firstName}` : "Dashboard"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {isPlatformAdmin && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  <Crown className="w-2.5 h-2.5" />
                  SUPER ADMIN
                </span>
              )}
              {!isPlatformAdmin && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                  style={{
                    background: `${topBarText}1a`,
                    color: `${topBarText}b3`,
                    borderColor: `${topBarText}1a`,
                  }}
                >
                  {ROLE_LABELS[userRole] || userRole}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {/* Dealer name + plan badge (desktop) */}
          {(dealerName || currentBundle) && (
            <div
              className="hidden md:flex items-center gap-2 pr-2 mr-1 border-r"
              style={{ borderColor: `${topBarText}1a` }}
            >
              {dealerName && (
                <span
                  className="text-[11px] font-medium truncate max-w-[160px]"
                  style={{ color: `${topBarText}99` }}
                >
                  {dealerName}
                </span>
              )}
              {currentBundle && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-5 px-2 font-semibold uppercase tracking-wider"
                  style={{
                    borderColor: `${topBarText}33`,
                    color: `${topBarText}cc`,
                    background: `${topBarText}14`,
                  }}
                >
                  {currentBundle.name}
                </Badge>
              )}
            </div>
          )}

          {/* App switcher — primary cross-product nav */}
          <AppSwitcher currentApp="autocurb" />

          <div className="hidden sm:block h-5 w-px mx-0.5" style={{ background: `${topBarText}26` }} />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDarkMode(!darkMode)}
            className="hover:bg-white/10 px-2 transition-all"
            style={{ color: `${topBarText}99` }}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {/* Staff-side push-notification toggle. Compact rendering so
               it sits neatly in the header; full-width version ships
               in the staff profile page later. */}
          <PushNotificationToggle compact />
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="hover:bg-white/10 px-2 transition-all"
            style={{ color: `${topBarText}99` }}
          >
            <LogOut className="w-4 h-4" /> <span className="hidden md:inline ml-1">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
