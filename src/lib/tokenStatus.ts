import { supabase } from "@/integrations/supabase/client";

/**
 * Token lifecycle helper for unauthenticated submission flows
 * (offer page, customer portal, photo/doc upload, arrival check-in,
 * deal accepted).
 *
 * The DB-side RPCs guard on
 *   (token_expires_at IS NULL OR token_expires_at > now())
 * Read RPCs (`get_submission_portal`, `get_submission_by_token`,
 * `get_customer_arrival_page`) return zero rows when the token has
 * expired, which is indistinguishable on the wire from
 * "token doesn't exist". Action RPCs (`accept_offer`,
 * `mark_docs_uploaded`, `mark_photos_uploaded`) raise
 * `Invalid token` when expired/missing.
 *
 * `checkTokenStatus()` calls `is_submission_token_valid()` to
 * disambiguate, falling back to a `submissions` lookup so we can tell
 * "expired" from "never existed" and pick the right recovery CTA.
 *
 * `isExpiredTokenError()` recognizes the "Invalid token" error raised
 * by the action RPCs so callers can fall through to the same UX.
 */
export type TokenStatus = "valid" | "expired" | "missing" | "unknown";

export async function checkTokenStatus(token: string | undefined | null): Promise<TokenStatus> {
  if (!token) return "missing";
  try {
    const { data, error } = await (supabase as any).rpc("is_submission_token_valid", { _token: token });
    if (error) return "unknown";
    if (data === true) return "valid";
    const { data: rows } = await supabase
      .from("submissions")
      .select("id")
      .eq("token", token)
      .limit(1);
    if (rows && rows.length > 0) return "expired";
    return "missing";
  } catch {
    return "unknown";
  }
}

export function isExpiredTokenError(err: unknown): boolean {
  const msg = (err as { message?: string } | null | undefined)?.message?.toLowerCase() || "";
  return msg.includes("invalid token");
}
