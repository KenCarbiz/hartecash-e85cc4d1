ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS self_checkin_at     timestamptz,
  ADD COLUMN IF NOT EXISTS self_checkin_status text;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_self_checkin_status_chk;
ALTER TABLE public.submissions
  ADD  CONSTRAINT submissions_self_checkin_status_chk
  CHECK (self_checkin_status IS NULL OR self_checkin_status IN ('on_the_way','arrived'));

CREATE OR REPLACE FUNCTION public.customer_self_checkin(
  _token  text,
  _status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sub_id      uuid;
  _current     text;
  _new_progress text;
BEGIN
  IF _status NOT IN ('on_the_way','arrived') THEN
    RAISE EXCEPTION 'invalid status %', _status;
  END IF;

  SELECT id, progress_status INTO _sub_id, _current
  FROM submissions WHERE token = _token;

  IF _sub_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  IF _current = 'customer_arrived' AND _status = 'on_the_way' THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;
  IF _current IN ('inspection_completed','appraisal_completed',
                  'manager_approval','manager_approval_inspection',
                  'price_agreed','deal_finalized',
                  'check_request_submitted','purchase_complete','dead_lead') THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  _new_progress := CASE WHEN _status = 'arrived' THEN 'customer_arrived' ELSE 'on_the_way' END;

  UPDATE submissions
  SET progress_status = _new_progress,
      status_updated_at = now(),
      self_checkin_at = now(),
      self_checkin_status = _status
  WHERE id = _sub_id;

  INSERT INTO activity_log
    (submission_id, action, old_value, new_value, performed_by, created_at)
  VALUES
    (_sub_id, 'self_checkin', COALESCE(_current, ''), _new_progress, 'customer:self_checkin', now());

  RETURN jsonb_build_object('ok', true, 'submission_id', _sub_id, 'progress_status', _new_progress);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.customer_self_checkin(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_arrival_page(_token text)
RETURNS TABLE(
  submission_id uuid,
  customer_first_name text,
  vehicle_year text,
  vehicle_make text,
  vehicle_model text,
  vehicle_trim text,
  plate text,
  vin_last6 text,
  appointment_date text,
  appointment_time text,
  progress_status text,
  self_checkin_at timestamptz,
  self_checkin_status text,
  dealership_id text,
  dealership_name text,
  salesperson_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    split_part(coalesce(s.name,''), ' ', 1),
    s.vehicle_year::text, s.vehicle_make, s.vehicle_model,
    NULL::text,
    s.plate, right(coalesce(s.vin,''), 6),
    coalesce(a.preferred_date::text, ''), coalesce(a.preferred_time::text, ''),
    s.progress_status, s.self_checkin_at, s.self_checkin_status,
    s.dealership_id,
    coalesce(sc.dealership_name, ''),
    coalesce(p.display_name, p.email, '')
  FROM submissions s
  LEFT JOIN appointments a ON a.submission_token = s.token AND a.status NOT IN ('cancelled','completed')
  LEFT JOIN site_config sc ON sc.dealership_id = s.dealership_id
  LEFT JOIN profiles p ON p.user_id = s.assigned_salesperson_id
  WHERE s.token = _token
  ORDER BY a.preferred_date NULLS LAST, a.preferred_time NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_arrival_page(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';