import type { ReactNode } from "react";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import MotoDisclosureBar from "./MotoDisclosureBar";
import HeroTuner from "./HeroTuner";

/**
 * The standalone microsite wrapper. The site-wide SiteHeader supplies
 * the top chrome on the root landing page, so MotoShell no longer
 * renders its own MotoTopBar (which duplicated the logo + hamburger
 * + divider line above the hero). When iframed (?embed=true) the
 * disclosure bar is also stripped so the host page's chrome wraps.
 */
const MotoShell = ({ children }: { children: ReactNode }) => {
  const embed = useEmbedMode();
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Bottom padding reserves room for the fixed MotoStickyFooter
          (~96px button + safe-area) so the sticky CTA never sits on
          top of the disclosure bar or the Track-Value card. */}
      <main className="mx-auto max-w-screen-sm px-4 pb-[120px] pt-[112px]">{children}</main>
      {!embed && <MotoDisclosureBar />}
      <HeroTuner />
    </div>
  );
};

export default MotoShell;
