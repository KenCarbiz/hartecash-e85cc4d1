// logCustomerDataAccess — records that a staff member viewed a customer's
// sensitive record, feeding the tenant-scoped customer_data_access_log and
// the v_bulk_access_anomalies dashboard (the detective control for a rogue
// employee or stolen credential bulk-pulling customer data).
//
// The RPC is SECURITY DEFINER and staff-gated; it resolves the dealership +
// staff label server-side. Fire-and-forget: a logging failure must never
// block the staff member from doing their job.

import { supabase } from "@/integrations/supabase/client";

export function logCustomerDataAccess(args: {
  submissionId?: string | null;
  voiceCallId?: string | null;
  /** e.g. "submission_view", "transcript_view", "recording_play". */
  resourceKind: string;
  metadata?: Record<string, unknown>;
}): void {
  if (!args.submissionId && !args.voiceCallId) return;
  void Promise.resolve(
    supabase.rpc("log_customer_data_access", {
      _submission_id: args.submissionId ?? null,
      _voice_call_id: args.voiceCallId ?? null,
      _resource_kind: args.resourceKind,
      _request_path: typeof window !== "undefined" ? window.location.pathname : null,
      _metadata: (args.metadata ?? {}) as never,
    }),
  ).catch((e) => {
    // non-fatal — never block the staff workflow on an audit-log write
    console.warn("[logCustomerDataAccess] failed (non-fatal):", e);
  });
}
