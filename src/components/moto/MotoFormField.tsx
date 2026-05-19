import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  /** Floating-label "filled" appearance (lemon-tint when prefilled). */
  filled?: boolean;
};

/**
 * Floating-label input: label sits inside the box as placeholder,
 * and floats up to sit on the top border (notched outline style)
 * when focused or when the field has a value.
 */
const MotoFormField = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, error, filled, className, id, value, onFocus, onBlur, ...rest }, ref) => {
    const reactId = useId();
    const inputId = id || `f-${reactId}`;
    const [focused, setFocused] = useState(false);
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const floated = focused || hasValue;

    return (
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={cn(
            "peer w-full rounded-md border px-3 pt-4 pb-2 text-base outline-none transition",
            "border-zinc-300 bg-white",
            "focus:border-[hsl(var(--cta-offer))] focus:ring-2 focus:ring-[hsl(var(--cta-offer)/0.15)]",
            error && "border-red-500 focus:border-red-500 focus:ring-red-100",
            className,
          )}
          {...rest}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "pointer-events-none absolute left-2 px-1 text-zinc-500 transition-all",
            floated
              ? "top-0 -translate-y-1/2 bg-white text-xs font-medium text-zinc-600"
              : "top-1/2 -translate-y-1/2 text-base",
            focused && "text-[hsl(var(--cta-offer))]",
            error && "text-red-600",
          )}
        >
          {label}
        </label>
        {hint && !error ? (
          <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
        ) : null}
        {error ? (
          <span className="mt-1 block text-xs text-red-600">{error}</span>
        ) : null}
      </div>
    );
  },
);
MotoFormField.displayName = "MotoFormField";

export default MotoFormField;
