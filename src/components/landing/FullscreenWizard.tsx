import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional theme override. The four 2026 templates each pass their
   *  own palette so the wizard inherits the right vibe. */
  theme?: "light" | "dark" | "warm";
  /** Optional accent override (Mercedes-blue / Bentley-cream / Lambo-orange).
   *  Defaults to the dealer's primary color. */
  accent?: string;
  /** The wizard body — typically <SellCarForm /> or <QuickOfferForm />. */
  children: ReactNode;
}

/**
 * FullscreenWizard — the "transition AWAY from the landing chrome"
 * component the user explicitly asked for.
 *
 * When the customer submits their plate/VIN on a landing template, the
 * marketing chrome (reviews, process, vs-comparisons, footer, nav)
 * needs to disappear and the customer enters a focused, premium flow.
 * Carvana and CarMax both do this — once you engage, the marketing
 * surface gives way to a single-column wizard.
 *
 * This component is a fixed-position overlay that covers the viewport
 * with a minimal chrome: dealer logo top-left, close (X) top-right,
 * the wizard body centered, and that's it. No nav, no marketing, no
 * footer. Per the May-2026 sell-flow design audit, this is the
 * "$1M-budget" feel — the absence of clutter, not the presence of
 * decoration, is the luxury cue.
 *
 * Mercedes/Apple-grade easing: 500ms cubic-bezier(0.16, 1, 0.3, 1)
 * — slow, soft, deliberate. No bounces, no springs, no jitter.
 *
 * Body-scroll lock while open so the marketing landing doesn't
 * leak through scroll.
 */
const FullscreenWizard = ({ open, onClose, theme = "light", accent, children }: Props) => {
  const { config } = useSiteConfig();

  // Lock body scroll while the wizard is open. Prevents the
  // landing-page chrome behind from peeking through on iOS.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC closes — standard a11y. Doesn't lose form state in normal
  // React Query / form libraries since the children stay mounted
  // (parent controls open).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Theme tokens. Three options for now; the templates pick which
  // one. Tier A (Mercedes/Bentley) = warm cream. Tier B (Lambo/McLaren) = dark.
  // Tier C (Apple/Porsche) = pure white.
  const tokens =
    theme === "dark"
      ? {
          bg: "#0F0F12",
          chrome: "rgba(255,255,255,0.04)",
          chromeBorder: "rgba(255,255,255,0.08)",
          ink: "#FFFFFF",
          mute: "rgba(255,255,255,0.55)",
        }
      : theme === "warm"
      ? {
          bg: "#FAF6EE",
          chrome: "rgba(0,0,0,0.02)",
          chromeBorder: "rgba(44,42,38,0.08)",
          ink: "#2C2A26",
          mute: "rgba(44,42,38,0.55)",
        }
      : {
          bg: "#FFFFFF",
          chrome: "rgba(0,0,0,0.02)",
          chromeBorder: "rgba(0,0,0,0.06)",
          ink: "#0A0A0A",
          mute: "rgba(0,0,0,0.55)",
        };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          // Fixed full-viewport. z above everything in the marketing
          // landing including any sticky nav.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100]"
          style={{ background: tokens.bg, color: tokens.ink }}
          aria-modal="true"
          role="dialog"
          aria-label={`Sell your car to ${config.dealership_name}`}
        >
          {/* Minimal chrome — dealer logo left, close right */}
          <header
            className="relative z-10 flex items-center justify-between px-5 md:px-8 py-4 border-b"
            style={{ borderColor: tokens.chromeBorder, background: tokens.chrome }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close and return to the landing page"
                className="rounded-full p-1.5 hover:bg-black/5 transition-colors"
                style={{ color: tokens.mute }}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              {config.logo_url ? (
                <img
                  src={config.logo_url}
                  alt={config.dealership_name}
                  className={`h-16 md:h-20 w-auto object-contain ${theme === "dark" ? "brightness-0 invert" : ""}`}
                />
              ) : (
                <span className="text-sm font-semibold tracking-tight truncate" style={{ color: tokens.ink }}>
                  {config.dealership_name}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close wizard"
              className="rounded-full p-2 hover:bg-black/5 transition-colors"
              style={{ color: tokens.mute }}
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Body — centered, breathing room, the form lives here.
              Slow soft slide-up; matches the cubic-bezier of the fade. */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 h-[calc(100vh-65px)] overflow-y-auto"
            style={{ accentColor: accent || undefined }}
          >
            <div className="max-w-[640px] mx-auto px-5 md:px-8 py-10 md:py-16">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullscreenWizard;
