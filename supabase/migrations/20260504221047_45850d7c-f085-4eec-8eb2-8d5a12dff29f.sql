-- Sync ghost_screen between the `default` tenant row (which the public
-- hartecash.com site resolves to) and the `harte-auto` row (which the
-- super-admin picker writes to). The admin had selected "Hartecash
-- Classic" (legacy-car) but the customer was rendering card-skeleton
-- because they read from different site_config rows.
UPDATE public.site_config
SET ghost_screen = (
  SELECT ghost_screen FROM public.site_config WHERE dealership_id = 'harte-auto'
)
WHERE dealership_id = 'default'
  AND EXISTS (SELECT 1 FROM public.site_config WHERE dealership_id = 'harte-auto');

NOTIFY pgrst, 'reload schema';