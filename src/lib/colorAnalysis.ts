/**
 * Pure color-analysis utilities — runs entirely client-side, no API calls.
 *
 * Used by Prospect Demo (and eventually Live Preview) to:
 *   1. Extract the dealer's dominant palette from a screenshot.
 *   2. Recommend an attention-grabbing accent color that contrasts
 *      hard against the dealer's existing palette and meets WCAG AA.
 *
 * The "attention" pick comes from a curated set of colors that have a
 * track record of pulling clicks (orange, lime, magenta, etc.). We
 * filter the curated set to ones that:
 *   - hit ≥4.5:1 contrast against white (so the CTA reads on a card)
 *   - hit ≥4.5:1 contrast against the dealer's primary background
 *   - are at least 60° apart in hue from anything in the dealer's
 *     palette (so the CTA doesn't blend in)
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface PaletteColor {
  hex: string;
  rgb: RGB;
  /** Approximate share of pixels this color (or its bucket) represents,
   *  0–1. Sum of all PaletteColor weights ≈ 1. */
  weight: number;
}

export interface AttentionRecommendation {
  hex: string;
  name: string;
  /** Why we picked it — surfaced in the UI tooltip / explanation. */
  reasoning: string;
  /** WCAG contrast against white (CTA on white card). */
  contrastVsWhite: number;
  /** WCAG contrast against the dealer's primary color. */
  contrastVsPrimary: number;
}

// Curated palette of "shouts at you" colors, ordered roughly by how
// reliably they convert in CTA buttons across the e-commerce / SaaS
// industry. Reference: HubSpot, Optimizely, and CXL studies on CTA
// color performance — orange and red consistently top the charts.
const ATTENTION_PALETTE: { hex: string; name: string }[] = [
  { hex: "#F97316", name: "Action Orange" },
  { hex: "#EF4444", name: "Urgency Red" },
  { hex: "#84CC16", name: "Lime Green" },
  { hex: "#EC4899", name: "Hot Magenta" },
  { hex: "#FACC15", name: "Electric Yellow" },
  { hex: "#10B981", name: "Emerald" },
  { hex: "#8B5CF6", name: "Violet" },
];

// ── Hex / RGB conversion ────────────────────────────────────────────

export const hexToRgb = (hex: string): RGB | null => {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 6 && cleaned.length !== 3) return null;
  const expanded = cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned;
  const num = parseInt(expanded, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

export const rgbToHex = ({ r, g, b }: RGB): string => {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

// ── HSL conversion (used for hue distance) ──────────────────────────

export const rgbToHsl = ({ r, g, b }: RGB): { h: number; s: number; l: number } => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)); break;
      case gNorm: h = ((bNorm - rNorm) / d + 2); break;
      case bNorm: h = ((rNorm - gNorm) / d + 4); break;
    }
    h *= 60;
  }
  return { h, s, l };
};

// Smallest distance between two hues on the 360° circle.
const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// ── WCAG relative luminance + contrast ratio ────────────────────────

const channelLuminance = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export const relativeLuminance = ({ r, g, b }: RGB): number =>
  0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);

export const contrastRatio = (a: RGB, b: RGB): number => {
  const lA = relativeLuminance(a);
  const lB = relativeLuminance(b);
  const [light, dark] = lA > lB ? [lA, lB] : [lB, lA];
  return (light + 0.05) / (dark + 0.05);
};

// ── Palette extraction from an image URL ────────────────────────────

/**
 * Extract a representative palette from an image URL. Buckets pixels by
 * a coarse 5-bit-per-channel quantization (32 buckets per channel,
 * 32,768 possible buckets) then returns the top N most-populated buckets.
 *
 * Skips near-white and near-black pixels — those usually represent
 * page chrome, not brand color. Caller can opt out with includeNeutrals.
 *
 * Requires CORS-enabled image (microlink screenshot URLs work because
 * microlink serves them with Access-Control-Allow-Origin: *).
 */
