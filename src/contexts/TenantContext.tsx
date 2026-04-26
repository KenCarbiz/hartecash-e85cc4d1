import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TenantInfo {
  dealership_id: string;
  slug: string;
  display_name: string;
  location_id: string | null;
}

/**
 * Super-admin "View as Tenant" override state. When set, every
 * useTenant() call returns the overridden tenant even though the
 * auth context (supabase.auth.getUser()) still resolves to the
 * super admin themselves. Persisted in sessionStorage so it
 * survives navigation inside the same tab but expires on tab close.
 *
 * This is Pattern A (tenant view, not user impersonation). The
 * super admin's user id, email, and role never change — the entire
 * mechanism is client-side context swap. Every action taken during
 * the view session is still attributed to the super admin in
 * activity_log via the "(viewing as X)" suffix on auditLabel, and
 * tenant_view_log captures the full session for compliance.
 */
interface TenantViewOverride {
  dealership_id: string;
  display_name: string;
  log_id: string;       // id of the tenant_view_log row for end-of-session close
  reason: string;
  started_at: string;   // ISO
}

interface TenantContextValue {
  tenant: TenantInfo;
  loading: boolean;
  /** True when the current session is viewing a tenant other than the
   *  one resolved from the hostname. Only platform admins can set this. */
  isViewingAsTenant: boolean;
  /** The override record if active, null otherwise. */
  viewOverride: TenantViewOverride | null;
  /** Enter view-as mode for a specific tenant. Creates the log row,
   *  stores the override in sessionStorage, returns true on success. */
  setViewAsTenant: (args: {
    dealership_id: string;
    display_name: string;
    reason: string;
  }) => Promise<boolean>;
  /** Exit view-as mode. Closes the log row and clears sessionStorage. */
  clearViewAsTenant: (endedReason?: "manual" | "navigation_away") => Promise<void>;
}

const DEFAULT_TENANT: TenantInfo = {
  dealership_id: "default",
  slug: "default",
  display_name: "AutoCurb",
  location_id: null,
};

const TenantContext = createContext<TenantContextValue>({
  tenant: DEFAULT_TENANT,
  loading: true,
  isViewingAsTenant: false,
  viewOverride: null,
  setViewAsTenant: async () => false,
  clearViewAsTenant: async () => {},
});

export const useTenant = () => useContext(TenantContext);

const OVERRIDE_STORAGE_KEY = "autocurb.tenant_view_override";

/** Read the override from sessionStorage. Returns null if invalid. */
function readOverride(): TenantViewOverride | null {
  try {
    const raw = sessionStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.dealership_id === "string" &&
      typeof parsed?.display_name === "string" &&
      typeof parsed?.log_id === "string"
    ) {
      return parsed as TenantViewOverride;
    }
  } catch {
    // sessionStorage unavailable or malformed — fall through
  }
  return null;
}

function writeOverride(override: TenantViewOverride | null) {
  try {
    if (override) {
      sessionStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(override));
    } else {
      sessionStorage.removeItem(OVERRIDE_STORAGE_KEY);
    }
  } catch {
    // Ignore — the feature degrades gracefully if sessionStorage is blocked
  }
}

/** Cache keyed by hostname to avoid re-fetching on the same domain */
let cachedTenant: { hostname: string; tenant: TenantInfo } | null = null;

/**
 * Resolves the current tenant from the hostname.
 *
 * Priority:
 * 1. Custom domain match (e.g. sellmycar.smithmotors.com)
 * 2. Slug match from subdomain (e.g. smith.yourdomain.com → slug "smith")
 * 3. Falls back to 'default' tenant
 *
 * When a tenant row has a location_id, the landing page will pull
 * that specific store's branding overrides instead of corporate defaults.
 */
