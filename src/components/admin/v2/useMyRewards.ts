/**
 * Employee rewards summary via the get_my_rewards RPC.
 *
 * Progressive enhancement: if the rewards-engine migration
 * (20260609220000_rewards_engine.sql) isn't applied yet, this returns
 * `data: undefined` and the My Business Rewards tab shows a clearly
 * labelled program preview. Once the RPC exists, the tab shows the
 * employee's real (initially zero) earnings + the dealership's rules.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RewardRule = {
  event_type: string;
  reward_type: string;
  amount: number;
  config: Record<string, unknown>;
};

export type MyRewards = {
  pending: number;
  approved: number;
  paid_lifetime: number;
  acquisitions: number;
  by_event: { event_type: string; amount: number; n: number }[];
  rules: RewardRule[];
  tier: string;
  next_tier: string | null;
  to_next_tier: number;
};

export function useMyRewards(dealershipId: string | undefined) {
  return useQuery<MyRewards>({
    queryKey: ["my-rewards", dealershipId],
    enabled: !!dealershipId,
    retry: false, // missing RPC (pre-migration) shouldn't retry-spam
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as never as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>)("get_my_rewards", {
        p_dealership_id: dealershipId,
      });
      if (error) throw error;
      return data as MyRewards;
    },
  });
}
