import { supabase } from "@/integrations/supabase/client";

interface LocationWithZips {
  id: string;
  name: string;
  city: string;
  state: string;
  zip_codes: string[];
  oem_brands: string[];
  center_zip: string;
  coverage_radius_miles: number;
  all_brands: boolean;
  excluded_oem_brands: string[];
}

let cachedLocations: LocationWithZips[] | null = null;

async function getLocations(): Promise<LocationWithZips[]> {
  if (!cachedLocations) {
    const { data } = await supabase
      .from("dealership_locations")
      .select("id, name, city, state, zip_codes, oem_brands, center_zip, coverage_radius_miles, all_brands, excluded_oem_brands")
      .eq("is_active", true)
      .order("sort_order");
    cachedLocations = (data as any) || [];
  }
  return cachedLocations!;
}

/**
 * Find the best matching dealership location for a given customer ZIP code.
 */
export async function findStoreByZip(customerZip: string): Promise<string | null> {
  if (!customerZip || customerZip.length < 5) return null;
  const zip5 = customerZip.slice(0, 5);
  const locations = await getLocations();

  // Exact match on listed ZIP codes
  for (const loc of locations) {
    if (loc.zip_codes && loc.zip_codes.includes(zip5)) return loc.id;
  }

  // Radius match: if a location has a center_zip and radius, use prefix-based proximity
  // ZIP codes sharing the first 3 digits are typically within ~50 miles
  const prefix = zip5.slice(0, 3);
  for (const loc of locations) {
    if (loc.center_zip && loc.coverage_radius_miles > 0) {
      const centerPrefix = loc.center_zip.slice(0, 3);
      if (centerPrefix === prefix) return loc.id;
    }
  }

  // Prefix match on listed ZIPs (first 3 digits)
  for (const loc of locations) {
    if (loc.zip_codes?.some(z => z.startsWith(prefix))) return loc.id;
  }

  // Default to first location
  return locations.length > 0 ? locations[0].id : null;
}

/**
 * Find the best matching dealership by OEM brand of the vehicle being sold.
 * Falls back to null if no brand match found.
 */
export async function findStoreByBrand(vehicleMake: string): Promise<string | null> {
  if (!vehicleMake) return null;
  const locations = await getLocations();
  const make = vehicleMake.toLowerCase();

  // First try specific brand match (locations with all_brands OFF)
  for (const loc of locations) {
    if (!loc.all_brands && loc.oem_brands?.some(b => b.toLowerCase() === make)) return loc.id;
  }

  // Then try all_brands locations that don't exclude this make
  for (const loc of locations) {
    if (loc.all_brands) {
      const excluded = loc.excluded_oem_brands?.some(b => b.toLowerCase() === make);
      if (!excluded) return loc.id;
    }
  }

  return null;
}

/**
 * Resolve the store location based on active assignment config.
 * Priority: buying center > OEM brand match > ZIP auto-assign > null
 */
export async function resolveStoreAssignment(
  config: {
    assign_buying_center?: boolean;
    buying_center_location_id?: string | null;
    assign_oem_brand_match?: boolean;
    assign_auto_zip?: boolean;
  },
  vehicleMake: string,
  customerZip: string,
): Promise<string | null> {
  // 1. Buying center overrides everything
  if (config.assign_buying_center && config.buying_center_location_id) {
    return config.buying_center_location_id;
  }

  // 2. OEM brand match
  if (config.assign_oem_brand_match) {
    const brandMatch = await findStoreByBrand(vehicleMake);
    if (brandMatch) return brandMatch;
  }

  // 3. ZIP auto-assign
  if (config.assign_auto_zip !== false) {
    return findStoreByZip(customerZip);
  }

  return null;
}

/**
 * Clear the cached locations (call after admin updates locations).
 */
export function clearStoreCache() {
  cachedLocations = null;
}
