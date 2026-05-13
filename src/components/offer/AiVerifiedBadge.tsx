import { Sparkles, ShieldCheck } from "lucide-react";

const RANK: Record<string, number> = {
  excellent: 4,
  very_good: 3,
  good: 2,
  fair: 1,
  poor: 0,
};

interface Props {
  customerCondition: string | null;
  aiCondition: string | null;
  variant?: "light" | "dark";
  className?: string;
}

/**
 * AI Verified condition badge — shown on the consumer offer page when our
 * AI vision read the customer's photos and either confirmed or upgraded
 * their self-reported condition. If AI rated the car *worse* than the
 * customer, we don't punish them on the offer page — we surface a soft
 * "we'll confirm at inspection" line instead.
 */
export function AiVerifiedBadge({ customerCondition, aiCondition, variant = "light", className = "" }: Props) {
  if (!aiCondition) return null;

  const customerRank = RANK[customerCondition?.toLowerCase() || ""] ?? null;
  const aiRank = RANK[aiCondition.toLowerCase()] ?? null;
  if (aiRank == null) return null;

  // AI agrees with or upgrades the customer's read → trust badge.
  if (customerRank == null || aiRank >= customerRank) {
    const onLight = "bg-emerald-50 text-emerald-700 border-emerald-200";
    const onDark = "bg-emerald-400/15 text-emerald-200 border-emerald-300/30";
    return (
      <span
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-bold ${variant === "dark" ? onDark : onLight} ${className}`}
        title="Our AI reviewed your photos and confirmed the condition you selected. Your offer is locked at this grade."
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        Verified by AI
      </span>
    );
  }

  // AI rated lower — soft reminder, never a downgrade on the offer page.
  const onLight = "bg-slate-100 text-slate-600 border-slate-200";
  const onDark = "bg-white/10 text-white/70 border-white/20";
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium ${variant === "dark" ? onDark : onLight} ${className}`}
      title="We'll confirm the final condition during your in-person inspection. The number above is your offer based on what you reported."
    >
      <Sparkles className="w-3.5 h-3.5" />
      We'll confirm at inspection
    </span>
  );
}
