// Audit-trail helper for high-risk staff actions that don't have a
// natural submission_id (which is what activity_log keys on).
//
// Use this for things like:
//   * staff role grants / revokes
//   * rooftop merges / detaches
//   * voice-quality manipulations (mark golden, retire variant)
//   * platform-admin config flips
//
// Standard action verbs (snake_case, past tense):
//   staff_role_updated, staff_role_removed,
//   rooftop_merged, rooftop_detached,
//   voice_call_pinned_golden, voice_variant_retired,
//   tenant_demo_mode_toggled, ...
//
// Failure mode: best-effort. If the insert fails (e.g. migration not
// applied yet on a sandbox env) we console.warn and return — auditing
// failure should NEVER block the action it audits.

import { supabase } from "@/integrations/supabase/client";

interface LogStaffActionArgs {
  /** snake_case past-tense verb, e.g. "staff_role_updated" */
  action: string;
  /** Optional dealership scope. Null for true platform-admin actions. */
  dealershipId?: string | null;
  /** Type of the row being acted on, e.g. "user_role" or "rooftop". */
  targetType?: string | null;
  /** Stringified id of the target row (uuid, slug, etc). */
  targetId?: string | null;
  /** Snapshot of the row BEFORE the change. JSON-serializable. */
  before?: unknown;
  /** Snapshot AFTER the change. JSON-serializable. */
  after?: unknown;
  /** Free-form analyst note for context. */
  notes?: string | null;
}

export async function logStaffAction(args: LogStaffActionArgs): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const userEmail = user?.email ?? null;

    // user_agent is best-effort; the IP is filled by the DB-side
    // logger if we ever route through an RPC. From the browser we
    // can't read the public IP, so leave it null.
    const userAgent =
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;

    const { error } = await supabase.from("staff_action_log" as never).insert({
      dealership_id: args.dealershipId ?? null,
      user_id: userId,
      user_email: userEmail,
      action: args.action,
      target_type: args.targetType ?? null,
      target_id: args.targetId ?? null,
      before: args.before === undefined ? null : (args.before as never),
      after: args.after === undefined ? null : (args.after as never),
      notes: args.notes ?? null,
      user_agent: userAgent,
    } as never);
    if (error) {
      console.warn(`[staffAuditLog] ${args.action} insert failed:`, error.message);
    }
  } catch (e) {
    console.warn(`[staffAuditLog] ${args.action} threw:`, e);
  }
}
