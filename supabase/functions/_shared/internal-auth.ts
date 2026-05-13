// Shared auth helpers for locking down cron / orchestration edge functions.
//
// Two trust modes:
//   1. "Internal caller": the request carries our SUPABASE_SERVICE_ROLE_KEY in
//      the Authorization header. Used by pg_cron jobs (Vault-stored key) and by
//      edge-function-to-edge-function invocations that already use a
//      service-role supabase client.
//   2. "Platform admin": the request carries a valid user JWT and that user has
//      `is_platform_admin = true` in user_roles. Used for manual admin
//      backfills / "fire now" buttons in the dashboard.
//
// All other callers (anon, tenant staff, customers) are rejected.
//
// Constant-time comparison is used for the service-role check so token length
// doesn't leak via response time.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function bearerToken(req: Request): string | null {
  const h = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/**
 * True if the request was authenticated with the project's service-role key
 * (i.e. came from another edge function or a trusted cron job).
 */
export function isInternalCaller(req: Request): boolean {
  if (!SERVICE_ROLE_KEY) return false;
  const token = bearerToken(req);
  if (!token) return false;
  return timingSafeEqual(token, SERVICE_ROLE_KEY);
}

/**
 * True if the request carries a valid user JWT belonging to a platform admin.
 * (Tenant admins are NOT platform admins — they cannot fire cron orchestrators
 *  or override target submissions for other tenants.)
 */
export async function isPlatformAdminCaller(req: Request): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) return false;
  const token = bearerToken(req);
  if (!token) return false;
  // Don't accidentally treat the service-role key as a user JWT.
  if (timingSafeEqual(token, SERVICE_ROLE_KEY)) return false;

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error } = await userClient.auth.getUser(token);
    if (error || !userData?.user) return false;
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: row } = await svc
      .from("user_roles")
      .select("is_platform_admin")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();
    return !!(row as { is_platform_admin?: boolean } | null)?.is_platform_admin;
  } catch {
    return false;
  }
}

/**
 * Convenience: allow either trust mode. Returns null on success, or a Response
 * with a 401 ready to return if the caller is not authorized.
 */
export async function requireInternalOrPlatformAdmin(
  req: Request,
  cors: Record<string, string>,
): Promise<Response | null> {
  if (isInternalCaller(req)) return null;
  if (await isPlatformAdminCaller(req)) return null;
  return new Response(
    JSON.stringify({ error: "unauthorized" }),
    { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
  );
}
