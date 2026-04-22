CREATE OR REPLACE FUNCTION public.accept_offer(_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM submissions WHERE token = _token) THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  
  -- Set offered_price to estimated_offer_high if not already set by staff
  UPDATE submissions 
  SET progress_status = 'contacted',
      status_updated_at = now(),
      offered_price = COALESCE(offered_price, estimated_offer_high)
  WHERE token = _token 
    AND progress_status IN ('new', 'offer_made');
END;
$$;