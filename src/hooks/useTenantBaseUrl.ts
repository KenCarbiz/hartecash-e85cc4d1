import { useTenant } from "@/contexts/TenantContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the correct base URL for the current tenant.
 * Uses custom_domain if configured, otherwise falls back to window.location.origin.
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
      .select("custom_domain, slug")
      .eq("dealership_id", tenant.dealership_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.custom_domain) {
          setBaseUrl(`https://${data.custom_domain}`);
        } else {
          // Fallback to current origin
          setBaseUrl(window.location.origin);
        }
      });
  }, [tenant.dealership_id]);

  return baseUrl;
}
