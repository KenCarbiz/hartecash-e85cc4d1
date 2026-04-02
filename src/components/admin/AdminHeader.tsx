import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import harteLogoWhiteFallback from "@/assets/harte-logo-white.png";
import { ROLE_LABELS } from "@/lib/adminConstants";
import { supabase } from "@/integrations/supabase/client";

interface AdminHeaderProps {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  userRole: string;
  onLogout: () => void;
}

const AdminHeader = ({ darkMode, setDarkMode, userRole, onLogout }: AdminHeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[hsl(210,100%,15%)] via-[hsl(210,100%,20%)] to-[hsl(220,80%,18%)] text-white shadow-lg">
      <div className="px-3 md:px-4 py-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <SidebarTrigger className="text-white/80 hover:text-white hover:bg-white/10 -ml-1 shrink-0" />
          <img src={harteLogoWhiteFallback} alt="Dashboard" className="h-12 md:h-20 w-auto shrink-0" />
          <div className="min-w-0">
            <span className="text-sm md:text-lg font-bold">Dashboard</span>
            <span className="hidden sm:inline ml-2 text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/90 font-medium">
              {ROLE_LABELS[userRole] || userRole}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDarkMode(!darkMode)}
            className="text-white/80 hover:text-white hover:bg-white/10 px-2"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-white/80 hover:text-white hover:bg-white/10 px-2"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden md:inline ml-1">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
