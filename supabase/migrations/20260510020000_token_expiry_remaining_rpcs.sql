-- Extend the submission-token expiry guard (introduced in
-- 20260510010000_submission_token_expiry.sql) to the remaining anon-callable
-- token RPCs that read or mutate by submissions.token. With the column
-- defaulting NULL on legacy rows, this is additive — no live customer link
-- breaks; only future tokens (or rows whose token_expires_at gets set
-- explicitly later) start being rejected after expiry.
--
-- Out of scope (intentionally):
--   • get_call_feedback_context / submit_call_feedback — keyed by
--     voice_call_log.feedback_token, NOT submissions.token. Already enforce
--     a 14-day window via started_at; different system.
--   • apply_boost_bump / recent_boost_bump — granted to service_role only,
--     and service_role bypasses RLS. Token expiry would not change their
--     authorization model.
--   • export_customer_data / purge_customer_data — admin-JWT gated, not
--     customer-token gated. Tracked separately for the CCPA flow rework.

-- ── accept_offer ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_offer(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM submissions
    WHERE token = _token
      AND (token_expires_at IS NULL OR token_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  -- Set bypass flag so the role-check trigger allows this update
  PERFORM set_config('app.accept_offer_bypass', 'true', true);

  UPDATE submissions
  SET progress_status = 'offer_accepted',
      status_updated_at = now(),
      offered_price = COALESCE(offered_price, estimated_offer_high)
  WHERE token = _token
    AND (token_expires_at IS NULL OR token_expires_at > now())
    AND progress_status IN ('new', 'offer_made', 'contacted');

  PERFORM set_config('app.accept_offer_bypass', '', true);
END;
$$;

-- ── mark_docs_uploaded ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_docs_uploaded(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM submissions
    WHERE token = _token
      AND (token_expires_at IS NULL OR token_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  UPDATE submissions
  SET docs_uploaded = true
  WHERE token = _token
    AND (token_expires_at IS NULL OR token_expires_at > now());
END;
$$;

-- ── get_customer_arrival_page ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_customer_arrival_page(_token text)
RETURNS TABLE(
  submission_id uuid, customer_first_name text,
  vehicle_year text, vehicle_make text, vehicle_model text, vehicle_trim text,
  plate text, vin_last6 text, appointment_date text, appointment_time text,
  progress_status text, self_checkin_at timestamptz, self_checkin_status text,
  dealership_id text, dealership_name text, salesperson_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    s.id, split_part(coalesce(s.name,''), ' ', 1),
    s.vehicle_year::text, s.vehicle_make, s.vehicle_model, ''::text AS vehicle_trim,
    s.plate, right(coalesce(s.vin,''), 6),
    coalesce(to_char(a.preferred_date, 'YYYY-MM-DD'), ''), coalesce(a.preferred_time, ''),
    s.progress_status, s.self_checkin_at, s.self_checkin_status,
    s.dealership_id, coalesce(sc.dealership_name, ''),
    coalesce(p.display_name, p.email, '')
  FROM submissions s
  LEFT JOIN appointments a ON a.submission_token = s.token AND a.status NOT IN ('cancelled','completed')
  LEFT JOIN site_config sc ON sc.dealership_id = s.dealership_id
  LEFT JOIN profiles p ON p.user_id = s.assigned_salesperson_id
  WHERE s.token = _token
    AND (s.token_expires_at IS NULL OR s.token_expires_at > now())
  ORDER BY a.preferred_date NULLS LAST, a.preferred_time NULLS LAST
  LIMIT 1;
$$;

NOTIFY pgrst, 'reload schema';
