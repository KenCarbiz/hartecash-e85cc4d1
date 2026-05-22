/**
 * Heuristic body-style inference from year/make/model so the
 * VehicleImageCard can pick the right silhouette fallback when no
 * actual vehicle photo is available.
 *
 * Order matters: trucks before SUVs (Ridgeline/Gladiator/Maverick),
 * SUVs before sedans (model names overlap), then default sedan.
 */

export type VehicleBodyStyle = "truck" | "suv" | "coupe" | "sedan";

const TRUCK_MODELS = [
  "f-150", "f150", "f-250", "f250", "f-350", "f350", "f-450", "f450",
  "silverado", "sierra",
  "ram 1500", "ram 2500", "ram 3500", "ram1500", "ram2500", "ram3500",
  "tacoma", "tundra",
  "frontier", "titan",
  "colorado", "canyon",
  "ridgeline",
  "maverick", "ranger",
  "gladiator",
  "hummer ev", "cybertruck", "lightning", "rivian r1t",
];

const SUV_MODELS = [
  // Compact / mid SUVs
  "rav4", "crv", "cr-v", "hr-v", "hrv", "pilot", "passport",
  "rogue", "murano", "pathfinder", "armada", "kicks",
  "escape", "edge", "explorer", "expedition", "bronco",
  "equinox", "blazer", "tahoe", "suburban", "trax", "traverse",
  "terrain", "yukon", "acadia",
  "highlander", "4runner", "sequoia", "land cruiser", "venza", "corolla cross",
  "rx", "nx", "gx", "lx", "tx", "ux", "rz",
  "qx30", "qx50", "qx55", "qx60", "qx70", "qx80",
  "mdx", "rdx", "zdx",
  "sportage", "sorento", "telluride", "seltos", "soul", "niro",
  "santa fe", "tucson", "palisade", "venue", "kona",
  "cx-3", "cx-30", "cx-5", "cx-50", "cx-9", "cx-90",
  "outback", "forester", "ascent", "crosstrek",
  "tiguan", "atlas", "id.4", "id4",
  "x1", "x2", "x3", "x4", "x5", "x6", "x7",
  "glb", "gla", "glc", "gle", "gls", "g-class", "g 550", "g 580", "g 63", "eqb", "eqe suv", "eqs suv",
  "q3", "q4", "q5", "q7", "q8", "e-tron",
  "macan", "cayenne",
  "wrangler", "compass", "renegade", "cherokee", "grand cherokee", "wagoneer", "gladiator",
  "discovery", "defender", "range rover", "evoque", "velar",
  "xc40", "xc60", "xc90",
  "model x", "model y", "rivian r1s",
  "bz4x", "ariya", "ioniq 5", "ioniq 9", "ev6", "ev9",
  "envision", "enclave", "encore", "envista",
];

export function inferBodyStyle(
  make?: string | null,
  model?: string | null,
): VehicleBodyStyle {
  const m = `${(make ?? "").toLowerCase()} ${(model ?? "").toLowerCase()}`.trim();
  if (!m) return "sedan";

  for (const t of TRUCK_MODELS) if (m.includes(t)) return "truck";
  for (const s of SUV_MODELS) if (m.includes(s)) return "suv";

  // Brand-level SUV-leaning fallback
  if (/\b(jeep|land rover|range rover)\b/.test(m)) return "suv";

  // Coupe-ish keywords
  if (/(coupe|gt|mustang|camaro|challenger|corvette|supra|brz|gr86|718|nsx|gr corolla|civic type r)/.test(m)) {
    return "coupe";
  }

  return "sedan";
}
