// InDevelopmentBadge
// ----------------------------------------------------------------------------
// Reusable amber warning badge for features that are not yet production-ready
// (require external integrations, credentials, or hardware wiring). Also
// exports an `InDevelopmentOverlay` that wraps arbitrary content with a
// subtle amber wash and a centered banner.
// ----------------------------------------------------------------------------

import * as React from "react";
import { Wrench, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface InDevelopmentBadgeProps {
  /** Badge text. Defaults to "In Development". */
  label?: string;
  /** Tooltip text explaining why the feature is not yet production-ready. */
  reason?: string;
  /** Size variant. */
  size?: "sm" | "md" | "lg";
  /** Optional extra classes for layout tweaks. */
  className?: string;
}

const SIZE_MAP: Record<
  NonNullable<InDevelopmentBadgeProps["size"]>,
  { wrapper: string; icon: string; text: string; gap: string }
> = {
  sm: {
    wrapper: "px-2 py-0.5 rounded-md",
    icon: "w-3 h-3",
    text: "text-[10px]",
    gap: "gap-1",
  },
  md: {
    wrapper: "px-2.5 py-1 rounded-lg",
    icon: "w-3.5 h-3.5",
    text: "text-[11px]",
    gap: "gap-1.5",
  },
  lg: {
    wrapper: "px-3 py-1.5 rounded-lg",
    icon: "w-4 h-4",
    text: "text-xs",
    gap: "gap-2",
  },
};

export const InDevelopmentBadge: React.FC<InDevelopmentBadgeProps> = ({
  label = "In Development",
  reason,
  size = "md",
  className,
}) => {
  const sizing = SIZE_MAP[size];

  const badgeContent = (
    <span
      className={cn(
        "inline-flex items-center font-bold uppercase tracking-wider",
        "border border-amber-500/40 bg-amber-500/10",
        "text-amber-700 dark:text-amber-300",
        "shadow-[0_0_0_1px_rgba(245,158,11,0.06)]",
        sizing.wrapper,
        sizing.gap,
        sizing.text,
        className
      )}
    >
      <Wrench className={cn(sizing.icon, "shrink-0")} />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );

  if (!reason) return badgeContent;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">{badgeContent}</span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-[280px] border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/90 dark:text-amber-100"
        >
          <p className="text-xs leading-snug">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export interface InDevelopmentOverlayProps {
  /** Banner heading. Defaults to "In Development". */
  label?: string;
  /** Supporting sentence shown below the heading. */
  reason?: string;
  /** Wrapped content — typically the feature the overlay is masking. */
  children: React.ReactNode;
  /** Optional extra wrapper classes. */
  className?: string;
}

export const InDevelopmentOverlay: React.FC<InDevelopmentOverlayProps> = ({
  label = "In Development",
  reason,
  children,
  className,
}) => {
  return (
    <div className={cn("relative", className)}>
      {/* Wrapped content with a subtle amber wash */}
      <div className="pointer-events-none select-none opacity-80">
        {children}
      </div>

      {/* Amber wash */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/5 via-amber-500/3 to-transparent pointer-events-none" />

      {/* Centered banner */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-50/95 dark:bg-amber-950/90 backdrop-blur-sm px-5 py-3 shadow-lg shadow-amber-500/10">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30">
            <HardHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {label}
            </p>
            {reason && (
              <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 mt-0.5 max-w-[260px] leading-snug">
                {reason}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InDevelopmentBadge;
