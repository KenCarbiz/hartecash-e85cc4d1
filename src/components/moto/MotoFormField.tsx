import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  /** Floating-label "filled" appearance (lemon-tint when prefilled). */
  filled?: boolean;
};

/**
 * Floating-label input matching the MotoAcquire look (light yellow
 * fill when the field is prefilled, otherwise plain border).
 */
const MotoFormField = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, error, filled, className, id, ...rest }, ref) => {
    const inputId = id || `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return (
      <label htmlFor={inputId} className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-md border px-3 py-3 text-base outline-none transition",
            filled
              ? "border-zinc-300 bg-[#fafac9]"
              : "border-zinc-300 bg-white",
            "focus:border-[hsl(var(--cta-offer))] focus:ring-2 focus:ring-[hsl(var(--cta-offer)/0.15)]",
            error && "border-red-500 focus:border-red-500 focus:ring-red-100",
            className,
          )}
          {...rest}
        />
        {hint && !error ? (
          <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
        ) : null}
        {error ? (
          <span className="mt-1 block text-xs text-red-600">{error}</span>
        ) : null}
      </label>
    );
  },
);
MotoFormField.displayName = "MotoFormField";

export default MotoFormField;
