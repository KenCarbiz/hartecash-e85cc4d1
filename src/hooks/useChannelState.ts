import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import {
  ALL_ENABLED,
  CHANNEL_KEYS,
  type ChannelKey,
  type ChannelStateMap,
} from "@/lib/channels";

interface UseChannelStateResult {
  /** Effective per-channel boolean: location override > tenant default > true. */
  state: ChannelStateMap;
  /** Tenant-level (group) row state. Used by the admin Channels page. */
  tenantState: ChannelStateMap;
  /** Per-location override map: null = inherit, true/false = override. */
  locationOverrides: Record<ChannelKey, boolean | null>;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Resolves the effective state for each communication channel for the
 * current tenant + (optionally) a specific location. Returns
 * `ALL_ENABLED` while loading so UI doesn't flash a hidden state.
 *
 * The merge mirrors the `channel_enabled()` SQL helper:
 *   COALESCE(location override, tenant default, true)
 */
export function useChannelState(locationId?: string | null): UseChannelStateResult {
  const { tenant } = useTenant();
  const [tenantState, setTenantState] = useState<ChannelStateMap>(ALL_ENABLED);
  const [locationOverrides, setLocationOverrides] = useState<
    Record<ChannelKey, boolean | null>
  >(() => Object.fromEntries(CHANNEL_KEYS.map((k) => [k, null])) as Record<ChannelKey, boolean | null>);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const dealershipId = tenant.dealership_id;
    const effectiveLocation = locationId ?? tenant.location_id ?? null;

    const tenantRowsP = supabase
      .from("tenant_channels")
      .select("channel, enabled")
      .eq("dealership_id", dealershipId);

    const locationRowsP = effectiveLocation
      ? supabase
          .from("location_channels")
          .select("channel, enabled")
          .eq("location_id", effectiveLocation)
      : Promise.resolve({ data: [] as { channel: string; enabled: boolean | null }[], error: null });

    const [{ data: tRows }, { data: lRows }] = await Promise.all([tenantRowsP, locationRowsP]);

    const nextTenant: ChannelStateMap = { ...ALL_ENABLED };
    (tRows || []).forEach((r) => {
      if (CHANNEL_KEYS.includes(r.channel as ChannelKey)) {
        nextTenant[r.channel as ChannelKey] = !!r.enabled;
      }
    });

    const nextOverrides: Record<ChannelKey, boolean | null> = Object.fromEntries(
      CHANNEL_KEYS.map((k) => [k, null]),
    ) as Record<ChannelKey, boolean | null>;
    (lRows || []).forEach((r) => {
      if (CHANNEL_KEYS.includes(r.channel as ChannelKey)) {
        nextOverrides[r.channel as ChannelKey] = r.enabled;
      }
    });

    setTenantState(nextTenant);
    setLocationOverrides(nextOverrides);
    setLoading(false);
  }, [tenant.dealership_id, tenant.location_id, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const state: ChannelStateMap = { ...ALL_ENABLED };
  for (const k of CHANNEL_KEYS) {
    const override = locationOverrides[k];
    state[k] = override ?? tenantState[k];
  }

  return { state, tenantState, locationOverrides, loading, refresh: load };
}
