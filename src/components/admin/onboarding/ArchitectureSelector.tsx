import { cn } from "@/lib/utils";
import {
  Store, Building2, Network, Crown, Landmark,
  ArrowRight, CheckCircle2,
} from "lucide-react";
import type { ArchitectureType } from "./types";

interface Props {
  selected: ArchitectureType | null;
  onSelect: (arch: ArchitectureType) => void;
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
    subtitle: "Multiple stores under one brand with ZIP/OEM routing and per-store settings.",
    example: "e.g. Smith Auto Group (3 stores)",
  },
  {
    value: "dealer_group",
    icon: Network,
    title: "Dealer Group",
    subtitle: "Multiple brands & franchises with corporate identity, full routing, and brand matching.",
    example: "e.g. Harte Auto Group (6 rooftops)",
  },
  {
    value: "enterprise",
    icon: Crown,
    title: "Enterprise",
    subtitle: "11+ locations. Custom build with dedicated onboarding.",
    example: "Contact for custom configuration",
    badge: "Custom Pricing",
  },
];

const ArchitectureSelector = ({ selected, onSelect }: Props) => {
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

          return (
            <button
              key={card.value}
              type="button"
              onClick={() => onSelect(card.value)}
              className={cn(
                "group relative flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all duration-200",
                "hover:shadow-lg hover:-translate-y-0.5",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}
              >
                <Icon className="w-6 h-6" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-card-foreground">{card.title}</h3>
                  {card.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {card.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                  {card.subtitle}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1 italic">{card.example}</p>
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
          );
        })}
      </div>
    </div>
  );
};

export default ArchitectureSelector;