export const extractPalette = async (
  imageUrl: string,
  options: { topN?: number; includeNeutrals?: boolean; sampleStep?: number } = {},
): Promise<PaletteColor[]> => {
  const { topN = 5, includeNeutrals = false, sampleStep = 4 } = options;

  const img = await loadImage(imageUrl);

  // Down-sample to 200px max-dimension. Keeps the analysis snappy
  // (~40k pixels max) without losing dominant-color signal.
  const maxDim = 200;
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const w = Math.floor(img.width * ratio);
  const h = Math.floor(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch (e) {
    // CORS taint — image can't be analyzed.
    throw new Error("Image is CORS-tainted; cannot extract palette");
  }

  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue;
    if (!includeNeutrals && isNeutral(r, g, b)) continue;
    // 5-bit quantization → 32 buckets per channel
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      existing.r += r;
      existing.g += g;
      existing.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const total = Array.from(buckets.values()).reduce((sum, b) => sum + b.count, 0) || 1;
  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map((b) => ({
      rgb: {
        r: Math.round(b.r / b.count),
        g: Math.round(b.g / b.count),
        b: Math.round(b.b / b.count),
      },
      weight: b.count / total,
    }))
    .map<PaletteColor>(({ rgb, weight }) => ({ hex: rgbToHex(rgb), rgb, weight }));

  return sorted;
};

// "Neutral" = near white, near black, or near grey. These don't tell us
// anything useful about the dealer's brand identity.
const isNeutral = (r: number, g: number, b: number): boolean => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // very light or very dark
  if (max < 30 || min > 230) return true;
  // very low chroma (grey)
  if (max - min < 20) return true;
  return false;
};

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

// ── Attention-color recommendation ──────────────────────────────────

/**
 * Given a dealer's palette, recommend up to 3 attention CTAs from the
 * curated list. Filters by WCAG-AA contrast and hue distance from the
 * dealer's existing colors.
 */
export const recommendAttentionColors = (
  palette: PaletteColor[],
  options: { count?: number; minContrastWhite?: number; minHueDistance?: number } = {},
): AttentionRecommendation[] => {
  const { count = 3, minContrastWhite = 4.5, minHueDistance = 60 } = options;

  const white: RGB = { r: 255, g: 255, b: 255 };
  // Primary = the heaviest non-neutral palette entry. Falls back to
  // pure black if the dealer site is mostly white-on-white.
  const primary = palette[0]?.rgb ?? { r: 26, g: 26, b: 26 };
  const primaryHex = rgbToHex(primary);
  const dealerHues = palette.map((p) => rgbToHsl(p.rgb).h);

  const scored = ATTENTION_PALETTE.map((candidate) => {
    const rgb = hexToRgb(candidate.hex)!;
    const contrastVsWhite = contrastRatio(rgb, white);
    const contrastVsPrimary = contrastRatio(rgb, primary);
    const hue = rgbToHsl(rgb).h;
    const minHueGap = dealerHues.length
      ? Math.min(...dealerHues.map((h) => hueDistance(hue, h)))
      : 180;

    return {
      candidate,
      rgb,
      contrastVsWhite,
      contrastVsPrimary,
      minHueGap,
      // Composite score — contrast pulls more weight than hue distance,
      // since a CTA that fails WCAG is unusable.
      score:
        Math.min(contrastVsWhite, 21) * 1.5 +
        Math.min(contrastVsPrimary, 21) * 1.0 +
        (minHueGap / 180) * 4,
    };
  });

  const filtered = scored
    .filter((s) => s.contrastVsWhite >= minContrastWhite)
    .filter((s) => s.minHueGap >= minHueDistance);

  // If filter is too strict (dealer site has every hue), fall back to
  // contrast-only ranking. Always return SOMETHING, never empty.
  const pool = filtered.length >= count ? filtered : scored;

  return pool
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map<AttentionRecommendation>((s) => ({
      hex: s.candidate.hex,
      name: s.candidate.name,
      contrastVsWhite: round(s.contrastVsWhite, 1),
      contrastVsPrimary: round(s.contrastVsPrimary, 1),
      reasoning: buildReasoning(s.candidate.name, s.contrastVsWhite, primaryHex, s.minHueGap),
    }));
};

const buildReasoning = (
  name: string,
  contrastVsWhite: number,
  primaryHex: string,
  hueGap: number,
): string => {
  const parts: string[] = [];
  parts.push(`${name} hits ${round(contrastVsWhite, 1)}:1 contrast on white (WCAG AA needs 4.5:1).`);
  if (hueGap >= 90) {
    parts.push(`Sits ~${Math.round(hueGap)}° opposite the dealer's primary ${primaryHex} — won't blend in.`);
  } else if (hueGap >= 60) {
    parts.push(`Far enough in hue from ${primaryHex} to stand out.`);
  } else {
    parts.push(`Closest to ${primaryHex} in hue — pick a different option if it visually competes.`);
  }
  return parts.join(" ");
};

const round = (n: number, places: number): number => {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
};
