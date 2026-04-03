import { supabase } from "@/integrations/supabase/client";
import type { BBAddDeduct, BBVehicle, FormData } from "@/components/sell-form/types";

type JsonLike<T> = T | string | null | undefined;

interface StoredBBValueTiers {
  wholesale?: Partial<BBVehicle["wholesale"]>;
  tradein?: Partial<BBVehicle["tradein"]>;
  retail?: Partial<BBVehicle["retail"]>;
}

export interface StoredOfferInputs {
  vehicle_year?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vin?: string | null;
  mileage?: string | null;
  exterior_color?: string | null;
  overall_condition?: string | null;
  drivetrain?: string | null;
  modifications?: string | null;
  accidents?: string | null;
  exterior_damage?: JsonLike<string[]>;
  windshield_damage?: string | null;
  moonroof?: string | null;
  interior_damage?: JsonLike<string[]>;
  tech_issues?: JsonLike<string[]>;
  engine_issues?: JsonLike<string[]>;
  mechanical_issues?: JsonLike<string[]>;
  drivable?: string | null;
  smoked_in?: string | null;
  tires_replaced?: string | null;
  num_keys?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  zip?: string | null;
  bb_msrp?: number | null;
  bb_class_name?: string | null;
  bb_drivetrain?: string | null;
  bb_transmission?: string | null;
  bb_fuel_type?: string | null;
  bb_engine?: string | null;
  bb_mileage_adj?: number | null;
  bb_regional_adj?: number | null;
  bb_base_whole_avg?: number | null;
  bb_tradein_avg?: number | null;
  bb_wholesale_avg?: number | null;
  bb_retail_avg?: number | null;
  bb_value_tiers?: JsonLike<StoredBBValueTiers>;
  bb_add_deducts?: JsonLike<BBAddDeduct[]>;
  bb_selected_options?: JsonLike<string[]>;
}

