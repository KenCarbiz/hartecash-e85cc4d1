
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS display_name text;

UPDATE public.dealer_accounts da
SET display_name = COALESCE(da.display_name, t.display_name, da.dealership_id)
FROM public.tenants t
WHERE t.dealership_id = da.dealership_id
  AND da.display_name IS NULL;

UPDATE public.dealer_accounts SET display_name = dealership_id WHERE display_name IS NULL;

NOTIFY pgrst, 'reload schema';
