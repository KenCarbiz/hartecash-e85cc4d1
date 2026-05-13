import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime INSERTs on `conversation_events` AND
 * INSERTs/UPDATEs on `voice_call_log` for a given submission, and
 * fires `onUpdate` whenever either table changes.
 *
 * Channel topic is tenant-prefixed (`<dealership_id>:customer-file:<id>`)
 * so the realtime.messages RLS policy can scope subscriptions to the
 * caller's own dealership.
 */
export function useCustomerFileRealtime(
  submissionId: string | null | undefined,
  onUpdate: () => void,
) {
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;
  const [dealershipId, setDealershipId] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) { setDealershipId(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("submissions")
        .select("dealership_id")
        .eq("id", submissionId)
        .maybeSingle();
      if (!cancelled) setDealershipId((data as any)?.dealership_id || null);
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

  useEffect(() => {
    if (!submissionId || !dealershipId) return;
    const channel = supabase
      .channel(`${dealershipId}:customer-file:${submissionId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore supabase realtime types are loose
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore supabase realtime types are loose
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
  }, [submissionId, dealershipId]);
}

/**
 * @deprecated alias kept while callers migrate. Forwards to
 * `useCustomerFileRealtime`. Remove once all consumers are renamed.
 */
export const useConversationRealtime = useCustomerFileRealtime;

