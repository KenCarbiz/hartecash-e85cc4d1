
ALTER TABLE public.site_config
  ADD COLUMN referral_reward_buy_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN referral_reward_buy_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN referral_reward_sell_buy_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN referral_reward_sell_buy_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN referral_reward_type text NOT NULL DEFAULT 'cash';
