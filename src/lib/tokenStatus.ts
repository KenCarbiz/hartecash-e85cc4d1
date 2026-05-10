import { supabase } from "@/integrations/supabase/client";

/**
 * Token lifecycle helper for unauthenticated submission flows
 * (offer page, customer portal, photo/doc upload, arrival check-in).
 *
 * The DB-side RPCs (`get_submission_portal`, `get_submission_by_token`,
 * `get_customer_arrival_page`, `accept_offer`, `mark_photos_uploaded`,
 * `mark_docs_uploaded`) all guard on
 *   (token_expires_at IS NULL OR token_expires_at > now())
 * and return 0 rows / no-op when the token has expired. That's
 * indistinguishable from "token doesn't exist" on the wire, so we
 * call `is_submission_token_valid()` to disambiguate before deciding
 * which error UI to render.
 */
export type TokenStatus = "valid" | "expired" | "missing" | "unknown";

export async function checkTokenStatus(token: string | undefined | null): Promise<TokenStatus> {
  if (!token) return "missing";
  try {
    const { data, error } = await (supabase as any).rpc("is_submission_token_valid", { _token: token });
    if (error) return "unknown";
    if (data === true) return "valid";
    // Function returns false for both "expired" and "doesn't exist".
    // Distinguish by checking whether the row itself is present —
    // any submission row (even one without an expiry) means the
    // token existed and was valid at some point.
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
