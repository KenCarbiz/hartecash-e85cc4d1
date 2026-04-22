/**
 * Maps Black Book body styles to GhostCar silhouette archetypes.
 * vehicleType is derived from BB VIN decode class_name field.
 */

export type VehicleArchetype = "sedan" | "compact_suv" | "midsize_suv" | "large_suv" | "truck" | "van";

export interface ArchetypeShape {
  roofHeight: number;
  roofStart: number;
  roofEnd: number;
  label: string;
  hasBed?: boolean;
  isVan?: boolean;
}

export const ARCHETYPE_SHAPES: Record<VehicleArchetype, ArchetypeShape> = {
  sedan:       { roofHeight: 0.38, roofStart: 0.26, roofEnd: 0.76, label: "Sedan" },
  compact_suv: { roofHeight: 0.30, roofStart: 0.18, roofEnd: 0.82, label: "Compact SUV" },
  midsize_suv: { roofHeight: 0.28, roofStart: 0.16, roofEnd: 0.84, label: "Midsize SUV" },
  large_suv:   { roofHeight: 0.25, roofStart: 0.14, roofEnd: 0.86, label: "Large SUV" },
  truck:       { roofHeight: 0.28, roofStart: 0.46, roofEnd: 0.88, label: "Truck", hasBed: true },
  van:         { roofHeight: 0.22, roofStart: 0.08, roofEnd: 0.92, label: "Van", isVan: true },
};

/**
 * Map a Black Book class_name to a vehicle archetype.
 * Falls back to sedan if unrecognized.
 */
const CLASS_MAP: Record<string, VehicleArchetype> = {
  // Sedans / Coupes / Hatchbacks
  "sedan": "sedan",
  "compact car": "sedan",
  "mid-size car": "sedan",
  "full-size car": "sedan",
  "luxury car": "sedan",
  "sports car": "sedan",
  "coupe": "sedan",
  "hatchback": "sedan",
  "convertible": "sedan",
  "wagon": "sedan",

  // Compact SUVs
  "compact sport utility": "compact_suv",
  "small sport utility": "compact_suv",
  "compact suv": "compact_suv",
  "subcompact sport utility": "compact_suv",
  "crossover": "compact_suv",

  // Midsize SUVs
  "mid-size sport utility": "midsize_suv",
  "midsize sport utility": "midsize_suv",
  "sport utility": "midsize_suv",
  "medium sport utility": "midsize_suv",

  // Large SUVs
  "full-size sport utility": "large_suv",
  "large sport utility": "large_suv",

  // Trucks
  "compact pickup": "truck",
  "mid-size pickup": "truck",
  "full-size pickup": "truck",
  "pickup": "truck",
  "light duty pickup": "truck",
  "heavy duty pickup": "truck",

  // Vans
  "van": "van",
  "minivan": "van",
  "cargo van": "van",
  "passenger van": "van",
  "full-size van": "van",
};

export function classToArchetype(className?: string | null): VehicleArchetype {
  if (!className) return "sedan";
  const key = className.toLowerCase().trim();
  return CLASS_MAP[key] || "sedan";
}
