/**
 * Document dimension data for camera guide overlays.
 *
 * Driver's licenses: All US states use ISO ID-1 (credit-card) format:
 *   3.375 × 2.125 inches → aspect ratio ≈ 1.588 (landscape)
 *
 * Vehicle titles: Vary by state. Grouped into common size categories.
 *   - "letter-landscape"  8.5 × 11   → ratio ≈ 0.773 (portrait held landscape)
 *   - "letter-portrait"   11 × 8.5   → ratio ≈ 1.294
 *   - "half-letter"       8.5 × 5.5  → ratio ≈ 1.545
 *   - "legal"             8.5 × 14   → ratio ≈ 0.607
 *   - "custom"            state-specific
 */

export interface DocDimensions {
  /** width / height when held in expected orientation */
  aspectRatio: number;
  /** human-readable label */
  sizeLabel: string;
  /** orientation hint for guide */
  orientation: "landscape" | "portrait";
}

// Standard US driver's license — same for every state
export const DL_DIMENSIONS: DocDimensions = {
  aspectRatio: 3.375 / 2.125, // ~1.588
  sizeLabel: "Standard ID (credit-card size)",
  orientation: "landscape",
};

type TitleSizeKey = "letter_portrait" | "letter_landscape" | "half_letter" | "legal";

const TITLE_SIZES: Record<TitleSizeKey, DocDimensions> = {
  letter_portrait: {
    aspectRatio: 8.5 / 11,
    sizeLabel: "Letter (portrait)",
    orientation: "portrait",
  },
  letter_landscape: {
    aspectRatio: 11 / 8.5,
    sizeLabel: "Letter (landscape)",
    orientation: "landscape",
  },
  half_letter: {
    aspectRatio: 8.5 / 5.5,
    sizeLabel: "Half-letter",
    orientation: "landscape",
  },
  legal: {
    aspectRatio: 8.5 / 14,
    sizeLabel: "Legal size (portrait)",
    orientation: "portrait",
  },
};

/**
 * State → title size mapping.
 * Sources: state DMV websites & common title formats.
 * Default: letter_portrait (most common).
 */
const STATE_TITLE_SIZE: Record<string, TitleSizeKey> = {
  // Half-letter states (single-sheet, smaller format)
  AL: "half_letter",
  AK: "half_letter",
  AZ: "half_letter",
  AR: "half_letter",
  HI: "half_letter",
  ID: "half_letter",
  KS: "half_letter",
  ME: "half_letter",
  MT: "half_letter",
  NE: "half_letter",
  NV: "half_letter",
  NH: "half_letter",
  NM: "half_letter",
  ND: "half_letter",
  SD: "half_letter",
  UT: "half_letter",
  VT: "half_letter",
  WV: "half_letter",
  WY: "half_letter",

  // Letter landscape states
  CA: "letter_landscape",
  FL: "letter_landscape",
  TX: "letter_landscape",
  NY: "letter_landscape",
  IL: "letter_landscape",
  OH: "letter_landscape",
  PA: "letter_landscape",
  MI: "letter_landscape",
  GA: "letter_landscape",
  NC: "letter_landscape",
  NJ: "letter_landscape",
  VA: "letter_landscape",
  WA: "letter_landscape",
  MA: "letter_landscape",
  IN: "letter_landscape",
  TN: "letter_landscape",
  MO: "letter_landscape",
  MD: "letter_landscape",
  WI: "letter_landscape",
  MN: "letter_landscape",
  CO: "letter_landscape",
  SC: "letter_landscape",
  OR: "letter_landscape",
  OK: "letter_landscape",
  IA: "letter_landscape",
  MS: "letter_landscape",
  CT: "letter_landscape",
  LA: "letter_landscape",
  KY: "letter_landscape",
  RI: "letter_landscape",
  DE: "letter_landscape",
  DC: "letter_landscape",
};

export function getTitleDimensions(stateCode?: string | null): DocDimensions {
  if (!stateCode) return TITLE_SIZES.letter_landscape; // default
  const key = STATE_TITLE_SIZE[stateCode.toUpperCase()] || "letter_landscape";
  return TITLE_SIZES[key];
}

/** Registration is typically letter-portrait — no state variation needed */
export const REGISTRATION_DIMENSIONS: DocDimensions = {
  aspectRatio: 8.5 / 11,
  sizeLabel: "Standard document",
  orientation: "portrait",
};

/**
 * Get dimensions for a document type.
 */
export function getDocDimensions(
  docType: string,
  stateCode?: string | null
): DocDimensions {
  if (docType.startsWith("drivers_license")) return DL_DIMENSIONS;
  if (docType.startsWith("title")) return getTitleDimensions(stateCode);
  return REGISTRATION_DIMENSIONS;
}
