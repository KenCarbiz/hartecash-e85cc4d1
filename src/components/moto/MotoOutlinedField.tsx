import { forwardRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Select as RSelect,
  SelectContent as RSelectContent,
  SelectItem as RSelectItem,
  SelectTrigger as RSelectTrigger,
  SelectValue as RSelectValue,
} from "@/components/ui/select";

/**
 * Premium floating-label outlined field.
 *
 * - Empty + unfocused: label sits inside the field as placeholder-style text.
 * - Focused or filled: label animates up into the top-left border notch,
 *   shrinks, and the input shows the typed value (or a real placeholder).
 */
type BaseProps = {
  label: string;
  /** Force the floated state regardless of focus/value. */
  active?: boolean;
  trailing?: ReactNode;
  error?: string;
  className?: string;
  required?: boolean;
};

const renderLabel = (label: string, required?: boolean) => {
  // Strip a trailing "*" from the label string and let the `required`
  // prop (or detected asterisk) render a subtle, scaled marker instead.
  const trimmed = label.replace(/\s*\*\s*$/, "");
  const isRequired = required ?? label !== trimmed;
  return (
    <>
      {trimmed}
      {isRequired ? <span className="ml-0.5 text-zinc-400">*</span> : null}
    </>
  );
};

const wrapperClasses = (focused: boolean, error?: string) =>
  cn(
    "relative rounded-md border bg-white transition-colors",
    focused
      ? "border-[hsl(var(--cta-offer))] ring-1 ring-[hsl(var(--cta-offer))]"
      : "border-zinc-300 hover:border-zinc-400",
    error && "!border-red-500 !ring-red-300",
  );

const labelClasses = (floated: boolean, focused: boolean) =>
  cn(
    "pointer-events-none absolute left-3 bg-white px-1 font-medium transition-all duration-150 ease-out",
    floated
      ? cn(
          "-top-2 text-[11px]",
          focused ? "text-[hsl(var(--cta-offer))]" : "text-zinc-600",
        )
      : "top-1/2 -translate-y-1/2 text-base text-zinc-400",
  );

type InputProps = InputHTMLAttributes<HTMLInputElement> & BaseProps;
export const MotoOutlinedInput = forwardRef<HTMLInputElement, InputProps>(
  ({ label, active, trailing, error, className, id, onFocus, onBlur, placeholder, required, ...rest }, ref) => {
    const inputId = id || `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const [focused, setFocused] = useState(false);
    const hasValue = !!(rest.value ?? rest.defaultValue);
    const floated = active ?? (focused || hasValue);
    // Only show the underlying placeholder once the label has floated up,
    // and only if the caller passed something distinct from the label.
    const showPlaceholder =
      floated && placeholder && placeholder.trim().toLowerCase() !== label.trim().toLowerCase();
    return (
      <div className={className}>
        <div className={wrapperClasses(focused, error)}>
          <label htmlFor={inputId} className={labelClasses(floated, focused)}>
            {renderLabel(label, required)}
          </label>
          <input
            ref={ref}
            id={inputId}
            placeholder={showPlaceholder ? placeholder : undefined}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            className="h-[52px] w-full bg-transparent px-3 py-3.5 text-base text-zinc-900 outline-none placeholder:text-zinc-400"
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
  ({ label, active, options, error, className, placeholder, id, value, onChange, disabled, name, required }, _ref) => {
    const inputId = id || `s-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const v = (value ?? "") as string;
    const [open, setOpen] = useState(false);
    const hasValue = !!v;
    const floated = active ?? (open || hasValue);
    const focused = open;
    const selected = options.find((o) => o.value === v);
    const handleChange = (next: string) => {
      onChange?.({
        target: { value: next, name: name ?? "" },
        currentTarget: { value: next, name: name ?? "" },
      } as unknown as React.ChangeEvent<HTMLSelectElement>);
    };
    return (
      <div className={className}>
        <RSelect value={v} onValueChange={handleChange} disabled={disabled} onOpenChange={setOpen}>
          <RSelectTrigger
            id={inputId}
            className={cn(
              "relative h-[52px] w-full justify-between rounded-md border bg-white px-3 py-3.5 pr-8 text-base text-zinc-900 hover:border-zinc-400 focus:ring-0 focus:ring-offset-0 transition-colors",
              focused && !error
                ? "border-[hsl(var(--cta-offer))] ring-1 ring-[hsl(var(--cta-offer))]"
                : "border-zinc-300",
              error && "!border-red-500 !ring-red-300",
            )}
          >
            <label htmlFor={inputId} className={labelClasses(floated, focused)}>
              {label}
            </label>
            <RSelectValue placeholder="">
              {selected ? <span className="text-zinc-900">{selected.label}</span> : <span />}
            </RSelectValue>
          </RSelectTrigger>
          <RSelectContent
            position="popper"
            side="bottom"
            align="start"
            avoidCollisions={false}
            className="max-h-72 w-[var(--radix-select-trigger-width)] bg-white"
          >
            {options.map((o) => (
              <RSelectItem key={o.value} value={o.value} className="text-base">
                {o.label}
              </RSelectItem>
            ))}
          </RSelectContent>
        </RSelect>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  },
);
MotoOutlinedSelect.displayName = "MotoOutlinedSelect";
