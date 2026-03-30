
CREATE OR REPLACE FUNCTION public.accept_offer(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM submissions WHERE token = _token) THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  -- Set bypass flag so the role-check trigger allows this update
  PERFORM set_config('app.accept_offer_bypass', 'true', true);

  -- Set offered_price to estimated_offer_high if not already set by staff
  UPDATE submissions
  SET progress_status = 'offer_accepted',
      status_updated_at = now(),
      offered_price = COALESCE(offered_price, estimated_offer_high)
  WHERE token = _token
    AND progress_status IN ('new', 'offer_made', 'contacted');

  -- Clear bypass flag
  PERFORM set_config('app.accept_offer_bypass', '', true);
END;
$$;
