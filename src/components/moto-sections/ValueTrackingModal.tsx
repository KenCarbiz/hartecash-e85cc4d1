// "Learn how it works" modal — opens from the Value Tracking section's
// secondary CTA. Single-screen product explainer; matches the calm
// national-brand aesthetic of the landing (white card, soft shadow,
// single CTA, no marketing chrome).
//
// Behavior:
//   * Opens when the parent passes `open={true}`
//   * Closes on X click, outside click, or Escape (Radix Dialog
//     handles all three by default + traps focus + restores it to
//     the trigger element)
//   * "Get Started" closes the modal and smooth-scrolls to the
//     #sell-car-form anchor at the top of the landing
//
// Illustration: supplied PNG of our flagship vehicle riding a rising
// value curve with "Current Value" → "Best Time To Sell" markers, at:
//   public/brand/autocurb/value-tracker-illustration.png
//     →  /brand/autocurb/value-tracker-illustration.png  at runtime.
// Save the supplied image at exactly that path (or update
// ILLUSTRATION_SRC below to match the filename you give it).
//
// CTA matches the landing form's primary button language exactly:
// `--cta-offer` / `--cta-offer-text` CSS vars from ThemeProvider so
// each dealer's site_config.landing_cta_color flows through.
import * as React from "react";
import { X, TrendingUp } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// Supplied illustration — our flagship vehicle riding a rising value
// curve with "Current Value" → "Best Time To Sell" markers. Drop the
// PNG at: public/brand/autocurb/value-tracker-illustration.png
const ILLUSTRATION_SRC = "/brand/autocurb/value-tracker-illustration.png";
const ILLUSTRATION_ALT =
  "A vehicle on a rising blue value line marked Current Value and Best Time To Sell, showing how a car's value changes over time.";

interface ValueTrackingModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

const ValueTrackingModal = ({ open, onOpenChange }: ValueTrackingModalProps) => {
  const handleGetStarted = () => {
    onOpenChange(false);
    // Defer the scroll until after the close animation has started so
    // the user sees the page state, not a frozen modal during the
    // jump. RAF is sufficient on the existing Radix transition.
    requestAnimationFrame(() => {
      const form = document.getElementById("sell-car-form");
      if (form) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Dark translucent overlay — matches the existing shadcn
            Dialog overlay rhythm but uses /60 for a softer dim that
            lets the page bleed through. */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />

        {/* The card itself — 480px on desktop per spec (460–520 range),
            22px corners, soft (not heavy) shadow. max-h + overflow
            keeps the modal usable on short mobile viewports. */}
        <DialogPrimitive.Content
          aria-modal="true"
          aria-labelledby="value-tracking-modal-title"
          aria-describedby="value-tracking-modal-desc"
          className={cn(
            "fixed left-1/2 top-1/2 z-[150] -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100vw-32px)] max-w-[480px]",
            "max-h-[calc(100vh-32px)] overflow-y-auto",
            "rounded-[22px] bg-white p-6 sm:p-7 lg:p-8",
            "shadow-[0_24px_60px_-20px_rgb(15_23_42_/_0.25)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* Close X — top-right, subtle. */}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 inline-flex items-center justify-center w-8 h-8 rounded-full text-foreground/55 hover:text-foreground hover:bg-foreground/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </DialogPrimitive.Close>

          {/* Eyebrow — small icon tile + "Value Tracking" label.
              Header row stays minimal: icon left, title left of
              center, close X positioned absolutely top-right (above). */}
          <div className="flex items-center gap-2 mb-5">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "hsl(142 71% 95%)" }}
            >
              <TrendingUp className="w-4 h-4 text-emerald-600" strokeWidth={2} />
            </div>
            <DialogPrimitive.Title className="text-base font-bold text-foreground tracking-tight">
              Value Tracking
            </DialogPrimitive.Title>
          </div>

          {/* Supplied illustration — vehicle on a rising value curve with
              Current Value → Best Time To Sell markers. ~92% modal width,
              soft breathing room below before the headline. */}
          <div className="mb-6 flex justify-center">
            <img
              src={ILLUSTRATION_SRC}
              alt={ILLUSTRATION_ALT}
              className="block h-auto w-[92%]"
              loading="lazy"
              decoding="async"
            />
          </div>

          {/* Headline */}
          <h3
            id="value-tracking-modal-title"
            className="text-xl font-bold text-foreground text-center leading-tight tracking-tight mb-3"
          >
            Track your car's value over time.
          </h3>

          {/* Body */}
          <DialogPrimitive.Description
            id="value-tracking-modal-desc"
            className="text-sm text-foreground/65 leading-relaxed text-center mb-4"
          >
            Get regular updates when your vehicle's value changes, so you know
            when it may be the right time to sell or trade.
          </DialogPrimitive.Description>

          {/* Reassurance */}
          <p className="text-sm text-foreground/55 text-center mb-7">
            It's free to use, and there's no obligation.
          </p>

          {/* Primary CTA — full-width inside the modal, rounded-xl
              (12px) per spec, tenant CTA token so each dealer's brand
              color flows through. */}
          <button
            type="button"
            onClick={handleGetStarted}
            className={cn(
              "w-full rounded-xl py-3.5 text-base font-semibold tracking-wide transition",
              "bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)]",
              "hover:opacity-95 active:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--cta-offer))]",
            )}
          >
            Get Started
          </button>

          <p className="text-[11px] text-foreground/55 text-center mt-3">
            Takes less than a minute.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ValueTrackingModal;
