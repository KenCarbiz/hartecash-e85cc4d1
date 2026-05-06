CREATE TABLE IF NOT EXISTS public.boost_bump_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id TEXT NOT NULL,
  signal_key TEXT NOT NULL,
  bump_amount NUMERIC NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dealership_id, signal_key)
);

CREATE INDEX IF NOT EXISTS boost_bump_rules_dealership_idx
  ON public.boost_bump_rules (dealership_id);

ALTER TABLE public.boost_bump_rules DROP CONSTRAINT IF EXISTS boost_bump_rules_amount_range_check;
ALTER TABLE public.boost_bump_rules ADD CONSTRAINT boost_bump_rules_amount_range_check
  CHECK (bump_amount >= 0 AND bump_amount <= 2500);

ALTER TABLE public.boost_bump_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boost_bump_rules_dealer_rw" ON public.boost_bump_rules;
CREATE POLICY "boost_bump_rules_dealer_rw" ON public.boost_bump_rules
  FOR ALL
  USING (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.touch_boost_bump_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boost_bump_rules_touch_updated_at ON public.boost_bump_rules;
CREATE TRIGGER boost_bump_rules_touch_updated_at
  BEFORE UPDATE ON public.boost_bump_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_boost_bump_rules_updated_at();

NOTIFY pgrst, 'reload schema';