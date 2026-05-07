-- Boost safety hardening (idempotent)

-- 1. Tighten offer_bumps RLS
DROP POLICY IF EXISTS "offer_bumps_dealer_rw"     ON public.offer_bumps;
DROP POLICY IF EXISTS "offer_bumps_service_write" ON public.offer_bumps;
DROP POLICY IF EXISTS "offer_bumps_dealer_read"   ON public.offer_bumps;

CREATE POLICY "offer_bumps_dealer_read" ON public.offer_bumps
  FOR SELECT
  USING (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

-- 2. Atomic apply function
CREATE OR REPLACE FUNCTION public.apply_boost_bump(
  _token TEXT,
  _previous_offer NUMERIC,
  _new_offer NUMERIC,
  _bump_amount NUMERIC,
  _line_items JSONB,
  _source TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _submission_id UUID;
  _dealership_id TEXT;
  _bump_id UUID;
BEGIN
  SELECT id, dealership_id INTO _submission_id, _dealership_id
    FROM public.submissions
   WHERE token = _token
   FOR UPDATE;

  IF _submission_id IS NULL THEN
    RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.submissions
     SET offered_price = _new_offer,
         offer_made_at = COALESCE(offer_made_at, NOW()),
         updated_at    = NOW()
   WHERE id = _submission_id;

  INSERT INTO public.offer_bumps (
    submission_id, dealership_id, previous_offer, new_offer,
    bump_amount, line_items, source
  ) VALUES (
    _submission_id, _dealership_id, _previous_offer, _new_offer,
    _bump_amount, COALESCE(_line_items, '[]'::jsonb),
    COALESCE(_source, 'boost_evaluate')
  )
  RETURNING id INTO _bump_id;

  RETURN _bump_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_boost_bump(TEXT, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_boost_bump(TEXT, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT) TO service_role;

-- 3. Recent-bump lookup
CREATE OR REPLACE FUNCTION public.recent_boost_bump(
  _token TEXT,
  _within_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  previous_offer NUMERIC,
  new_offer NUMERIC,
  bump_amount NUMERIC,
  line_items JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.previous_offer, b.new_offer, b.bump_amount, b.line_items, b.created_at
    FROM public.offer_bumps b
    JOIN public.submissions s ON s.id = b.submission_id
   WHERE s.token = _token
     AND b.created_at >= NOW() - (_within_seconds || ' seconds')::INTERVAL
   ORDER BY b.created_at DESC
   LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.recent_boost_bump(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recent_boost_bump(TEXT, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';