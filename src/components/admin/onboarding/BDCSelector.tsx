import { cn } from "@/lib/utils";
import {
  Store, Phone, Building2, Bot,
  ArrowRight, CheckCircle2,
} from "lucide-react";

export type BDCType = "no_bdc" | "single_bdc" | "multi_bdc" | "ai_bdc";

interface Props {
  selected: BDCType | null;
  onSelect: (bdc: BDCType) => void;
  disabled?: boolean;
}

const CARDS: {
  value: BDCType;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  example: string;
  badge?: string;
}[] = [
  {
    value: "no_bdc",
    icon: Store,
    title: "No BDC",
    subtitle: "No dedicated BDC team. Leads go directly to sales staff or managers at each location.",
    example: "e.g. Small single-rooftop store",
  },
  {
    value: "single_bdc",
    icon: Phone,
    title: "Single BDC",
    subtitle: "One centralized team handles all inbound leads across locations.",
    example: "e.g. Centralized buying center",
  },
  {
    value: "multi_bdc",
    icon: Building2,
    title: "Multi-Location BDC",
    subtitle: "Each location has its own BDC team. Leads route to the matched store's team.",
    example: "e.g. Large dealer group with per-store teams",
  },
  {
    value: "ai_bdc",
    icon: Bot,
    title: "AI BDC",
    subtitle: "AI-powered lead handling with automated follow-ups and intelligent routing.",
    example: "Coming soon — early access available",
    badge: "Beta",
  },
];

const BDCSelector = ({ selected, onSelect, disabled }: Props) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center space-y-1 sm:space-y-2 pb-1 sm:pb-2">
        <h2 className="text-lg sm:text-2xl font-bold tracking-tight">
          How does this dealership handle leads?
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This configures lead routing, notification rules, and follow-up automation.
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
              onClick={() => !disabled && onSelect(card.value)}
              disabled={disabled}
              className={cn(
                "group relative flex items-start gap-3 sm:gap-4 p-3 sm:p-5 rounded-xl border-2 text-left transition-all duration-200",
                "hover:shadow-lg sm:hover:-translate-y-0.5",
                disabled && "opacity-70 cursor-default",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
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

export default BDCSelector;
