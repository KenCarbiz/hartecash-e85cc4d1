-- Force PostgREST to reload its schema cache.
-- Run after any column-adding migration lands so the admin doesn't hit
-- "Could not find the '<column>' column of '<table>' in the schema cache"
-- errors when saving. Safe to re-run.
NOTIFY pgrst, 'reload schema';

-- Belt-and-suspenders: also touch site_config and offer_settings tables
-- so the next SELECT refreshes any connection-level cache.
COMMENT ON TABLE public.site_config IS COALESCE(
  (SELECT obj_description('public.site_config'::regclass)),
  'Per-dealership site branding + landing template.'
);
COMMENT ON TABLE public.offer_settings IS COALESCE(
  (SELECT obj_description('public.offer_settings'::regclass)),
  'Per-dealership offer engine + pricing reveal + payment timing settings.'
);
