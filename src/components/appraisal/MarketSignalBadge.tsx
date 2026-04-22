import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type MarketSignal = "BUY_STRONG" | "BUY_AT_MARKET" | "BUY_CAREFULLY" | "PASS";

export function getMarketSignal(
  mds: number | null | undefined,
  soldAvg: number | null | undefined,
  askingAvg: number | null | undefined,
  activeCount: number | null | undefined
): MarketSignal | null {
  if (mds == null || askingAvg == null || soldAvg == null) return null;
  const spread = askingAvg > 0 ? ((askingAvg - soldAvg) / askingAvg) * 100 : 0;
  if (mds < 20 && spread < 3 && (activeCount ?? 99) < 5) return "BUY_STRONG";
  if (mds < 50 && spread < 6) return "BUY_AT_MARKET";
  if (mds < 80 || spread < 10) return "BUY_CAREFULLY";
  return "PASS";
}

const SIGNAL_CONFIG: Record<MarketSignal, { label: string; emoji: string; color: string; description: string }> = {
  BUY_STRONG: {
    label: "BUY STRONG",
    emoji: "🟢",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    description: "Low supply, tight spread, few comps — step up to acquire",
  },
  BUY_AT_MARKET: {
    label: "BUY AT MARKET",
    emoji: "🔵",
    color: "bg-primary/10 text-primary border-primary/30",
    description: "Normal supply and spread — standard acquisition",
  },
  BUY_CAREFULLY: {
    label: "BUY CAREFULLY",
    emoji: "🟡",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    description: "Elevated supply or widening spread — protect margin",
  },
  PASS: {
    label: "PASS / WHOLESALE",
    emoji: "🔴",
    color: "bg-destructive/15 text-destructive border-destructive/30",
    description: "High supply, wide spread — wholesale or pass",
  },
};

interface Props {
  mds: number | null | undefined;
  soldAvg: number | null | undefined;
  askingAvg: number | null | undefined;
  activeCount: number | null | undefined;
}

export default function MarketSignalBadge({ mds, soldAvg, askingAvg, activeCount }: Props) {
  const signal = getMarketSignal(mds, soldAvg, askingAvg, activeCount);
  if (!signal) return null;
  const cfg = SIGNAL_CONFIG[signal];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={`text-[9px] font-bold gap-1 ${cfg.color}`}>
            {cfg.emoji} {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">{cfg.description}</p>
          {mds != null && <p className="text-[10px] text-muted-foreground mt-1">MDS: {mds}d</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
