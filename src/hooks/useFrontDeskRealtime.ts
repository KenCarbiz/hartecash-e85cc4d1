import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubmissionDelta {
  id: string;
  progress_status?: string;
  self_checkin_at?: string | null;
  self_checkin_status?: string | null;
}

/**
 * Realtime subscription for FrontDesk + the customer-file Greeting
 * Card. Fires `onChange(delta, oldStatus)` when a submission row's
 * progress_status transitions to `on_the_way` or `customer_arrived`,
 * or when self_checkin_at is stamped.
 *
 * Filtered to the current dealership so a multi-tenant deployment
 * doesn't get cross-rooftop chatter. When `dealershipId` is empty
 * the subscription is a no-op (avoids subscribing as an unscoped
 * super-admin).
 */
export function useFrontDeskRealtime(
  dealershipId: string | null | undefined,
  onChange: (
    delta: SubmissionDelta,
    transition: { from: string | null; to: string | null },
  ) => void,
) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!dealershipId) return;
    const channel = supabase
      .channel(`front-desk:${dealershipId}`)
      .on(
        // @ts-ignore supabase realtime types are loose
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "submissions",
          filter: `dealership_id=eq.${dealershipId}`,
        },
        (payload: any) => {
          const next = (payload.new || {}) as SubmissionDelta;
          const prev = (payload.old || {}) as SubmissionDelta;
          // Only signal on the transitions FrontDesk cares about.
          // Submissions update for many reasons; we filter here so
          // the UI doesn't refetch on every keystroke.
          const watchedNow  = next.progress_status === "on_the_way" || next.progress_status === "customer_arrived";
          const watchedPrev = prev.progress_status === "on_the_way" || prev.progress_status === "customer_arrived";
          const selfStamped = !!next.self_checkin_at && !prev.self_checkin_at;
          if (watchedNow || watchedPrev || selfStamped) {
            cbRef.current(next, {
              from: prev.progress_status ?? null,
              to: next.progress_status ?? null,
            });
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [dealershipId]);
}
