import { supabase } from "@/integrations/supabase/client";

interface LocationWithZips {
  id: string;
  name: string;
  city: string;
  state: string;
  zip_codes: string[];
}

let cachedLocations: LocationWithZips[] | null = null;

/**
 * Find the best matching dealership location for a given customer ZIP code.
 * Returns the location ID or null if no match found.
 */
export async function findStoreByZip(customerZip: string): Promise<string | null> {
  if (!customerZip || customerZip.length < 5) return null;

  const zip5 = customerZip.slice(0, 5);

  // Cache locations to avoid repeated DB calls
  if (!cachedLocations) {
    const { data } = await supabase
      .from("dealership_locations")
      .select("id, name, city, state, zip_codes")
      .eq("is_active", true)
      .order("sort_order");
    cachedLocations = (data as any) || [];
  }

  // Exact match in zip_codes array
  for (const loc of cachedLocations!) {
    if (loc.zip_codes && loc.zip_codes.includes(zip5)) {
      return loc.id;
    }
  }

  // Prefix match (first 3 digits) as fallback
  const prefix = zip5.slice(0, 3);
  for (const loc of cachedLocations!) {
    if (loc.zip_codes?.some(z => z.startsWith(prefix))) {
      return loc.id;
    }
  }

  // Default to first location if nothing matches
  return cachedLocations!.length > 0 ? cachedLocations![0].id : null;
}

/**
 * Clear the cached locations (call after admin updates locations).
 */
export function clearStoreCache() {
  cachedLocations = null;
}
