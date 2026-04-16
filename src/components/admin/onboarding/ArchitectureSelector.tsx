import { cn } from "@/lib/utils";
import {
  Store, Building2, Network, Crown, Landmark,
  ArrowRight, CheckCircle2,
} from "lucide-react";
import type { ArchitectureType } from "./types";

interface Props {
  selected: ArchitectureType | null;
  onSelect: (arch: ArchitectureType) => void;
  /** Number of stores the dealer operates. Shown as a dropdown
   *  when multi_location or dealer_group is selected. */
  storeCount?: number;
  onStoreCountChange?: (count: number) => void;
  disabled?: boolean;
}

const CARDS: {
  value: ArchitectureType;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  example: string;
  badge?: string;
}[] = [
  {
    value: "single_store",
    icon: Store,
    title: "Single Store",
    subtitle: "One rooftop, one brand. The simplest setup.",
    example: "e.g. Smith Toyota",
  },
  {
    value: "single_store_secondary",
    icon: Landmark,
    title: "Single Store + Secondary",
    subtitle: "Primary dealership with a satellite location — buying center, used car lot, or standalone.",
    example: "e.g. Smith Toyota + Smith Used Cars",
  },
  {
    value: "multi_location",
    icon: Building2,
    title: "Multi-Location",
    subtitle: "3–5 stores under one group with volume pricing.",
    example: "e.g. Smith Auto Group (3–5 stores)",
  },
  {
    value: "dealer_group",
    icon: Network,
    title: "Dealer Group",
    subtitle: "6–10 rooftops with deeper volume discounts, corporate identity, and full routing.",
    example: "e.g. Harte Auto Group (6–10 rooftops)",
  },
  {
    value: "enterprise",
    icon: Crown,
    title: "Enterprise",
    subtitle: "11+ locations. Custom pricing with dedicated onboarding.",
    example: "Contact for custom configuration",
    badge: "Custom Pricing",
  },
];

/** Store-count ranges for architectures that need a count picker. */
const STORE_COUNT_RANGE: Partial<Record<ArchitectureType, { min: number; max: number }>> = {
  multi_location: { min: 3, max: 5 },
  dealer_group: { min: 6, max: 10 },
};

const ArchitectureSelector = ({
  selected,
  onSelect,
  storeCount,
  onStoreCountChange,
  disabled = false,
}: Props) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center space-y-1 sm:space-y-2 pb-1 sm:pb-2">
        <h2 className="text-lg sm:text-2xl font-bold tracking-tight">
          How is this dealership structured?
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This determines routing, branding, and pricing. You can always adjust later.
        </p>
      </div>

      <div className="grid gap-2 sm:gap-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const isSelected = selected === card.value;
          const range = STORE_COUNT_RANGE[card.value];
          const showCountPicker = isSelected && range != null;

          return (
            <div key={card.value}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(card.value)}
                className={cn(
                  "group relative w-full flex items-start gap-3 sm:gap-4 p-3 sm:p-5 text-left transition-all duration-200",
                  showCountPicker ? "rounded-t-xl" : "rounded-xl",
                  "border-2",
                  "hover:shadow-lg sm:hover:-translate-y-0.5",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                    : "border-border bg-card hover:border-primary/40",
                  disabled && "opacity-60 cursor-not-allowed",
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl shrink-0 transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}
                >
                  <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-card-foreground">{card.title}</h3>
                    {card.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed hidden sm:block">
                    {card.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed sm:hidden">
                    {card.subtitle.split('.')[0]}.
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 sm:mt-1 italic hidden sm:block">{card.example}</p>
                </div>

                {/* Selection indicator */}
                <div className="shrink-0 mt-1">
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                  )}
                </div>
              </button>

              {/* Store count picker — appears inline when multi_location or dealer_group is selected */}
              {showCountPicker && range && (
                <div className="border-2 border-t-0 border-primary rounded-b-xl bg-primary/[0.03] px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
                  <label
                    htmlFor={`store-count-${card.value}`}
                    className="text-xs sm:text-sm font-semibold text-card-foreground whitespace-nowrap"
                  >
                    How many locations?
                  </label>
                  <select
                    id={`store-count-${card.value}`}
                    disabled={disabled}
                    value={storeCount ?? range.min}
                    onChange={(e) => onStoreCountChange?.(Number(e.target.value))}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {Array.from(
                      { length: range.max - range.min + 1 },
                      (_, i) => range.min + i,
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "store" : "stores"}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-snug hidden sm:block">
                    Pricing below adjusts per store
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArchitectureSelector;
