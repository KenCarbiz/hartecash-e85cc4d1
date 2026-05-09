/**
 * Shared error-reporter for edge functions.
 *
 * Why this exists: per the May 2026 reliability audit, edge functions
 * had no centralized error visibility — every function did
 * console.error() into Supabase function logs that nobody tailed.
 * This helper writes to the public.error_log table (added in
 * 20260509020000_reliability_tier1.sql) so failures surface in the
 * admin error console.
 *
 * Usage:
 *
 *   import { report } from "../_shared/report.ts";
 *
 *   try {
 *     // ...
 *   } catch (e) {
 *     await report("voice-call-grade", e, { call_id: callId });
 *     return new Response("ok", { status: 200 });  // or your retry strategy
 *   }
 *
 * Soft-fails: if the report_error RPC isn't deployed yet (migration
 * pending) or the supabase-js call itself errors, we fall back to
 * console.error and continue. Reporting must NEVER throw — it's the
 * crash-cushion, not the work itself.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    cachedClient = createClient(url, key);
    return cachedClient;
  } catch {
    return null;
  }
}

export interface ReportContext {
  call_id?: string | null;
  submission_id?: string | null;
  dealership_id?: string | null;
  /** Anything else worth attaching to the row's `context` jsonb. */
  [key: string]: unknown;
}

export type ReportSeverity = "debug" | "info" | "warning" | "error" | "fatal";

/**
 * Log an error to the centralized error_log table.
 *
 * @param source     The function name. Convention: same as the edge
 *                   function directory name (e.g. "voice-call-grade").
 * @param err        Either an Error, an unknown thrown value, or a
 *                   plain string description.
 * @param context    Optional structured context. Top-level keys
 *                   call_id / submission_id / dealership_id are
 *                   pulled out into their own columns; everything
 *                   else lands in the `context` jsonb.
 * @param severity   Defaults to "error". Pass "warning" for
 *                   recoverable issues, "fatal" for unrecoverable.
 */
export async function report(
  source: string,
  err: unknown,
  context: ReportContext = {},
  severity: ReportSeverity = "error",
): Promise<void> {
  const message = err instanceof Error
    ? err.message
    : typeof err === "string"
      ? err
      : (() => {
          try { return JSON.stringify(err); }
          catch { return String(err); }
        })();
  const stack = err instanceof Error ? err.stack ?? null : null;

  // Always also write to console — Supabase function logs remain a
  // useful secondary breadcrumb even with the DB log in place.
  if (severity === "error" || severity === "fatal") {
    console.error(`[${source}] ${message}`, err);
  } else if (severity === "warning") {
    console.warn(`[${source}] ${message}`, err);
  } else {
    console.log(`[${source}] ${message}`);
  }

  const supabase = getClient();
  if (!supabase) return;

  const { call_id, submission_id, dealership_id, ...rest } = context;

  try {
    await supabase.rpc("report_error", {
      _source: source,
      _message: message,
      _severity: severity,
      _stack: stack,
      _context: rest as Record<string, unknown>,
      _dealership_id: dealership_id ?? null,
      _call_id: call_id ?? null,
      _submission_id: submission_id ?? null,
    });
  } catch (_inner) {
    // Reporter failure must NEVER propagate. Fall through to no-op.
  }
}
