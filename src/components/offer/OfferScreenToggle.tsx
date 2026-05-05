import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Layers } from "lucide-react";

/**
 * Floating staff-only toggle that flips the /offer/:token route
 * between the legacy long-scroll OfferPage and the new Clarity
 * variant without touching the URL. Mirrors the ?offer= override
 * already wired into OfferPage's top-level dispatch:
 *   sessionStorage.offer_screen_override = 'legacy' | 'clarity'
 *
 * Only renders when a Supabase auth session exists, so customers
 * never see it. Picking a variant reloads the page so the dispatch
 * picks up the new value cleanly (avoids re-mount edge cases inside
 * the deep portal/contact-gate state machine).
 */
const OfferScreenToggle = ({ current }: { current: "legacy" | "clarity" }) => {
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setIsStaff(!!data.session?.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsStaff(!!session?.user);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isStaff) return null;

  const switchTo = (variant: "legacy" | "clarity") => {
    try {
      sessionStorage.setItem("offer_screen_override", variant);
    } catch { /* private mode */ }
    window.location.reload();
  };

  return (
    <div
      className="fixed bottom-4 left-4 z-[60] print:hidden flex items-center gap-1 rounded-full border border-border bg-card/95 backdrop-blur shadow-xl px-1.5 py-1"
      role="group"
      aria-label="Offer screen variant (staff only)"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-2">
        Offer view
      </span>
      <button
        type="button"
        onClick={() => switchTo("clarity")}
        className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 transition-colors ${
          current === "clarity"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        aria-pressed={current === "clarity"}
      >
        <Sparkles className="w-3 h-3" />
        Clarity
      </button>
      <button
        type="button"
        onClick={() => switchTo("legacy")}
        className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 transition-colors ${
          current === "legacy"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        aria-pressed={current === "legacy"}
      >
        <Layers className="w-3 h-3" />
        Legacy
      </button>
    </div>
  );
};

export default OfferScreenToggle;
