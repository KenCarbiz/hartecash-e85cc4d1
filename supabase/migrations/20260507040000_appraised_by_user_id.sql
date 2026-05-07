-- Phase 1 / item 25b: migrate appraised_by from free-text to a real
-- user FK so per-rep dashboards stop showing phantom rows from
-- capitalization variance ("BJ" / "B.J." / "Bobby Jenkins").
--
-- Approach is additive — we do NOT drop the existing
-- submissions.appraised_by text column. Adding a FK column alongside
-- lets dashboards migrate at their own pace without breaking
-- consumers that still read the text. The trigger that auto-records
-- the appraiser is updated to write BOTH so old and new readers
-- stay correct.
--
-- A best-effort backfill resolves historical text values to user_id
-- by matching profiles.email == appraised_by. Anything we can't
-- resolve stays NULL on the FK and the dashboard can fall back to
-- the text label for those rows.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS appraised_by_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS submissions_appraised_by_user_idx
  ON public.submissions (appraised_by_user_id)
  WHERE appraised_by_user_id IS NOT NULL;

-- Backfill: resolve text values that look like emails. Skip rows
-- that are already populated so re-running is a no-op.
UPDATE public.submissions s
SET appraised_by_user_id = p.user_id
FROM public.profiles p
WHERE s.appraised_by_user_id IS NULL
  AND s.appraised_by IS NOT NULL
  AND s.appraised_by ~ '@'
  AND lower(s.appraised_by) = lower(p.email);

-- Some legacy rows wrote auth.uid()::text as a fallback when the
-- profile email lookup failed. Catch those by casting back to uuid.
UPDATE public.submissions s
SET appraised_by_user_id = s.appraised_by::uuid
WHERE s.appraised_by_user_id IS NULL
  AND s.appraised_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = s.appraised_by::uuid);

-- Update the role-enforcement trigger so going forward we always
-- write the FK alongside the text label. The label-building logic
-- (display_name + role title) from 20260324230441 is preserved
-- verbatim — we only ADD the appraised_by_user_id write.
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
      has_role(auth.uid(), 'gsm_gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only managers can update the offered price';
    END IF;
  END IF;

  IF NEW.acv_value IS DISTINCT FROM OLD.acv_value THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'used_car_manager'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only managers can enter the appraisal value';
    END IF;

    -- Canonical FK first — every dashboard going forward groups by
    -- this UUID and is immune to "BJ" vs "B.J." spelling drift.
    NEW.appraised_by_user_id := auth.uid();

    -- Then the human-readable label (back-compat for older readers).
    SELECT p.display_name, p.email INTO _display_name, _email
    FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1;

    SELECT CASE ur.role
      WHEN 'admin' THEN 'Admin'
      WHEN 'used_car_manager' THEN 'Used Car Manager'
      WHEN 'gsm_gm' THEN 'GSM/GM'
      ELSE ur.role::text
    END INTO _title
    FROM user_roles ur WHERE ur.user_id = auth.uid()
    ORDER BY CASE ur.role
      WHEN 'admin' THEN 1
      WHEN 'gsm_gm' THEN 2
      WHEN 'used_car_manager' THEN 3
      ELSE 4
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
      has_role(auth.uid(), 'gsm_gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only GSM/GM or admin can set this status';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';
