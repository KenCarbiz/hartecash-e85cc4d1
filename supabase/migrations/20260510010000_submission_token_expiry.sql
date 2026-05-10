-- Submission token expiry — additive, non-breaking.
--
-- Why: customer-facing tokens (used by /offer, /my-submission, /upload,
-- /docs, /watch-my-car, etc.) currently never expire. A token leaked or
-- forwarded weeks/months ago still grants full access to the customer
-- record forever.
--
-- Strategy:
--   1. Add `token_expires_at timestamptz` (NULL allowed) with a column
--      default of now()+90d. Existing rows stay NULL on purpose so live
--      customer links do NOT break. Operations can backfill them later
--      if a tighter rollout is wanted.
--   2. New rows automatically get a 90-day expiry via the column default.
--   3. Public token-RPCs gain a `(token_expires_at IS NULL OR token_expires_at > now())`
--      filter so expired rows return empty (the apps already render
--      "link expired" / 404 fallbacks on empty results).
--
-- Idempotent (IF NOT EXISTS guards, CREATE OR REPLACE on functions).
-- Ends with NOTIFY pgrst.
--
-- Other token-bearing RPCs (boost-*, watch-my-car, schedule, docs) still
-- need the same expiry guard added; this migration covers the high-traffic
-- portal/photo flows. The `public.is_submission_token_valid()` helper is
-- the canonical predicate to use in those follow-up migrations.

-- ── Schema ────────────────────────────────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

ALTER TABLE public.submissions
  ALTER COLUMN token_expires_at SET DEFAULT (now() + interval '90 days');

CREATE INDEX IF NOT EXISTS idx_submissions_token_expires_at
  ON public.submissions(token_expires_at)
  WHERE token_expires_at IS NOT NULL;

-- ── Helper ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_submission_token_valid(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.submissions
    WHERE token = _token
      AND (token_expires_at IS NULL OR token_expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_submission_token_valid(text) TO anon, authenticated;

-- ── Token-gated RPCs: add expiry guard ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_submission_by_token(_token text)
RETURNS TABLE(
  id uuid,
  vehicle_year text,
  vehicle_make text,
  vehicle_model text,
  name text,
  photos_uploaded boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, vehicle_year, vehicle_make, vehicle_model, name, photos_uploaded
  FROM submissions
  WHERE token = _token
    AND (token_expires_at IS NULL OR token_expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.mark_photos_uploaded(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE submissions
  SET photos_uploaded = true
  WHERE token = _token
    AND (token_expires_at IS NULL OR token_expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.get_submission_portal(_token text)
RETURNS TABLE(
  id uuid, vehicle_year text, vehicle_make text, vehicle_model text,
  name text, email text, phone text, mileage text, exterior_color text,
  overall_condition text, progress_status text, offered_price numeric,
  acv_value numeric, photos_uploaded boolean, docs_uploaded boolean,
  created_at timestamp with time zone, loan_status text, token text,
  vin text, zip text, estimated_offer_low numeric,
  estimated_offer_high numeric, bb_tradein_avg numeric,
  appointment_set boolean,
  brake_lf integer, brake_rf integer, brake_lr integer, brake_rr integer,
  tire_lf integer, tire_rf integer, tire_lr integer, tire_rr integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name, s.email, s.phone,
         s.mileage, s.exterior_color, s.overall_condition, s.progress_status,
         s.offered_price, s.acv_value, s.photos_uploaded, s.docs_uploaded, s.created_at,
         s.loan_status, s.token, s.vin, s.zip,
         s.estimated_offer_low, s.estimated_offer_high, s.bb_tradein_avg,
         s.appointment_set,
         s.brake_lf, s.brake_rf, s.brake_lr, s.brake_rr,
         s.tire_lf, s.tire_rf, s.tire_lr, s.tire_rr
  FROM submissions s
  WHERE s.token = _token
    AND (s.token_expires_at IS NULL OR s.token_expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.increment_portal_view(_token text)
RETURNS TABLE(view_count int, offer_locked_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _submission_id uuid;
  _dealership_id text;
  _auto_lock boolean;
  _new_count int;
  _now timestamptz := now();
BEGIN
  SELECT id, dealership_id
    INTO _submission_id, _dealership_id
  FROM public.submissions
  WHERE token = _token
    AND (token_expires_at IS NULL OR token_expires_at > _now)
  LIMIT 1;

  IF _submission_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(sc.auto_lock_offer_on_re_engagement, true)
    INTO _auto_lock
  FROM public.site_config sc
  WHERE sc.dealership_id = _dealership_id
  LIMIT 1;

  UPDATE public.submissions s
  SET
    portal_view_count      = s.portal_view_count + 1,
    portal_last_viewed_at  = _now,
    offer_locked_at        = CASE
      WHEN s.offer_locked_at IS NULL
        AND COALESCE(_auto_lock, true) = true
        AND s.portal_view_count + 1 >= 2
      THEN _now
      ELSE s.offer_locked_at
    END
  WHERE s.id = _submission_id
  RETURNING s.portal_view_count, s.offer_locked_at
  INTO _new_count, offer_locked_at;

  view_count := _new_count;
  RETURN NEXT;
END;
$$;

NOTIFY pgrst, 'reload schema';
