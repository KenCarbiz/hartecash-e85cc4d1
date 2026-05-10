import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime INSERTs on `conversation_events` AND
 * INSERTs/UPDATEs on `voice_call_log` for a given submission, and
 * fires `onUpdate` whenever either table changes.
 *
 * Used by every customer-file comms surface so a customer's inbound
 * SMS / email AND a completed Bland.ai voice call appear in the rep's
 * timeline without a manual refresh.
 *
 * voice_call_log fires on UPDATE too because Bland.ai webhooks
 * progressively update the same row (status: queued → in_progress →
 * completed, then later transcript/recording_url get filled in).
 *
 * Requires both tables in the `supabase_realtime` publication. See
 * migrations:
 *   - 20260429130000_conversation_events_realtime.sql
 *   - 20260429170000_voice_call_log_realtime.sql
 */
export function useCustomerFileRealtime(
  submissionId: string | null | undefined,
  onUpdate: () => void,
) {
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    if (!submissionId) return;
    const channel = supabase
      .channel(`customer-file:${submissionId}`)
      .on(
        // @ts-expect-error supabase realtime types are loose
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_events",
          filter: `submission_id=eq.${submissionId}`,
        },
        () => { cbRef.current(); },
      )
      .on(
        // @ts-expect-error supabase realtime types are loose
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "voice_call_log",
          filter: `submission_id=eq.${submissionId}`,
        },
        () => { cbRef.current(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [submissionId]);
}

/**
 * @deprecated alias kept while callers migrate. Forwards to
 * `useCustomerFileRealtime`. Remove once all consumers are renamed.
 */
export const useConversationRealtime = useCustomerFileRealtime;
