/**
 * Compact pill that surfaces a photo's EXIF/GPS verification result
 * from the photoExif parser (or a row from `photo_metadata`). Used on
 * both customer upload tiles and staff/admin photo galleries so the
 * trust signal is consistent end-to-end.
 *
 * Tiers:
 *   verified    ✓ Verified   — GPS in expected region, recent capture
 *   likely      ◎ Likely     — GPS present but partial signal
 *   unverified  ? Unverified — No EXIF (iMessage/WhatsApp strip it)
 *   suspicious  ⚠ Suspicious — Far from expected, very stale, or edited
 */
import { ShieldCheck, ShieldQuestion, ShieldAlert, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhotoTrustTier } from "@/lib/photoExif";

interface PhotoTrustBadgeProps {
  tier: PhotoTrustTier;
  reasons?: string[] | null;
  distanceMiles?: number | null;
  size?: "xs" | "sm";
  className?: string;
}

const CONFIG: Record<PhotoTrustTier, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  verified:   { label: "Verified",   cls: "bg-success/10 text-success border-success/30",                Icon: ShieldCheck },
  likely:     { label: "Likely",     cls: "bg-primary/10 text-primary border-primary/30",                Icon: Shield },
  unverified: { label: "Unverified", cls: "bg-muted text-muted-foreground border-border",                Icon: ShieldQuestion },
  suspicious: { label: "Suspicious", cls: "bg-destructive/10 text-destructive border-destructive/30",   Icon: ShieldAlert },
};

const PhotoTrustBadge = ({ tier, reasons, distanceMiles, size = "xs", className }: PhotoTrustBadgeProps) => {
  const cfg = CONFIG[tier];
  const tip = (reasons && reasons.length > 0)
    ? reasons.join(" · ")
    : distanceMiles != null
    ? `~${Math.round(distanceMiles)} mi from expected location`
    : cfg.label;
  return (
    <span
      title={tip}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider",
        size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        cfg.cls,
        className,
      )}
    >
      <cfg.Icon className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {cfg.label}
    </span>
  );
};

export default PhotoTrustBadge;
