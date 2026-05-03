// ─────────────────────────────────────────────────────────────────────────
//  Shared helpers for the billing-* edge functions.
//
//  Refactored May 2026 to work against THIS repo's schema:
//    - user_roles  (was: tenant_members)
//    - dealer_subscriptions  (was: app_entitlements)
//    - tenants  (now used directly by dealership_id)
//
//  The cross-project tenant_members / app_entitlements model from the
//  earlier multi-app architecture has been retired in favour of the
//  per-dealer dealer_subscriptions table this repo already maintains.
// ─────────────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

export function getStripe(): Stripe {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export type AuthedCaller = {
  admin: SupabaseClient;
  user: { id: string; email: string };
  tenant: {
    id: string;              // tenants.id (uuid)
    dealership_id: string;   // tenants.dealership_id (text — the FK target everywhere else)
    name: string;            // tenants.display_name
    stripe_customer_id: string | null;
    billing_email: string | null;
  };
};

/**
 * Verify the caller's JWT, resolve their dealership via user_roles,
 * load the matching tenants row, and return an admin-client handle
 * for DB/RPC calls.
 *
 * A user may have multiple user_roles rows (one per dealership).
 * We pick the highest-privileged role for billing, breaking ties by
 * recency (last-updated wins). Platform admins always resolve to the
 * platform tenant unless an explicit ?dealership_id= hint is passed.
 */
export async function authenticate(
  req: Request,
  dealershipIdHint?: string | null,
): Promise<AuthedCaller | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("unauthorized", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user || !user.email) return errorResponse("unauthorized", 401);

  const admin = getAdmin();

  const ROLE_RANK: Record<string, number> = {
    admin: 0,
    gsm_gm: 1,
    gm: 2,
    manager: 3,
    appraiser: 4,
    sales: 5,
    sales_bdc: 5,
    inspector: 6,
    receptionist: 7,
  };

  // user_roles row(s) for this user. Each row has dealership_id +
  // role. Skip rows without a dealership_id.
  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("dealership_id, role, updated_at")
    .eq("user_id", user.id);
  if (roleErr) return errorResponse(roleErr.message, 500);
  if (!roles || roles.length === 0) {
    return errorResponse("no dealership membership", 403);
  }

  // Pick. Hint wins; otherwise highest role; tiebreak on most recent.
  let picked = roles[0];
  if (dealershipIdHint) {
    const match = roles.find((r) => r.dealership_id === dealershipIdHint);
    if (!match) return errorResponse("not a member of that dealership", 403);
    picked = match;
  } else {
    picked = [...roles].sort((a, b) => {
      const r = (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9);
      if (r !== 0) return r;
      // recency tiebreaker
      const at = a.updated_at || "";
      const bt = b.updated_at || "";
      return bt.localeCompare(at);
    })[0];
  }

  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, dealership_id, display_name, stripe_customer_id, billing_email")
    .eq("dealership_id", picked.dealership_id)
    .maybeSingle();
  if (tenantErr) return errorResponse(tenantErr.message, 500);
  if (!tenant) return errorResponse("tenant not found", 404);

  return {
    admin,
    user: { id: user.id, email: user.email },
    tenant: {
      id: (tenant as any).id,
      dealership_id: (tenant as any).dealership_id,
      name: (tenant as any).display_name || (tenant as any).dealership_id,
      stripe_customer_id: (tenant as any).stripe_customer_id ?? null,
      billing_email: (tenant as any).billing_email ?? null,
    },
  };
}

/**
 * Ensure the tenant has a Stripe Customer with metadata.dealership_id
 * set so the webhook can attribute events back to the right tenant.
 *
 * Idempotent — safe to call on every billing action.
 */
export async function ensureStripeCustomer(
  caller: AuthedCaller,
  stripe: Stripe,
): Promise<string> {
  if (caller.tenant.stripe_customer_id) {
    const existing = await stripe.customers.retrieve(
      caller.tenant.stripe_customer_id,
    );
    if (!(existing as any).deleted) {
      const meta = (existing as Stripe.Customer).metadata ?? {};
      if (meta.dealership_id !== caller.tenant.dealership_id) {
        await stripe.customers.update(caller.tenant.stripe_customer_id, {
          metadata: { ...meta, dealership_id: caller.tenant.dealership_id, tenant_id: caller.tenant.id },
        });
      }
      return caller.tenant.stripe_customer_id;
    }
    // Deleted in Stripe — fall through and create a new one.
  }
  const customer = await stripe.customers.create({
    email: caller.tenant.billing_email ?? caller.user.email,
    name: caller.tenant.name,
    metadata: {
      dealership_id: caller.tenant.dealership_id,
      tenant_id: caller.tenant.id,
    },
  });
  const { error } = await caller.admin
    .from("tenants")
    .update({ stripe_customer_id: customer.id })
    .eq("id", caller.tenant.id);
  if (error) throw new Error(`persist stripe_customer_id: ${error.message}`);
  return customer.id;
}

/**
 * Look up the tenant's currently active Stripe subscription id from
 * the local cache. The webhook keeps dealer_subscriptions in sync
 * with Stripe; we read from there so this works without a Stripe
 * round-trip on every call.
 */
export async function getActiveSubscriptionId(
  caller: AuthedCaller,
): Promise<string | null> {
  const { data, error } = await caller.admin
    .from("dealer_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("dealership_id", caller.tenant.dealership_id)
    .neq("status", "canceled")
    .not("stripe_subscription_id", "is", null)
    .limit(1);
  if (error) throw new Error(`lookup subscription: ${error.message}`);
  return (data?.[0] as any)?.stripe_subscription_id ?? null;
}
