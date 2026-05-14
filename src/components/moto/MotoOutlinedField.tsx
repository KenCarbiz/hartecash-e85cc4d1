import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Material-style outlined field with a floating label that punches
 * through the top border. Matches the MotoAcquire visual exactly.
 *
 * The label is always at the top-left of the border (not animated)
 * since every field in the MotoAcquire flow is pre-labelled. This
 * keeps the implementation tiny and predictable across input + select
 * variants.
 */
type BaseProps = {
  label: string;
  active?: boolean;
  trailing?: ReactNode;
  error?: string;
  className?: string;
};

const wrapperClasses = (active: boolean, error?: string) =>
  cn(
    "relative rounded-md border bg-white transition",
    active
      ? "border-[hsl(var(--cta-offer))] ring-1 ring-[hsl(var(--cta-offer))]"
      : "border-zinc-300 hover:border-zinc-400",
    error && "!border-red-500 !ring-red-300",
  );

const labelClasses = (active: boolean) =>
  cn(
    "absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium",
    active ? "text-[hsl(var(--cta-offer))]" : "text-zinc-600",
  );

type InputProps = InputHTMLAttributes<HTMLInputElement> & BaseProps;
export const MotoOutlinedInput = forwardRef<HTMLInputElement, InputProps>(
  ({ label, active, trailing, error, className, id, ...rest }, ref) => {
    const inputId = id || `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const isActive = active ?? !!rest.value;
    return (
      <div className={className}>
        <div className={wrapperClasses(!!active, error)}>
          <label htmlFor={inputId} className={labelClasses(isActive)}>
            {label}
          </label>
          <input
            ref={ref}
            id={inputId}
            className="w-full bg-transparent px-3 py-3.5 text-base text-zinc-900 outline-none placeholder:text-zinc-400"
            {...rest}
          />
          {trailing ? <div className="absolute inset-y-0 right-2 flex items-center text-zinc-500">{trailing}</div> : null}
        </div>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  },
);
MotoOutlinedInput.displayName = "MotoOutlinedInput";

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & BaseProps & {
  options: { value: string; label: string }[];
  placeholder?: string;
};
export const MotoOutlinedSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, active, options, error, className, placeholder, id, value, ...rest }, ref) => {
    const inputId = id || `s-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const isActive = active ?? !!value;
    return (
      <div className={className}>
        <div className={wrapperClasses(!!active, error)}>
          <label htmlFor={inputId} className={labelClasses(isActive)}>
            {label}
          </label>
          <select
            ref={ref}
            id={inputId}
            value={value}
            className={cn(
              "w-full appearance-none bg-transparent px-3 py-3.5 pr-8 text-base outline-none",
              value ? "text-zinc-900" : "text-zinc-400",
            )}
            {...rest}
          >
            <option value="">{placeholder ?? ""}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500">▾</span>
        </div>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  },
);
MotoOutlinedSelect.displayName = "MotoOutlinedSelect";
