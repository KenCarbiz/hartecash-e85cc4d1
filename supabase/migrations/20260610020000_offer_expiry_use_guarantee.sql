-- Align first-offer expiry with the dealer's price guarantee.
--
-- 20260610010000 stamped a hardcoded 7-day expiry, but the customer-
-- facing widget (ResumeCard) counts down from site_config
-- .price_guarantee_days (default 8). That 1-day mismatch would make the
-- admin Re-engagement view + get_my_saved_offer disagree with what the
-- customer sees. This makes the stamp config-driven (fallback 8) and
-- re-aligns the rows that still carry the interim 7-day backfill stamp.
--
-- Safe: the trigger still only writes offer_expires_at when null+priced
-- (admin-set expiries preserved); the re-backfill ONLY touches rows whose
-- expiry exactly equals the old 7-day stamp, so any customised/trigger-
-- set expiry is left alone. Idempotent; manual-apply.

CREATE OR REPLACE FUNCTION public.set_offer_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _days int;
BEGIN
  IF NEW.offered_price IS NOT NULL
     AND NEW.offered_price > 0
     AND NEW.offer_expires_at IS NULL THEN
    SELECT price_guarantee_days INTO _days
      FROM site_config WHERE dealership_id = NEW.dealership_id LIMIT 1;
    NEW.offer_expires_at := now() + (COALESCE(_days, 8) || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$function$;

-- Re-align rows still carrying the interim 7-day backfill stamp to the
-- dealer's guarantee window. Leaves admin-customised / already-correct
-- expiries untouched (only matches the exact +7d stamp). Idempotent.
UPDATE public.submissions s
SET offer_expires_at = COALESCE(s.status_updated_at, s.created_at)
    + (COALESCE(
         (SELECT price_guarantee_days FROM site_config c WHERE c.dealership_id = s.dealership_id LIMIT 1),
         8) || ' days')::interval
WHERE s.offered_price IS NOT NULL
  AND s.offered_price > 0
  AND s.offer_expires_at = COALESCE(s.status_updated_at, s.created_at) + interval '7 days'
  AND COALESCE((SELECT price_guarantee_days FROM site_config c WHERE c.dealership_id = s.dealership_id LIMIT 1), 8) <> 7;

NOTIFY pgrst, 'reload schema';
