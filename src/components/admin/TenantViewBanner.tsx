import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Eye, LogOut, Clock } from "lucide-react";

/**
 * Sticky red banner that shows at the top of every admin page while
 * a Super Admin is in "View as Tenant" mode. Non-dismissible — the
 * only way to remove it is the Exit button, which closes the
 * tenant_view_log row and returns the session to the super admin's
 * own tenant.
 *
 * Not rendered at all when the context is in normal (non-override)
 * state, so this component is safe to always mount.
 */
export default function TenantViewBanner() {
  const { isViewingAsTenant, viewOverride, clearViewAsTenant } = useTenant();
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState("0m");

  useEffect(() => {
    if (!viewOverride) return;
    const update = () => {
      const started = new Date(viewOverride.started_at).getTime();
      const diffMs = Date.now() - started;
      const mins = Math.floor(diffMs / 60000);
      if (mins < 60) {
        setElapsed(`${mins}m`);
      } else {
        const hrs = Math.floor(mins / 60);
        const remainder = mins % 60;
        setElapsed(`${hrs}h ${remainder}m`);
      }
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [viewOverride]);

  if (!isViewingAsTenant || !viewOverride) return null;

  const handleExit = async () => {
    await clearViewAsTenant("manual");
    navigate("/super-admin");
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-[60] bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white shadow-lg shadow-red-900/20 border-b border-red-800/40"
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Eye className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                Super Admin View
              </span>
              <span className="text-[10px] font-semibold opacity-60">
                · Session active
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/10 border border-white/20 rounded-md px-1.5 py-0.5 tabular-nums">
                <Clock className="w-2.5 h-2.5" />
                {elapsed}
              </span>
            </div>
            <div className="text-sm font-bold truncate mt-0.5">
              Viewing{" "}
              <span className="underline decoration-white/40 underline-offset-2">
                {viewOverride.display_name}
              </span>
              <span className="text-[11px] font-normal opacity-70 ml-2">
                ({viewOverride.dealership_id})
              </span>
            </div>
            {viewOverride.reason && (
              <p className="text-[11px] opacity-80 truncate mt-0.5 italic">
                Reason: {viewOverride.reason}
              </p>
            )}
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleExit}
          className="shrink-0 bg-white text-red-700 hover:bg-white/90 font-bold gap-2 shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit Tenant View
        </Button>
      </div>
    </div>
  );
}
