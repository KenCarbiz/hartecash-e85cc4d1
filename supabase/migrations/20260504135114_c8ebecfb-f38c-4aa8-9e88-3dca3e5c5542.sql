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