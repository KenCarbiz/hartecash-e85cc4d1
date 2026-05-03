// ─────────────────────────────────────────────────────────────────────────
//  Server-side entitlement guard for edge functions.
//
//  Use this at the top of any edge function that should only run for
//  dealers subscribed to a specific product. Mirrors the shape of the
//  client-side resolver in src/lib/entitlements.ts so client and server
//  agree on what "entitled" means.
//
//  Usage:
//
//      import { requireProduct } from "../_shared/entitlements.ts";
//
//      const gate = await requireProduct(req, "autolabels");
//      if (!gate.ok) {
//        return new Response(JSON.stringify({ error: gate.reason }), {
//          status: gate.status,
//          headers: { "Content-Type": "application/json", ...corsHeaders },
//        });
//      }
//      // gate.dealershipId is now safe to use as the tenant scope.
//
//  Implementation notes:
//    - Reads the caller's JWT from the Authorization header so the
//      service-role client can resolve the user's dealership_id without
//      letting them spoof it via the request body.
//    - "Entitled" = the dealer's row in dealer_subscriptions either
//      lists the product directly in product_ids OR is on a bundle
//      that contains the product OR has any tier of that product.
//    - Platform admins (is_platform_admin) always pass.
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface EntitlementGateOk {
  ok: true;
  userId: string;
  dealershipId: string;
  isPlatformAdmin: boolean;
}

export interface EntitlementGateFail {
  ok: false;
  status: number;
  reason: string;
}

export type EntitlementGate = EntitlementGateOk | EntitlementGateFail;

export async function requireProduct(
  req: Request,
  productId: string,
): Promise<EntitlementGate> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return { ok: false, status: 500, reason: "Supabase service credentials missing" };
  }

  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return { ok: false, status: 401, reason: "Missing Authorization header" };
  }
  const jwt = auth.slice("Bearer ".length);

  // Resolve user from JWT — supabase.auth.getUser(jwt) without persisting
  // a session.
  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, reason: "Invalid or expired session" };
  }
  const userId = userData.user.id;

  // dealership_id + platform-admin status come from the existing
  // SECURITY DEFINER helpers we use everywhere else.
  const [{ data: dealershipRow }, { data: adminRow }] = await Promise.all([
    sb.rpc("get_user_dealership_id", { _user_id: userId }),
    sb.rpc("is_platform_admin", { _user_id: userId }),
  ]);

  const dealershipId = (dealershipRow as string) || "default";
  const isPlatformAdmin = adminRow === true;

  if (isPlatformAdmin) {
    return { ok: true, userId, dealershipId, isPlatformAdmin: true };
  }

  // Resolve subscription → product entitlement. Same logic as the
  // client-side resolver: direct product_ids, bundle membership, or
  // tier ownership counts.
  const { data: sub } = await sb
    .from("dealer_subscriptions")
    .select("product_ids, tier_ids, bundle_id")
    .eq("dealership_id", dealershipId)
    .maybeSingle();

  if (!sub) {
    return { ok: false, status: 402, reason: `${productId} not on your plan` };
  }

  // 1. Direct product list.
  const products: string[] = (sub as any).product_ids ?? [];
  if (products.includes(productId)) {
    return { ok: true, userId, dealershipId, isPlatformAdmin: false };
  }

  // 2. Tier ownership — fetch tier rows referenced by the subscription
  //    and check whether any belong to the requested product.
  const tierIds: string[] = (sub as any).tier_ids ?? [];
  if (tierIds.length > 0) {
    const { data: tierRows } = await sb
      .from("platform_product_tiers")
      .select("product_id")
      .in("id", tierIds);
    if (tierRows?.some((t: any) => t.product_id === productId)) {
      return { ok: true, userId, dealershipId, isPlatformAdmin: false };
    }
  }

  // 3. Bundle membership.
  const bundleId: string | null = (sub as any).bundle_id ?? null;
  if (bundleId) {
    const { data: bundleRow } = await sb
      .from("platform_bundles")
      .select("product_ids")
      .eq("id", bundleId)
      .maybeSingle();
    if ((bundleRow as any)?.product_ids?.includes(productId)) {
      return { ok: true, userId, dealershipId, isPlatformAdmin: false };
    }
  }

  return { ok: false, status: 402, reason: `${productId} not on your plan` };
}
