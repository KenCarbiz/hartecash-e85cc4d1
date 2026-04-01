import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TenantInfo {
  dealership_id: string;
  slug: string;
  display_name: string;
}

interface TenantContextValue {
  tenant: TenantInfo;
  loading: boolean;
}

const DEFAULT_TENANT: TenantInfo = {
  dealership_id: "default",
  slug: "harte",
  display_name: "Harte Auto Group",
};

const TenantContext = createContext<TenantContextValue>({
  tenant: DEFAULT_TENANT,
  loading: true,
});

export const useTenant = () => useContext(TenantContext);

let cachedTenant: TenantInfo | null = null;

/**
 * Resolves the current tenant from the hostname.
 * 
 * Priority:
 * 1. Custom domain match (e.g. sellmycar.smithmotors.com)
 * 2. Slug match from subdomain (e.g. smith.hartecash.com → slug "smith")
 * 3. Falls back to 'default' tenant
 */
async function resolveTenant(): Promise<TenantInfo> {
  if (cachedTenant) return cachedTenant;

  const hostname = window.location.hostname;

  // Skip resolution for localhost / preview domains — use default
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("lovable.app") ||
    hostname.includes("lovable.dev")
  ) {
    cachedTenant = DEFAULT_TENANT;
    return DEFAULT_TENANT;
  }

  // 1. Try custom domain lookup
  const { data: domainMatch } = await supabase.rpc("get_tenant_by_domain", {
    _domain: hostname,
  });

  if (domainMatch && domainMatch.length > 0) {
    const t: TenantInfo = {
      dealership_id: domainMatch[0].dealership_id,
      slug: domainMatch[0].slug,
      display_name: domainMatch[0].display_name,
    };
    cachedTenant = t;
    return t;
  }

  // 2. Try subdomain slug (e.g. smith.hartecash.com → "smith")
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0];
    const { data: slugMatch } = await supabase.rpc("get_tenant_by_domain", {
      _domain: subdomain,
    });
    if (slugMatch && slugMatch.length > 0) {
      const t: TenantInfo = {
        dealership_id: slugMatch[0].dealership_id,
        slug: slugMatch[0].slug,
        display_name: slugMatch[0].display_name,
      };
      cachedTenant = t;
      return t;
    }
  }

  // 3. Fallback to default
  cachedTenant = DEFAULT_TENANT;
  return DEFAULT_TENANT;
}

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant, setTenant] = useState<TenantInfo>(cachedTenant || DEFAULT_TENANT);
  const [loading, setLoading] = useState(!cachedTenant);

  useEffect(() => {
    if (cachedTenant) return;
    resolveTenant().then((t) => {
      setTenant(t);
      setLoading(false);
    });
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
};
