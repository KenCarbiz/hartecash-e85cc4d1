/**
 * Per-product brand color palette, derived from each product's logo:
 *   • AutoCurb   — fresh green (cloud-to-curb pixelated logo)
 *   • AutoLabels — warm orange (luggage-tag-with-$-sign logo)
 *   • AutoFilm   — vibrant blue (speech-bubble-with-car logo)
 *   • AutoFrame  — vivid purple (camera-viewfinder-framing-car logo)
 *
 * Used by the Billing & Plan picker to give each row its own visual
 * identity, instead of every product borrowing the generic primary
 * blue. Audi/Ferrari design rule: brand color as accent, never as
 * container — the tints are deliberately soft so the catalog feels
 * cohesive rather than rainbow-coded.
 *
 * Each entry exposes a small set of Tailwind class fragments so
 * components can opt in to whichever surface they need:
 *   .iconBg     — solid bg + white text for the active icon-box
 *   .iconTint   — subtle bg tint + brand-colored icon for resting
 *   .ring       — selection ring color
 *   .border     — selection border color
 *   .softBg     — selection background tint (very subtle)
 *   .text       — brand-colored text for labels
 *   .badge      — brand-colored "selected" pill
 */

export interface ProductBrand {
  iconBg: string;
  iconTint: string;
  ring: string;
  border: string;
  softBg: string;
  text: string;
  badge: string;
  /** Inline `style` color value for arbitrary spots (gradients, dots). */
  hex: string;
}

const FALLBACK: ProductBrand = {
  iconBg: "bg-primary text-primary-foreground",
  iconTint: "bg-muted text-muted-foreground",
  ring: "ring-primary/25",
  border: "border-primary",
  softBg: "bg-primary/[0.04]",
  text: "text-primary",
  badge: "bg-primary text-primary-foreground",
  hex: "hsl(210 100% 25%)",
};

export const PRODUCT_BRAND: Record<string, ProductBrand> = {
  autocurb: {
    iconBg: "bg-emerald-500 text-white",
    iconTint: "bg-emerald-500/10 text-emerald-600",
    ring: "ring-emerald-500/25",
    border: "border-emerald-500",
    softBg: "bg-emerald-500/[0.04]",
    text: "text-emerald-700",
    badge: "bg-emerald-500 text-white",
    hex: "#10b981",
  },
  autolabels: {
    iconBg: "bg-blue-500 text-white",
    iconTint: "bg-blue-500/10 text-blue-600",
    ring: "ring-blue-500/25",
    border: "border-blue-500",
    softBg: "bg-blue-500/[0.04]",
    text: "text-blue-700",
    badge: "bg-blue-500 text-white",
    hex: "#3b82f6",
  },
  autofilm: {
    iconBg: "bg-orange-500 text-white",
    iconTint: "bg-orange-500/10 text-orange-600",
    ring: "ring-orange-500/25",
    border: "border-orange-500",
    softBg: "bg-orange-500/[0.04]",
    text: "text-orange-700",
    badge: "bg-orange-500 text-white",
    hex: "#f97316",
  },
  autoframe: {
    iconBg: "bg-violet-500 text-white",
    iconTint: "bg-violet-500/10 text-violet-600",
    ring: "ring-violet-500/25",
    border: "border-violet-500",
    softBg: "bg-violet-500/[0.04]",
    text: "text-violet-700",
    badge: "bg-violet-500 text-white",
    hex: "#8b5cf6",
  },
};

export function brandFor(productId: string): ProductBrand {
  return PRODUCT_BRAND[productId] ?? FALLBACK;
}

/**
 * The 4-color gradient used on the All-Apps Unlimited bundle row to
 * signal "everything in one." Order matches the row order:
 * AutoCurb (emerald) → AutoLabels (blue) → AutoFrame (violet) → AutoFilm (orange).
 */
export const ALL_APPS_GRADIENT_BG =
  "bg-[linear-gradient(135deg,rgba(16,185,129,0.06)_0%,rgba(59,130,246,0.05)_33%,rgba(139,92,246,0.05)_66%,rgba(249,115,22,0.06)_100%)]";

export const ALL_APPS_GRADIENT_BAR =
  "bg-[linear-gradient(90deg,#10b981_0%,#3b82f6_33%,#8b5cf6_66%,#f97316_100%)]";
