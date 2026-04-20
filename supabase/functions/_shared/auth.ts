// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type CallerIdentity =
  | { kind: "anonymous" }
  | { kind: "no_role"; userId: string }
  | { kind: "platform_admin"; userId: string }
  | { kind: "tenant_staff"; userId: string; dealershipId: string };

/**
 * Resolve the caller's identity from the request Authorization header.
 *
 * - anonymous       → no auth header or invalid token
 * - no_role         → authenticated but has no user_roles row
 * - platform_admin  → user has admin role at dealership_id "default"
 * - tenant_staff    → user has a role at a specific dealership_id
 *
 * Edge functions decide which kinds are allowed for their use case:
 *   - Staff-only operations (admin tools): require platform_admin OR
 *     tenant_staff with matching dealership_id; reject anonymous.
 *   - Customer-facing operations (form, photo upload): allow anonymous BUT
 *     require an additional proof-of-ownership (submission token) before
 *     touching submission data.
 */
export async function resolveCaller(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<CallerIdentity> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { kind: "anonymous" };

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { kind: "anonymous" };

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await admin
    .from("user_roles")
    .select("dealership_id, role")
    .eq("user_id", user.id);

  if (!roles?.length) return { kind: "no_role", userId: user.id };

  const isPlatform = roles.some(
    (r: any) => r.dealership_id === "default" && r.role === "admin",
  );
  if (isPlatform) return { kind: "platform_admin", userId: user.id };

  const concrete = roles.find(
    (r: any) => r.dealership_id && r.dealership_id !== "default",
  );
  if (concrete) {
    return { kind: "tenant_staff", userId: user.id, dealershipId: concrete.dealership_id };
  }
  return { kind: "no_role", userId: user.id };
}

/**
 * Returns true when the caller may operate on a resource belonging to
 * `resourceDealershipId`. Used by staff-only edge functions to prevent
 * cross-tenant access. Anonymous callers are REJECTED — use
 * `requireSubmissionToken()` instead for public customer flows.
 */
export function callerCanActOnTenant(
  caller: CallerIdentity,
  resourceDealershipId: string | null | undefined,
): boolean {
  if (caller.kind === "platform_admin") return true;
  if (caller.kind === "tenant_staff") {
    return !!resourceDealershipId && caller.dealershipId === resourceDealershipId;
  }
  return false;
}

export function forbidden(corsHeaders: Record<string, string>, reason = "Forbidden — resource belongs to another tenant") {
  return new Response(
    JSON.stringify({ error: reason }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