export function parseStoredJson<T>(value: JsonLike<T>, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

const normalizeArray = (value: JsonLike<string[]>): string[] => {
  const parsed = parseStoredJson<string[]>(value, []);
  return Array.isArray(parsed) ? parsed : [];
};

export function buildStoredBBVehicle(input: StoredOfferInputs): BBVehicle | null {
  const tiers = parseStoredJson<StoredBBValueTiers>(input.bb_value_tiers, {});
  const addDeducts = normalizeArray(input.bb_add_deducts as JsonLike<string[]>) as unknown as BBAddDeduct[];

  const wholesaleAvg = tiers.wholesale?.avg ?? input.bb_wholesale_avg ?? 0;
  const tradeinAvg = tiers.tradein?.avg ?? input.bb_tradein_avg ?? 0;
  const retailAvg = tiers.retail?.avg ?? input.bb_retail_avg ?? 0;

  if (wholesaleAvg <= 0 && tradeinAvg <= 0 && retailAvg <= 0) return null;

  return {
    uvc: "",
    vin: input.vin || "",
    year: input.vehicle_year || "",
    make: input.vehicle_make || "",
    model: input.vehicle_model || "",
    series: "",
    style: "",
    class_name: input.bb_class_name || "",
    msrp: Number(input.bb_msrp || 0),
    price_includes: "",
    drivetrain: input.bb_drivetrain || "",
    transmission: input.bb_transmission || "",
    engine: input.bb_engine || "",
    fuel_type: input.bb_fuel_type || "",
    exterior_colors: [],
    mileage_adj: input.bb_mileage_adj || 0,
    regional_adj: input.bb_regional_adj || 0,
    base_whole_avg: input.bb_base_whole_avg || 0,
    add_deduct_list: addDeducts,
    wholesale: {
      xclean: tiers.wholesale?.xclean ?? tiers.wholesale?.clean ?? wholesaleAvg,
      clean: tiers.wholesale?.clean ?? wholesaleAvg,
      avg: wholesaleAvg,
      rough: tiers.wholesale?.rough ?? wholesaleAvg,
    },
    tradein: {
      clean: tiers.tradein?.clean ?? tradeinAvg,
      avg: tradeinAvg,
      rough: tiers.tradein?.rough ?? tradeinAvg,
    },
    retail: {
      xclean: tiers.retail?.xclean ?? tiers.retail?.clean ?? retailAvg,
      clean: tiers.retail?.clean ?? retailAvg,
      avg: retailAvg,
      rough: tiers.retail?.rough ?? retailAvg,
    },
  };
}

export function buildOfferFormData(input: StoredOfferInputs): FormData {
  return {
    plate: "",
    state: "",
    vin: input.vin || "",
    mileage: input.mileage || "",
    bbUvc: "",
    bbSelectedAddDeducts: parseStoredJson<string[]>(input.bb_selected_options, []),
    exteriorColor: input.exterior_color || "",
    drivetrain: input.drivetrain || "",
    modifications: input.modifications || "",
    overallCondition: input.overall_condition || "good",
    exteriorDamage: normalizeArray(input.exterior_damage),
    windshieldDamage: input.windshield_damage || "",
    moonroof: input.moonroof || "",
    interiorDamage: normalizeArray(input.interior_damage),
    techIssues: normalizeArray(input.tech_issues),
    engineIssues: normalizeArray(input.engine_issues),
    mechanicalIssues: normalizeArray(input.mechanical_issues),
    drivable: input.drivable || "",
    accidents: input.accidents || "",
    smokedIn: input.smoked_in || "",
    tiresReplaced: input.tires_replaced || "",
    numKeys: input.num_keys || "",
    name: input.name || "",
    phone: input.phone || "",
    email: input.email || "",
    zip: input.zip || "",
    loanStatus: "",
    loanCompany: "",
    loanBalance: "",
    loanPayment: "",
    nextStep: "",
    preferredLocationId: "",
    salespersonName: "",
  };
}

export function buildSubmissionBBPayload(bbVehicle: BBVehicle | null) {
  if (!bbVehicle) {
    return {
      bb_tradein_avg: null,
      bb_wholesale_avg: null,
      bb_retail_avg: null,
      bb_value_tiers: null,
      bb_add_deducts: null,
      bb_msrp: null,
      bb_class_name: null,
      bb_drivetrain: null,
      bb_transmission: null,
      bb_fuel_type: null,
      bb_engine: null,
      bb_mileage_adj: null,
      bb_regional_adj: null,
      bb_base_whole_avg: null,
    };
  }

  return {
    bb_tradein_avg: bbVehicle.tradein?.avg ?? null,
    bb_wholesale_avg: bbVehicle.wholesale?.avg ?? null,
    bb_retail_avg: bbVehicle.retail?.avg ?? null,
    bb_value_tiers: {
      wholesale: bbVehicle.wholesale,
      tradein: bbVehicle.tradein,
      retail: bbVehicle.retail,
    },
    bb_add_deducts: bbVehicle.add_deduct_list ?? null,
    bb_msrp: bbVehicle.msrp ?? null,
    bb_class_name: bbVehicle.class_name || null,
    bb_drivetrain: bbVehicle.drivetrain || null,
    bb_transmission: bbVehicle.transmission || null,
    bb_fuel_type: bbVehicle.fuel_type || null,
    bb_engine: bbVehicle.engine || null,
    bb_mileage_adj: bbVehicle.mileage_adj ?? null,
    bb_regional_adj: bbVehicle.regional_adj ?? null,
    bb_base_whole_avg: bbVehicle.base_whole_avg ?? null,
  };
}

export async function fetchMileageAdjustedBBVehicle({
  vin,
  mileage,
  state = "CT",
  uvc,
}: {
  vin: string;
  mileage: number;
  state?: string;
  uvc?: string;
}): Promise<BBVehicle | null> {
  const body: Record<string, unknown> = {
    lookup_type: "vin",
    vin,
    mileage,
    state,
  };

  if (uvc) body.uvc = uvc;

  const { data, error } = await supabase.functions.invoke("bb-lookup", { body });

  if (error || data?.error || !Array.isArray(data?.vehicles) || data.vehicles.length === 0) {
    return null;
  }

  const exactVehicle = uvc
    ? (data.vehicles as BBVehicle[]).find((vehicle) => vehicle.uvc === uvc)
    : null;

  return exactVehicle || (data.vehicles[0] as BBVehicle);
}