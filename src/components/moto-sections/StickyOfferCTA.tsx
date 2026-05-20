// Sticky desktop mini-CTA for the Moto template.
//
// Per the IA agent's "second-look visitor" call: someone scrolling
// back UP through the page should never be more than one click from
// the form. A monolithic terminal banner only catches the visitor
// who scrolls all the way down (~40% bounce); a persistent pill
// catches the other 60%.
//
// Behavior:
//   * Hidden initially (don't compete with the form on first paint)
//   * Appears when scrolled past the hero — heuristic: > 60% of
//     viewport scrolled past, OR 600px down, whichever first
//   * Hides when within ~120px of the sticky form anchor itself
//     (don't double-CTA when the form is in view)
//   * Desktop only (lg+ === ≥1024px). Mobile gets the standard
//     in-flow CTAs.
//   * Click → smooth-scroll to #sell-car-form
//
// Visual: navy pill matching the form's CTA exactly. shadow-lg
// rather than shadow-sm because it's floating over content — needs
// enough lift to read as a sticky element, not a section element.
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const SHOW_THRESHOLD_PX = 600;

const StickyOfferCTA = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const scrolled = window.scrollY;
      const formEl = document.getElementById("sell-car-form");
      // Hide when the form itself is reasonably in view — no point
      // poking the user to scroll to something they're already at.
      let formInView = false;
      if (formEl) {
        const rect = formEl.getBoundingClientRect();
        formInView =
          rect.top < window.innerHeight - 120 && rect.bottom > 120;
      }
      setVisible(scrolled > SHOW_THRESHOLD_PX && !formInView);
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const onClick = () => {
    const form = document.getElementById("sell-car-form");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      // Desktop-only. Mobile already has tighter in-flow CTAs in
      // DefaultBelowFold and a sticky footer in MotoStickyFooter so
      // a second floating pill would be redundant.
      className={`hidden lg:block fixed right-6 bottom-6 z-40 transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full text-sm font-semibold shadow-lg shadow-foreground/15 hover:bg-primary/95 transition-colors"
      >
        Get my offer
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default StickyOfferCTA;
