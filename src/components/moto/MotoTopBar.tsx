import { Menu } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Minimal top bar for the standalone /sell microsite:
 * dealer logo on the left, hamburger (decorative for now) on the right.
 * Rendered only when NOT iframed — when the dealer embeds /sell on
 * their own site, MotoShell hides this so the host page's chrome wraps.
 */
const MotoTopBar = () => {
  const { config } = useSiteConfig();
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt={config.dealership_name || "Dealer"}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <span className="text-base font-bold tracking-tight text-zinc-900">
              {config.dealership_name || "Sell Your Car"}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="Menu"
          className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};

export default MotoTopBar;
