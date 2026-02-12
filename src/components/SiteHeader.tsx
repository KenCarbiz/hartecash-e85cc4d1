import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { UserRound, CalendarCheck, FileText } from "lucide-react";
import harteLogo from "@/assets/harte-logo.png";

const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  const show = () => { clearTimeout(timeout.current); setOpen(true); };
  const hide = () => { timeout.current = setTimeout(() => setOpen(false), 200); };

  return (
    <header className="bg-card sticky top-0 z-50 shadow-md">
      <div className="max-w-[500px] mx-auto px-5 py-3">
        <div className="flex items-center justify-between">
          <img src={harteLogo} alt="Harte Auto Group" className="h-24 md:h-28 w-auto" width={317} height={112} fetchPriority="high" />

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
    </header>
  );
};

export default SiteHeader;
