import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared-schema entitlement row. Mirrors app_entitlements in the
 * shared Supabase project. Every app in the Autocurb Suite reads
 * from this table; Autocurb is the only writer.
 */
export type Entitlement = {
  app_slug: string;
  plan_tier: string | null;
  status: "trial" | "active" | "canceled" | "past_due" | "paused";
  activated_at: string | null;
  trial_ends_at: string | null;
  expires_at: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_item_id: string | null;
  seat_limit: number | null;
};

export type Tenant = {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  primary_email: string | null;
  billing_email: string | null;
};

type State = {
  loading: boolean;
  error: string | null;
  tenant: Tenant | null;
  entitlements: Entitlement[];
};

const initial: State = {
  loading: true,
  error: null,
  tenant: null,
  entitlements: [],
};

/**
 * Resolve the signed-in user's tenant and current entitlement rows.
 *
 * If the user belongs to multiple tenants (rare — multi-rooftop groups),
 * the highest-rank membership wins (owner > admin > manager > staff).
 * Pass tenantIdHint to pin a specific tenant.
 */
export function useEntitlements(tenantIdHint?: string | null) {
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setState({ loading: false, error: "not signed in", tenant: null, entitlements: [] });
        }
        return;
      }

      const sb = supabase as any;
      const { data: memberships, error: mErr } = await sb
        .from("tenant_members")
        .select("tenant_id, role")
        .eq("user_id", user.id);
      if (mErr) {
        if (!cancelled) setState({ ...initial, loading: false, error: mErr.message });
        return;
      }
      if (!memberships || memberships.length === 0) {
        if (!cancelled) setState({ ...initial, loading: false, error: "no tenant membership" });
        return;
      }

      const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, manager: 2, staff: 3 };
      const picked =
        (tenantIdHint && memberships.find((m: { tenant_id: string }) => m.tenant_id === tenantIdHint)) ||
        [...memberships].sort(
          (a: { role: string }, b: { role: string }) =>
            (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9),
        )[0];

      const { data: tenant, error: tErr } = await sb
        .from("tenants")
        .select("id, name, stripe_customer_id, primary_email, billing_email")
        .eq("id", picked.tenant_id)
        .single();
      if (tErr || !tenant) {
        if (!cancelled) {
          setState({ ...initial, loading: false, error: tErr?.message ?? "tenant not found" });
        }
        return;
      }

      const { data: ents, error: eErr } = await sb
        .from("app_entitlements")
        .select(
          "app_slug, plan_tier, status, activated_at, trial_ends_at, expires_at, stripe_subscription_id, stripe_subscription_item_id, seat_limit",
        )
        .eq("tenant_id", tenant.id);
      if (eErr) {
        if (!cancelled) {
          setState({ tenant: tenant as Tenant, loading: false, error: eErr.message, entitlements: [] });
        }
        return;
      }

      if (!cancelled) {
        setState({
          loading: false,
          error: null,
          tenant: tenant as Tenant,
          entitlements: (ents ?? []) as Entitlement[],
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantIdHint]);

  return state;
}
