// Generic DB-backed rate limiter for edge functions.
//
// Usage:
//   const ok = await checkRateLimit(supabase, {
//     key: `unsub:${await hashIp(clientIp)}`,
//     windowSeconds: 60,
//     maxHits: 20,
//   });
//   if (!ok) return new Response("Too many requests", { status: 429 });
//
// The implementation is intentionally simple: insert a row, count rows
// for the same key within the window, reject if over threshold. Good
// enough for defense-in-depth against casual enumeration. For
// high-scale abuse (>tens of req/sec per key), put Cloudflare / a
// dedicated limiter in front.

import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface RateLimitOptions {
  /** Unique scope prefix + identifier (e.g. `unsub:<sha256(ip)>`). */
  key: string;
  /** Rolling window, in seconds. */
  windowSeconds: number;
  /** Max hits allowed within the window before rejecting. */
  maxHits: number;
}

/**
 * Returns true if the caller is within the allowed rate, false if they
 * should be throttled. A DB error fails OPEN (returns true) to avoid
 * locking real users out during transient Postgres issues; the failure
 * is logged.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  { key, windowSeconds, maxHits }: RateLimitOptions,
): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { count, error: countErr } = await supabase
      .from("rate_limit_hits")
      .select("*", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", cutoff);

    if (countErr) {
      console.warn("rate-limit count failed (fail-open):", countErr);
      return true;
    }

    if ((count ?? 0) >= maxHits) return false;

    const { error: insertErr } = await supabase
      .from("rate_limit_hits")
      .insert({ key });

    if (insertErr) {
      console.warn("rate-limit insert failed (fail-open):", insertErr);
    }

    return true;
  } catch (e) {
    console.warn("rate-limit check threw (fail-open):", e);
    return true;
  }
}

/**
 * Cheap SHA-256 hex of an input string — used to anonymise the IP
 * before storing it so the rate_limit_hits table doesn't itself become
 * a PII store.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Best-effort client IP from common proxy headers. */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
