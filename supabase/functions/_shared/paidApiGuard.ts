// Shared guard for edge functions that proxy paid third-party APIs
// (Black Book, AI image gen). Lets staff JWTs and valid submission
// tokens through unmetered; rate-limits anonymous tokenless callers
// per-IP to prevent credit-burn abuse.
//
// Returns null on success, or a Response (401/429) ready to return.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller } from "./auth.ts";
import { checkRateLimit, getClientIp, sha256Hex } from "./rateLimit.ts";

export interface PaidApiGuardOptions {
  /** Submission token from the request body, if any. */
  submissionToken?: string | null;
  /** Per-IP cap for anonymous tokenless callers. */
  anonMaxPerHour: number;
  /** Scope tag for the rate-limit key (e.g. "bb-lookup"). */
  scope: string;
}

export async function paidApiGuard(
  req: Request,
  corsHeaders: Record<string, string>,
  opts: PaidApiGuardOptions,
): Promise<Response | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return null; // fail-open on misconfig

  const admin = createClient(supabaseUrl, serviceKey);
  const token = (opts.submissionToken || "").toString().trim();

  // 1. Valid submission token → unmetered.
  if (token) {
    const { data } = await admin
      .from("submissions")
      .select("id")
      .eq("token", token)
      .maybeSingle();
    if (data) return null;
  }

  // 2. Staff JWT → unmetered.
  try {
    if (anonKey) {
      const caller = await resolveCaller(req, supabaseUrl, anonKey, serviceKey);
      if (caller.kind === "platform_admin" || caller.kind === "tenant_staff") {
        return null;
      }
    }
  } catch {
    // ignore — fall through to rate limit
  }

  // 3. Anonymous tokenless → per-IP cap (1-hour rolling window).
  const ip = getClientIp(req);
  const ipHash = await sha256Hex(ip);
  const ok = await checkRateLimit(admin, {
    key: `${opts.scope}:${ipHash}`,
    windowSeconds: 3600,
    maxHits: opts.anonMaxPerHour,
  });
  if (!ok) {
    return new Response(
      JSON.stringify({ error: "rate_limit_exceeded", message: "Too many requests" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}
