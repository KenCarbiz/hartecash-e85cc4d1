-- Ghost-screen choice + dealer copy overrides for the BB-lookup
-- transition state in SellFlowSimple. Five variants:
--   pulse-orb       (Apple Vision Pro / OpenAI loading)
--   sweep-arc       (Stripe / Linear / Vercel)
--   stack-reveal    (Vercel deploy / Notion publish)
--   card-skeleton   (Edmunds / Carvana vehicle-card shimmer)
--   legacy-car      (the original RunningCarLoader — preserved as a
--                    dealer choice for the familiar Hartecash motion)
--
-- Idempotent. Safe to re-run.

-- Default to 'legacy-car' so existing Hartecash dealers keep the
-- running-car ghost they already had before this migration. New
-- dealers can switch to one of the four SaaS-premium variants in
-- admin if they want.
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ghost_screen text NOT NULL DEFAULT 'legacy-car';

ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_ghost_screen_check;

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_ghost_screen_check
  CHECK (ghost_screen IN (
    'pulse-orb','sweep-arc','stack-reveal','card-skeleton','legacy-car'
  ));

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ghost_headline text;

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ghost_subhead text;

COMMENT ON COLUMN public.site_config.ghost_screen IS
  'Ghost-screen variant shown while BB lookup is running. One of pulse-orb, sweep-arc, stack-reveal, card-skeleton, legacy-car.';
COMMENT ON COLUMN public.site_config.ghost_headline IS
  'Optional dealer override for the headline shown above the ghost screen. Null = component default.';
COMMENT ON COLUMN public.site_config.ghost_subhead IS
  'Optional dealer override for the sub-headline shown under the ghost screen. Null = component default.';

NOTIFY pgrst, 'reload schema';
