import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun, Crown, Menu, PanelLeft } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { ROLE_LABELS } from "@/lib/adminConstants";

interface AdminHeaderProps {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  userRole: string;
  onLogout: () => void;
  userName?: string;
  isPlatformAdmin?: boolean;
}

const AdminHeader = ({ darkMode, setDarkMode, userRole, onLogout, userName, isPlatformAdmin }: AdminHeaderProps) => {
  const { config } = useSiteConfig();
  const { toggleSidebar, isMobile } = useSidebar();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = userName?.split(" ")[0] || "";

  return (
    <header className="sticky top-0 z-50 shadow-lg overflow-hidden">
      {/* Premium gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.8)] to-[hsl(220,80%,12%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,hsl(var(--primary-foreground)/0.1)_50%,transparent_60%)] animate-[shimmer_8s_ease-in-out_infinite]" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent" />

      <div className="relative px-3 md:px-5 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-white/70 hover:text-white hover:bg-white/10 -ml-1 shrink-0 transition-colors h-7 w-7"
            aria-label="Toggle Sidebar"
          >
            {isMobile ? <Menu className="h-5 w-5" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          
          {config.logo_white_url ? (
            <img src={config.logo_white_url} alt="Dashboard" className="h-10 md:h-16 w-auto shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" />
          ) : (
            <span className="text-sm md:text-base font-bold text-white shrink-0">{config.dealership_name}</span>
          )}
          
          <div className="hidden sm:block h-8 w-px bg-white/15" />
          
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm md:text-lg font-semibold text-white tracking-tight">
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-medium border border-white/10">
                  {ROLE_LABELS[userRole] || userRole}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDarkMode(!darkMode)}
            className="text-white/60 hover:text-white hover:bg-white/10 px-2 transition-all"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-white/60 hover:text-white hover:bg-white/10 px-2 transition-all"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden md:inline ml-1">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
