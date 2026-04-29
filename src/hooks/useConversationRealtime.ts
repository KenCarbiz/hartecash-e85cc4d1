import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime INSERTs on `conversation_events` for a given
 * submission and fires `onInsert` whenever a new row arrives. Used by
 * customer-file comms surfaces so a customer's inbound SMS / email
 * appears in the rep's timeline without a manual refresh.
 *
 * Pattern mirrors `usePricingModel` — one channel per submission,
 * cleaned up on unmount or submission change.
 *
 * Requires the `conversation_events` table to be in the
 * `supabase_realtime` publication. See migration
 * `20260429130000_conversation_events_realtime.sql`.
 */
export function useConversationRealtime(
  submissionId: string | null | undefined,
  onInsert: () => void,
) {
  const cbRef = useRef(onInsert);
  cbRef.current = onInsert;

  useEffect(() => {
    if (!submissionId) return;
    const channel = supabase
      .channel(`conversation_events:${submissionId}`)
      .on(
        // @ts-expect-error supabase realtime types are loose
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_events",
          filter: `submission_id=eq.${submissionId}`,
        },
        () => {
          cbRef.current();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [submissionId]);
}
