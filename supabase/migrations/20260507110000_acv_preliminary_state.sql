-- ACV preliminary vs. final state.
--
-- Per the May-2026 product call: an ACV (actual cash value) set
-- before the vehicle has been physically inspected is PRELIMINARY,
-- not final. Once the inspection lands (`inspection_completed_at IS
-- NOT NULL`), the ACV can be promoted to FINAL. The UI renders a
-- preliminary ACV in amber and a final ACV in green so anyone
-- reading the file can tell at a glance which state it's in.
--
-- Permission expansion: the existing enforce_submission_update_roles
-- trigger only accepts 'admin', 'used_car_manager', and 'gsm_gm'
-- writes. The 'gm' role (added in 20260420130000_add_sales_and_gm_roles)
-- is now also allowed because GMs commonly set preliminary ACVs from
-- the desking surface.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS acv_status text NOT NULL DEFAULT 'preliminary',
  ADD COLUMN IF NOT EXISTS acv_set_at timestamptz;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_acv_status_chk;
ALTER TABLE public.submissions
  ADD  CONSTRAINT submissions_acv_status_chk
  CHECK (acv_status IN ('preliminary','final'));

-- Backfill existing rows: anything with an ACV AND a completed
-- inspection is final; everything else is preliminary.
UPDATE public.submissions
SET acv_status = CASE
  WHEN acv_value IS NOT NULL AND inspection_completed_at IS NOT NULL THEN 'final'
  ELSE 'preliminary'
END
WHERE acv_status IS DISTINCT FROM CASE
  WHEN acv_value IS NOT NULL AND inspection_completed_at IS NOT NULL THEN 'final'
  ELSE 'preliminary'
END;

-- Trigger that promotes acv_status to 'final' the moment inspection
-- completion is stamped (assumes the appraiser has either confirmed
-- or revised the ACV before stamping the inspection — that's the
-- workflow the slide-out enforces).
CREATE OR REPLACE FUNCTION public.promote_acv_on_inspection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-promote when the inspection lands.
  IF NEW.inspection_completed_at IS NOT NULL
     AND (OLD.inspection_completed_at IS NULL OR OLD.inspection_completed_at IS DISTINCT FROM NEW.inspection_completed_at)
     AND NEW.acv_value IS NOT NULL
     AND NEW.acv_status = 'preliminary' THEN
    NEW.acv_status := 'final';
  END IF;

  -- Stamp acv_set_at whenever the value moves so we know how stale
  -- a preliminary number is.
  IF NEW.acv_value IS DISTINCT FROM OLD.acv_value
     AND NEW.acv_value IS NOT NULL THEN
    NEW.acv_set_at := now();
    -- New value, no inspection yet → reset to preliminary regardless
    -- of who's writing it.
    IF NEW.inspection_completed_at IS NULL THEN
      NEW.acv_status := 'preliminary';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS submissions_promote_acv ON public.submissions;
CREATE TRIGGER submissions_promote_acv
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_acv_on_inspection();

-- Expand the role check on enforce_submission_update_roles to
-- include 'gm'. Recreate the function in full because plpgsql
-- doesn't support partial updates; preserve the existing label-
-- composing logic from 20260324230441 verbatim.
CREATE OR REPLACE FUNCTION public.enforce_submission_update_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _display_name    text;
  _email           text;
  _first_name      text;
  _last_initial    text;
  _title           text;
  _appraiser_label text;
BEGIN
  IF current_setting('app.accept_offer_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.offered_price IS DISTINCT FROM OLD.offered_price THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'used_car_manager'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role) OR
      has_role(auth.uid(), 'gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only managers can update the offered price';
    END IF;
  END IF;

  IF NEW.acv_value IS DISTINCT FROM OLD.acv_value THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'used_car_manager'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role) OR
      has_role(auth.uid(), 'gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only sales / used-car / general managers can enter the appraisal value';
    END IF;

    NEW.appraised_by_user_id := auth.uid();

    SELECT p.display_name, p.email INTO _display_name, _email
    FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1;

    SELECT CASE ur.role
      WHEN 'admin' THEN 'Admin'
      WHEN 'used_car_manager' THEN 'Used Car Manager'
      WHEN 'gsm_gm' THEN 'GSM/GM'
      WHEN 'gm' THEN 'General Manager'
      ELSE ur.role::text
    END INTO _title
    FROM user_roles ur WHERE ur.user_id = auth.uid()
    ORDER BY CASE ur.role
      WHEN 'admin' THEN 1
      WHEN 'gsm_gm' THEN 2
      WHEN 'gm' THEN 3
      WHEN 'used_car_manager' THEN 4
      ELSE 5
    END
    LIMIT 1;

    _display_name := COALESCE(NULLIF(TRIM(_display_name), ''), _email, auth.uid()::text);
    _first_name := split_part(_display_name, ' ', 1);
    IF split_part(_display_name, ' ', 2) <> '' THEN
      _last_initial := LEFT(split_part(_display_name, ' ', 2), 1) || '.';
    ELSE
      _last_initial := '';
    END IF;

    _appraiser_label := TRIM(_first_name || ' ' || _last_initial);
    IF _title IS NOT NULL AND _title <> '' THEN
      _appraiser_label := _appraiser_label || ' — ' || _title;
    END IF;

    NEW.appraised_by := _appraiser_label;
  END IF;

  IF NEW.progress_status IS DISTINCT FROM OLD.progress_status AND
     NEW.progress_status IN ('manager_approval', 'price_agreed', 'purchase_complete') THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role) OR
      has_role(auth.uid(), 'gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only GSM/GM, GM, or admin can set this status';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';
