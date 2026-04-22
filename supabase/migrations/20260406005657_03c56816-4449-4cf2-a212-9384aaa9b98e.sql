
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS referral_program_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_reward_sell_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_reward_sell_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_reward_trade_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_reward_trade_amount numeric NOT NULL DEFAULT 0;
