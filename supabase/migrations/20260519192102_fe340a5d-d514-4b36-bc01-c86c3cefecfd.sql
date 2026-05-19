-- Allow the public Hero/Vehicle Tuner panel to broadcast its config
-- to the live site without an admin session. Only writes the single
-- jsonb column site_config.hero_tuner_config — nothing else.
CREATE OR REPLACE FUNCTION public.set_hero_tuner_config(
  p_dealership_id text,
  p_config jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.site_config
     SET hero_tuner_config = COALESCE(p_config, '{}'::jsonb)
   WHERE dealership_id = p_dealership_id;
$$;

GRANT EXECUTE ON FUNCTION public.set_hero_tuner_config(text, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';