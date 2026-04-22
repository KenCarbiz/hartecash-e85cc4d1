import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface LocationLogos {
  corporate_logo_url: string | null;
  corporate_logo_dark_url: string | null;
  secondary_logo_url: string | null;
  secondary_logo_dark_url: string | null;
  oem_logo_urls: string[];
  logo_layout: string;
  show_corporate_logo: boolean;
  show_corporate_on_landing_only: boolean;
}

const EMPTY: LocationLogos = {
  corporate_logo_url: null,
  corporate_logo_dark_url: null,
  secondary_logo_url: null,
  secondary_logo_dark_url: null,
  oem_logo_urls: [],
  logo_layout: "side_by_side",
  show_corporate_logo: false,
  show_corporate_on_landing_only: false,
};

async function fetchLocationLogos(
  dealershipId: string,
  locationId: string | null,
): Promise<LocationLogos> {
  // If a specific location is set, fetch that one directly
  if (locationId) {
    const { data } = await supabase
      .from("dealership_locations")
      .select("corporate_logo_url, corporate_logo_dark_url, secondary_logo_url, secondary_logo_dark_url, oem_logo_urls, logo_layout, show_corporate_logo, show_corporate_on_landing_only")
      .eq("id", locationId)
      .maybeSingle();
    if (data) return { ...EMPTY, ...data } as unknown as LocationLogos;
    return EMPTY;
  }

  // Otherwise fall back to the first active location for the dealership
  const { data } = await supabase
    .from("dealership_locations")
    .select("corporate_logo_url, corporate_logo_dark_url, secondary_logo_url, secondary_logo_dark_url, oem_logo_urls, logo_layout, show_corporate_logo, show_corporate_on_landing_only")
    .eq("dealership_id", dealershipId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data) {
    return { ...EMPTY, ...data } as unknown as LocationLogos;
  }
  return EMPTY;
}

export function useLocationLogos() {
  const { tenant } = useTenant();
  const did = tenant.dealership_id;
  const lid = tenant.location_id;

  const { data } = useQuery({
    queryKey: ["location_logos", did, lid],
    queryFn: () => fetchLocationLogos(did, lid),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return data ?? EMPTY;
}
