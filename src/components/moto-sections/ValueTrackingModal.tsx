// "Learn how it works" modal — opens from the Value Tracking section's
// secondary CTA. Single-screen product explainer; matches the calm
// national-brand aesthetic of the landing (white card, soft shadow,
// single navy CTA, no marketing chrome).
//
// Behavior:
//   * Opens when the parent passes `open={true}`
//   * Closes on X click, outside click, or Escape (Radix Dialog
//     handles all three by default)
//   * "Get Started" closes the modal and smooth-scrolls to the
//     #sell-car-form anchor at the top of the landing
//   * No static image — the illustration is inline SVG so it loads
//     fast and stays editable
//
// CTA matches the landing form's primary button language exactly:
// `--cta-offer` / `--cta-offer-text` CSS vars from ThemeProvider so
// each dealer's site_config.landing_cta_color flows through.
import * as React from "react";
import { X, TrendingUp } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// Inline illustration — green upward value line with a small sedan
// silhouette under the curve and two value-bubble markers ($ low /
// $$ high). Pure SVG, no raster, ~3KB inline. Scales with viewBox.
const ValueIllustration = () => (
  <svg
    viewBox="0 0 240 140"
    className="w-full h-auto"
    role="img"
    aria-label="A green line trending upward with a small car beneath it, indicating value increasing over time."
  >
    {/* Subtle area fill under the curve so the slope reads at a glance */}
    <path
      d="M 20 105 C 60 105 90 80 130 60 C 165 42 195 30 220 24 L 220 120 L 20 120 Z"
      fill="#22c55e"
      fillOpacity="0.08"
    />

    {/* Green upward value line — single soft curve, no wobble (this is
        the explainer illustration, not the realistic data chart). */}
    <path
      d="M 20 105 C 60 105 90 80 130 60 C 165 42 195 30 220 24"
      fill="none"
      stroke="#22c55e"
      strokeWidth="3"
      strokeLinecap="round"
    />

    {/* Endpoint dots — open white circles like the real chart */}
    <circle cx="20" cy="105" r="4.5" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />
    <circle cx="220" cy="24" r="4.5" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />

    {/* Low-value bubble */}
    <g transform="translate(40 80)">
      <rect width="28" height="20" rx="10" fill="hsl(220 13% 70%)" />
      <text x="14" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">$</text>
    </g>

    {/* High-value bubble */}
    <g transform="translate(180 4)">
      <rect width="34" height="20" rx="10" fill="#22c55e" />
      <text x="17" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">$$</text>
    </g>

    {/* Small sedan silhouette under the curve — built from a few
        rounded rects + circles so it stays light and tracks the
        primary brand neutral. */}
    <g transform="translate(94 90)" fill="hsl(220 13% 35%)">
      {/* roof + hood line */}
      <path d="M 6 14 L 12 4 Q 14 2 18 2 L 32 2 Q 36 2 38 4 L 44 14 L 6 14 Z" />
      {/* body */}
      <rect x="0" y="13" width="50" height="9" rx="3" />
      {/* wheels */}
      <circle cx="11" cy="22" r="3.5" fill="hsl(220 14% 12%)" />
      <circle cx="39" cy="22" r="3.5" fill="hsl(220 14% 12%)" />
      {/* highlight stripe */}
      <rect x="12" y="14" width="26" height="3" rx="1" fill="hsl(220 13% 50%)" />
    </g>
  </svg>
);

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

        {/* The card itself — 420px on desktop per spec, 18px corners,
            soft (not heavy) shadow. */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[150] -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100%-32px)] max-w-[420px]",
            "rounded-[18px] bg-white p-7 lg:p-8",
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

          {/* Eyebrow — green icon + "Value Tracking" label */}
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

          {/* Inline illustration */}
          <div className="mb-6">
            <ValueIllustration />
          </div>

          {/* Headline */}
          <h3 className="text-xl font-bold text-foreground text-center leading-tight tracking-tight mb-3">
            Track your car's value over time.
          </h3>

          {/* Body */}
          <DialogPrimitive.Description className="text-sm text-foreground/65 leading-relaxed text-center mb-4">
            Get regular updates when your vehicle's value changes, so you know
            when it may be the right time to sell or trade.
          </DialogPrimitive.Description>

          {/* Supporting line */}
          <p className="text-sm text-foreground/55 text-center mb-7">
            It's free to use, and there's no obligation.
          </p>

          {/* Primary CTA — matches MotoPrimaryButton's class language
              so the modal's button reads as part of the same system
              as the form's CTAs. */}
          <button
            type="button"
            onClick={handleGetStarted}
            className={cn(
              "w-full rounded-md py-3.5 text-base font-semibold tracking-wide transition",
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