async function resolveTenant(): Promise<TenantInfo> {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // Path-based subdirectory routing: /locations/:slug — outranks subdomains
  // for SEO because authority pools to the main domain. Same tenant rows
  // back both forms; subdomains keep working for direct URLs and existing
  // bookmarks.
  const pathSlugMatch = pathname.match(/^\/locations\/([a-z0-9][a-z0-9-]{1,62}[a-z0-9])(?:\/|$)/i);
  if (pathSlugMatch) {
    const pathSlug = pathSlugMatch[1].toLowerCase();
    const cacheKey = `${hostname}#${pathSlug}`;
    if (cachedTenant && cachedTenant.hostname === cacheKey) return cachedTenant.tenant;
    const { data: byPath } = await supabase.rpc("get_tenant_by_domain", { _domain: pathSlug });
    if (byPath && byPath.length > 0) {
      const t: TenantInfo = {
        dealership_id: byPath[0].dealership_id,
        slug: byPath[0].slug,
        display_name: byPath[0].display_name,
        location_id: byPath[0].location_id ?? null,
      };
      cachedTenant = { hostname: cacheKey, tenant: t };
      return t;
    }
    // Fall through to host-based resolution if the path slug is invalid
  }

  if (cachedTenant && cachedTenant.hostname === hostname) return cachedTenant.tenant;

  // Skip resolution for localhost / preview domains — use default
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("lovable.app") ||
    hostname.includes("lovable.dev")
  ) {
    cachedTenant = { hostname, tenant: DEFAULT_TENANT };
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
      location_id: domainMatch[0].location_id ?? null,
    };
    cachedTenant = { hostname, tenant: t };
    return t;
  }

  // 2. Try subdomain slug (e.g. smith.yourdomain.com → "smith")
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
        location_id: slugMatch[0].location_id ?? null,
      };
      cachedTenant = { hostname, tenant: t };
      return t;
    }
  }

  // 3. Fallback to default
  cachedTenant = { hostname, tenant: DEFAULT_TENANT };
  return DEFAULT_TENANT;
}

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [resolvedTenant, setResolvedTenant] = useState<TenantInfo>(
    cachedTenant?.tenant || DEFAULT_TENANT,
  );
  const [loading, setLoading] = useState(!cachedTenant);
  const [viewOverride, setViewOverrideState] = useState<TenantViewOverride | null>(
    () => readOverride(),
  );

  useEffect(() => {
    if (cachedTenant) return;
    resolveTenant().then((t) => {
      setResolvedTenant(t);
      setLoading(false);
    });
  }, []);

  const setViewAsTenant = useCallback<TenantContextValue["setViewAsTenant"]>(
    async ({ dealership_id, display_name, reason }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      // Verify the caller is a platform admin — the RLS policy enforces
      // this on insert but we check it client-side for a cleaner error.
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role, dealership_id")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .eq("dealership_id", "default")
        .maybeSingle();
      if (!roleRow) {
        return false;
      }

      // Write the log entry
      const { data: logRow, error: logErr } = await (supabase as any)
        .from("tenant_view_log")
        .insert({
          super_admin_user_id: session.user.id,
          super_admin_email: session.user.email || "unknown",
          target_dealership_id: dealership_id,
          target_display_name: display_name,
          reason,
          user_agent: navigator.userAgent || null,
        })
        .select("id, started_at")
        .single();

      if (logErr || !logRow) {
        console.error("Failed to write tenant_view_log:", logErr);
        return false;
      }

      const override: TenantViewOverride = {
        dealership_id,
        display_name,
        log_id: logRow.id,
        reason,
        started_at: logRow.started_at,
      };
      writeOverride(override);
      setViewOverrideState(override);
      return true;
    },
    [],
  );

  const clearViewAsTenant = useCallback<TenantContextValue["clearViewAsTenant"]>(
    async (endedReason = "manual") => {
      const current = viewOverride ?? readOverride();
      if (current?.log_id) {
        try {
          await (supabase as any)
            .from("tenant_view_log")
            .update({
              ended_at: new Date().toISOString(),
              ended_reason: endedReason,
            })
            .eq("id", current.log_id);
        } catch (e) {
          console.error("Failed to close tenant_view_log:", e);
        }
      }
      writeOverride(null);
      setViewOverrideState(null);
    },
    [viewOverride],
  );

  // Compose the effective tenant — override takes precedence over
  // hostname resolution when active.
  const effectiveTenant: TenantInfo = viewOverride
    ? {
        dealership_id: viewOverride.dealership_id,
        slug: viewOverride.dealership_id,
        display_name: viewOverride.display_name,
        location_id: null,
      }
    : resolvedTenant;

  return (
    <TenantContext.Provider
      value={{
        tenant: effectiveTenant,
        loading,
        isViewingAsTenant: viewOverride !== null,
        viewOverride,
        setViewAsTenant,
        clearViewAsTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

/**
 * Overrides the tenant context for admin workflows (scoped).
 * When an admin is configuring a different dealership, wrap the content
 * in this provider so all useTenant() calls return the target dealer.
 * This is a component-local override — not the global Super Admin
 * view-as feature above. Use this for focused per-page swaps; use
 * setViewAsTenant() from the context for a session-wide view.
 */
export const TenantOverrideProvider = ({
  dealershipId,
  displayName,
  locationId,
  children,
}: {
  dealershipId: string;
  displayName?: string;
  locationId?: string | null;
  children: ReactNode;
}) => {
  const parent = useTenant();
  const overriddenTenant: TenantInfo = {
    dealership_id: dealershipId,
    slug: dealershipId,
    display_name: displayName || dealershipId,
    location_id: locationId ?? null,
  };

  return (
    <TenantContext.Provider
      value={{
        ...parent,
        tenant: overriddenTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};
