// Ops-only replay of autocurb_sync_entitlements. Used to recover from
// a missed webhook, backfill a tenant whose state drifted, or stage a
// manual entitlement fix that doesn't round-trip through Stripe.
//
// Auth: Bearer must match SUPABASE_SERVICE_ROLE_KEY exactly. This is
// an ops surface — there is no dealer-facing flow that calls it, and
// we deliberately avoid mapping it to a platform-admin JWT so that
// the blast radius is obvious (anyone with the service role key can
// already mutate every row; this endpoint changes nothing about that
// threat model).
//
// Body shape mirrors the shared RPC:
//   { tenant_id: UUID, items: [{ app_slug, plan_tier, status,
//     stripe_subscription_id, stripe_subscription_item_id,
//     expires_at, includes_apps[] }] }
//
// Items are passed through to autocurb_sync_entitlements unchanged —
// the caller is authoritative. The RPC handles upserts, cancellations
// of removed apps, and the audit-log hash chain; we add a separate
// 'billing_replay' audit row so the intervention itself is recorded.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Constant-time Bearer comparison. Avoids leaking timing info about
 * the service-role key to a brute-force attacker.
 */
function bearerMatches(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const presented = header.slice(prefix.length);
  if (presented.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < presented.length; i++) {
    mismatch |= presented.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return mismatch === 0;
}

type ReplayItem = {
  app_slug: string;
  plan_tier: string;
  status: string;
  stripe_subscription_id?: string;
  stripe_subscription_item_id?: string;
  expires_at?: string;
  includes_apps?: string[];
};

type Body = {
  tenant_id: string;
  items: ReplayItem[];
  reason?: string;
};

function validateBody(b: unknown): string | null {
  if (!b || typeof b !== "object") return "body must be a JSON object";
  const body = b as Partial<Body>;
  if (typeof body.tenant_id !== "string" || !UUID_RE.test(body.tenant_id)) {
    return "tenant_id must be a UUID";
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "items must be a non-empty array";
  }
  for (let i = 0; i < body.items.length; i++) {
    const it = body.items[i] as Partial<ReplayItem>;
    if (!it || typeof it !== "object") {
      return `items[${i}] must be an object`;
    }
    if (typeof it.app_slug !== "string" || !it.app_slug) {
      return `items[${i}].app_slug required`;
    }
    if (typeof it.plan_tier !== "string" || !it.plan_tier) {
      return `items[${i}].plan_tier required`;
    }
    if (typeof it.status !== "string" || !it.status) {
      return `items[${i}].status required`;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!bearerMatches(req.headers.get("Authorization"), serviceKey)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const invalid = validateBody(body);
  if (invalid) return json({ error: invalid }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  const { error } = await admin.rpc("autocurb_sync_entitlements", {
    p_tenant_id: body.tenant_id,
    p_items: body.items,
  });
  if (error) {
    return json({ error: `autocurb_sync_entitlements: ${error.message}` }, 500);
  }

  await admin.from("audit_log").insert({
    action: "billing_replay",
    entity_type: "tenant",
    entity_id: body.tenant_id,
    store_id: body.tenant_id,
    details: {
      reason: body.reason ?? null,
      item_count: body.items.length,
      app_slugs: body.items.map((i) => i.app_slug),
    },
  });

  return json({
    ok: true,
    tenant_id: body.tenant_id,
    items_synced: body.items.length,
  });
});
