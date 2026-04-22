// Shared helpers for the billing-* edge functions.
//
// Every billing endpoint is called from a signed-in dealer's browser. We
// need to (a) verify the caller's JWT, (b) resolve their tenant_id, and
// (c) return a consistent CORS response shape. These helpers keep those
// steps identical across endpoints.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(
  body: unknown,
  status = 200,
): Response {
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
    id: string;
    name: string;
    stripe_customer_id: string | null;
    billing_email: string | null;
    primary_email: string | null;
  };
};

/**
 * Verify the caller's JWT, find their tenant via tenant_members, and
 * return an admin-client handle for DB/RPC calls.
 *
 * Callers can optionally pass ?tenant_id= to disambiguate when a user
 * belongs to multiple dealerships; if omitted we pick the first
 * membership (owner/admin before manager/staff).
 */
export async function authenticate(
  req: Request,
  tenantIdHint?: string | null,
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

  // Membership lookup. Owners/admins come first so a single-dealer user
  // always resolves deterministically. If tenantIdHint is passed, we
  // require that the caller has membership in that tenant.
  const ROLE_RANK: Record<string, number> = {
    owner: 0,
    admin: 1,
    manager: 2,
    staff: 3,
  };

  const { data: memberships, error: memErr } = await admin
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id);
  if (memErr) return errorResponse(memErr.message, 500);
  if (!memberships || memberships.length === 0) {
    return errorResponse("no tenant membership", 403);
  }

  let picked = memberships[0];
  if (tenantIdHint) {
    const match = memberships.find((m) => m.tenant_id === tenantIdHint);
    if (!match) return errorResponse("not a member of that tenant", 403);
    picked = match;
  } else {
    picked = [...memberships].sort(
      (a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9),
    )[0];
  }

  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, name, stripe_customer_id, billing_email, primary_email")
    .eq("id", picked.tenant_id)
    .single();
  if (tenantErr || !tenant) {
    return errorResponse("tenant not found", 404);
  }

  return {
    admin,
    user: { id: user.id, email: user.email },
    tenant: tenant as AuthedCaller["tenant"],
  };
}

/**
 * Ensure the tenant has a Stripe Customer record with metadata.tenant_id
 * set (the cross-app contract: the webhook reads this to attribute
 * events to the right tenants.id UUID).
 *
 * Three cases:
 *   - No Customer yet: create one with metadata.tenant_id and persist
 *     the id on tenants.stripe_customer_id.
 *   - Customer exists but was created outside this flow (manual Dashboard
 *     entry, legacy): patch metadata.tenant_id onto it so future webhooks
 *     resolve correctly.
 *   - Customer exists with metadata: no-op.
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
    if (!existing.deleted) {
      const meta = (existing as Stripe.Customer).metadata ?? {};
      if (meta.tenant_id !== caller.tenant.id) {
        await stripe.customers.update(caller.tenant.stripe_customer_id, {
          metadata: { ...meta, tenant_id: caller.tenant.id },
        });
      }
      return caller.tenant.stripe_customer_id;
    }
    // Deleted — fall through to recreate.
  }
  const customer = await stripe.customers.create({
    email:
      caller.tenant.billing_email ??
      caller.tenant.primary_email ??
      caller.user.email,
    name: caller.tenant.name,
    metadata: { tenant_id: caller.tenant.id },
  });
  const { error } = await caller.admin
    .from("tenants")
    .update({ stripe_customer_id: customer.id })
    .eq("id", caller.tenant.id);
  if (error) throw new Error(`persist stripe_customer_id: ${error.message}`);
  return customer.id;
}

/**
 * Resolve the tenant's currently active Stripe subscription id by
 * reading app_entitlements. One-subscription-per-tenant is the rule,
 * so any row with a stripe_subscription_id and a non-canceled status
 * is authoritative.
 */
export async function getActiveSubscriptionId(
  caller: AuthedCaller,
): Promise<string | null> {
  const { data, error } = await caller.admin
    .from("app_entitlements")
    .select("stripe_subscription_id, status")
    .eq("tenant_id", caller.tenant.id)
    .neq("status", "canceled")
    .not("stripe_subscription_id", "is", null)
    .limit(1);
  if (error) throw new Error(`lookup subscription: ${error.message}`);
  return data?.[0]?.stripe_subscription_id ?? null;
}
