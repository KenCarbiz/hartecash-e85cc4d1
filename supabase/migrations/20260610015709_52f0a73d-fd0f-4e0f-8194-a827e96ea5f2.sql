-- 20260610020000_offer_expiry_use_guarantee.sql
-- Redefine set_offer_expiry() to read site_config.price_guarantee_days
-- (fallback 8) and re-align rows still on the interim +7d stamp.

CREATE OR REPLACE FUNCTION public.set_offer_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  guarantee_days INT;
BEGIN
  IF NEW.offered_price IS NOT NULL
     AND NEW.offered_price > 0
     AND NEW.offer_expires_at IS NULL THEN
    SELECT COALESCE(NULLIF(price_guarantee_days, 0), 8)
      INTO guarantee_days
      FROM public.site_config
      LIMIT 1;
    IF guarantee_days IS NULL THEN
      guarantee_days := 8;
    END IF;
    NEW.offer_expires_at := COALESCE(NEW.status_updated_at, NEW.created_at, now())
                            + (guarantee_days || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-align historical rows that were stamped on the interim +7d default.
-- Only touches rows where offer_expires_at == anchor + 7d exactly, so
-- admin-set / custom expiries are preserved.
DO $$
DECLARE
  guarantee_days INT;
BEGIN
  SELECT COALESCE(NULLIF(price_guarantee_days, 0), 8)
    INTO guarantee_days
    FROM public.site_config
    LIMIT 1;
  IF guarantee_days IS NULL THEN
    guarantee_days := 8;
  END IF;

  UPDATE public.submissions
     SET offer_expires_at = COALESCE(status_updated_at, created_at)
                            + (guarantee_days || ' days')::interval
   WHERE offered_price IS NOT NULL
     AND offered_price > 0
     AND offer_expires_at IS NOT NULL
     AND offer_expires_at = COALESCE(status_updated_at, created_at) + interval '7 days';
END $$;

NOTIFY pgrst, 'reload schema';
