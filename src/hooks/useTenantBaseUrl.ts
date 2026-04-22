import { useTenant } from "@/contexts/TenantContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the correct base URL for the current tenant.
 * If the tenant has a location_id, looks up that location's domain first.
 * Falls back to the corporate custom_domain, then window.location.origin.
 */
export function useTenantBaseUrl() {
  const { tenant } = useTenant();
  const [baseUrl, setBaseUrl] = useState(window.location.origin);

  useEffect(() => {
    if (tenant.dealership_id === "default") {
      setBaseUrl(window.location.origin);
      return;
    }

    supabase
      .from("tenants")
      .select("custom_domain, slug, location_id")
      .eq("dealership_id", tenant.dealership_id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setBaseUrl(window.location.origin);
          return;
        }

        // If tenant has a location_id, prefer the domain mapped to that location
        if (tenant.location_id) {
          const locationMatch = data.find(
            (t) => t.location_id === tenant.location_id && t.custom_domain,
          );
          if (locationMatch?.custom_domain) {
            setBaseUrl(`https://${locationMatch.custom_domain}`);
            return;
          }
        }

        // Fallback to the corporate domain (no location_id)
        const corporate = data.find(
          (t) => !t.location_id && t.custom_domain,
        );
        if (corporate?.custom_domain) {
          setBaseUrl(`https://${corporate.custom_domain}`);
          return;
        }

        setBaseUrl(window.location.origin);
      });
  }, [tenant.dealership_id, tenant.location_id]);

  return baseUrl;
}
