import { Minus, Plus, Building } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Prominent per-rooftop quantity stepper. Replaces the old tiny numeric
 * input — multi-rooftop pricing is a first-class concept for dealer
 * groups, so the control deserves real estate. Clamped 1–9999.
 */
interface RooftopStepperProps {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

export function RooftopStepper({ value, onChange, disabled = false }: RooftopStepperProps) {
  const clamp = (n: number) => Math.max(1, Math.min(9999, Math.floor(n) || 1));
  const dec = () => onChange(clamp(value - 1));
  const inc = () => onChange(clamp(value + 1));

  return (
    <div className="inline-flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-3 py-1.5 shadow-sm">
      <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 rounded-md"
          onClick={dec}
          disabled={disabled || value <= 1}
          aria-label="Decrease rooftops"
        >
          <Minus className="w-3 h-3" />
        </Button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={9999}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="w-10 bg-transparent text-center text-sm font-bold text-card-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="Number of rooftops"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 rounded-md"
          onClick={inc}
          disabled={disabled || value >= 9999}
          aria-label="Increase rooftops"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-0.5">
        {value === 1 ? "Rooftop" : "Rooftops"}
      </span>
    </div>
  );
}
