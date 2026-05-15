import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Mobile-first sticky action bar. Pins the active step's primary CTA
 * (and any secondary action) to the bottom of the viewport so the
 * "Next" button never scrolls out of reach — important on tall step
 * cards (search with cascading dropdowns, offer reveal, photos
 * uploader).
 *
 * Constrained to the same max-width as MotoShell's main column and
 * inherits its own safe-area padding so the home-bar / notch on iOS
 * doesn't eat the tap target.
 */
const MotoStickyFooter = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur",
      "px-4 pt-3",
      "pb-[max(env(safe-area-inset-bottom),0.75rem)]",
      className,
    )}
  >
    <div className="mx-auto max-w-screen-sm">{children}</div>
  </div>
);

export default MotoStickyFooter;
