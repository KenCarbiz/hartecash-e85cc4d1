import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

/**
 * Full-width navy CTA used on every step. Picks up
 * `--cta-offer` / `--cta-offer-text` from ThemeProvider so each
 * dealer's `site_config.landing_cta_color` flows through.
 */
const MotoPrimaryButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, children, loading, disabled, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "w-full rounded-[8px] py-4 text-base font-semibold tracking-wide transition",
        "bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)]",
        "hover:opacity-95 active:opacity-90",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--cta-offer))]",
        className,
      )}
      {...rest}
    >
      {loading ? "Please wait…" : children}
    </button>
  ),
);
MotoPrimaryButton.displayName = "MotoPrimaryButton";

export default MotoPrimaryButton;
