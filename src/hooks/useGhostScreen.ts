import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import type { GhostScreenKind } from "@/components/landing/GhostScreen";

/**
 * useGhostScreen — resolves the dealer's saved Branding → Landing →
 * Ghost Screen variant for any loader surface. Always force-fetches
 * the live `site_config.ghost_screen` value on mount so a stale
 * React Query cache never serves the wrong loader.
 *
 * Returns:
 *   kind     → the variant to render right now (cached if present,
 *              otherwise the freshly fetched value, otherwise the
 *              "legacy-car" default).
 *   live     → the value as it exists in the DB at this moment, once
 *              the force-fetch completes. Null while still in flight.
 *   syncing  → true while the force-fetch is in flight.
 *   stale    → true when the cached `kind` does not match `live`
 *              (i.e. the React Query cache is out of date and the
 *              loader is currently rendering the OLD variant). The
 *              caller can surface a sync indicator to the dealer.
 */
export function useGhostScreen(): {
  kind: GhostScreenKind;
  live: GhostScreenKind | null;
  syncing: boolean;
  ready: boolean;
  stale: boolean;
} {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const [live, setLive] = useState<GhostScreenKind | null>(null);
  const [syncing, setSyncing] = useState(true);

  const cached =
    (((config as any)?.ghost_screen as GhostScreenKind) || "legacy-car") as
      GhostScreenKind;

  useEffect(() => {
    let cancelled = false;
    setSyncing(true);
    (async () => {
      const corporatePromise = supabase
        .from("site_config" as any)
        .select("ghost_screen")
        .eq("dealership_id", tenant.dealership_id)
        .maybeSingle();

      const locationPromise = tenant.location_id
        ? supabase
            .from("dealership_locations" as any)
            .select("ghost_screen")
            .eq("id", tenant.location_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [{ data, error }, { data: locationData, error: locationError }] =
        await Promise.all([corporatePromise, locationPromise]);
      if (cancelled) return;
      if (!error && !locationError) {
        const locationGhost = (locationData as any)?.ghost_screen as
          | GhostScreenKind
          | null
          | undefined;
        const next =
          locationGhost ||
          ((data as any)?.ghost_screen as GhostScreenKind) ||
          "legacy-car";
        setLive(next);
      }
      setSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant.dealership_id, tenant.location_id]);

  // Prefer the freshly fetched value once it arrives so the loader
  // self-corrects mid-render rather than waiting for the React Query
  // cache to revalidate on its own (5-min staleTime).
  const kind = live ?? cached;
  const stale = live !== null && live !== cached;
  const ready = live !== null || !syncing;

  return { kind, live, syncing, ready, stale };
}
