import { useEffect, useState } from "react";
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

let cache: Record<string, LocationLogos> = {};

/**
 * Fetches the first active location's logo config for the current tenant.
 * For multi-location setups, uses the first location by sort_order.
 */
export function useLocationLogos() {
  const { tenant } = useTenant();
  const did = tenant.dealership_id;
  const [logos, setLogos] = useState<LocationLogos>(cache[did] || EMPTY);

  useEffect(() => {
    if (cache[did]) {
      setLogos(cache[did]);
      return;
    }

    supabase
      .from("dealership_locations")
      .select("corporate_logo_url, corporate_logo_dark_url, secondary_logo_url, secondary_logo_dark_url, oem_logo_urls, logo_layout, show_corporate_logo, show_corporate_on_landing_only")
      .eq("dealership_id", did)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const result = { ...EMPTY, ...data } as unknown as LocationLogos;
          cache[did] = result;
          setLogos(result);
        }
      });
  }, [did]);

  return logos;
}
