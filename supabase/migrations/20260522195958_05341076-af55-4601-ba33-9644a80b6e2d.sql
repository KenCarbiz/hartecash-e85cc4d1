ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS check_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_pickup_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_picked_up_at timestamptz;

DROP FUNCTION IF EXISTS public.get_submission_portal(text);
CREATE FUNCTION public.get_submission_portal(_token text)
RETURNS TABLE(
  id uuid, vehicle_year text, vehicle_make text, vehicle_model text,
  name text, email text, phone text, mileage text, exterior_color text,
  overall_condition text, progress_status text, offered_price numeric,
  acv_value numeric, photos_uploaded boolean, docs_uploaded boolean,
  created_at timestamptz, loan_status text, token text, vin text, zip text,
  estimated_offer_low numeric, estimated_offer_high numeric,
  bb_tradein_avg numeric, appointment_set boolean,
  brake_lf integer, brake_rf integer, brake_lr integer, brake_rr integer,
  tire_lf integer, tire_rf integer, tire_lr integer, tire_rr integer,
  dealership_id text, state text,
  inspection_started_notified_at timestamptz,
  check_ready_at timestamptz,
  offer_locked_at timestamptz,
  portal_view_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name,
    s.email, s.phone, s.mileage, s.exterior_color, s.overall_condition,
    s.progress_status, s.offered_price, s.acv_value, s.photos_uploaded,
    s.docs_uploaded, s.created_at, s.loan_status, s.token, s.vin, s.zip,
    s.estimated_offer_low, s.estimated_offer_high, s.bb_tradein_avg,
    s.appointment_set, s.brake_lf, s.brake_rf, s.brake_lr, s.brake_rr,
    s.tire_lf, s.tire_rf, s.tire_lr, s.tire_rr,
    s.dealership_id, s.state,
    s.inspection_started_notified_at,
    s.check_ready_at,
    s.offer_locked_at,
    s.portal_view_count
  FROM submissions s
  WHERE s.token = _token
    AND (s.token_expires_at IS NULL OR s.token_expires_at > now());
$$;
GRANT EXECUTE ON FUNCTION public.get_submission_portal(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_submission_activity(text);
CREATE FUNCTION public.get_submission_activity(_token text)
RETURNS TABLE(
  id text, event_type text, title text, body text,
  occurred_at timestamptz, nav_target text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT * FROM submissions
    WHERE token = _token
      AND (token_expires_at IS NULL OR token_expires_at > now())
    LIMIT 1
  )
  SELECT 'sub-' || s.id::text, 'submission',
    'Vehicle submitted',
    concat('You submitted your ',
      coalesce(s.vehicle_year, ''), ' ',
      coalesce(s.vehicle_make, ''), ' ',
      coalesce(s.vehicle_model, '')),
    s.created_at, 'vehicles'::text
  FROM s
  UNION ALL
  SELECT 'offer-' || s.id::text, 'offer', 'Firm offer issued',
    concat('Your firm offer: $',
      to_char(coalesce(s.offered_price, 0)::numeric, 'FM999,999,999')),
    s.offer_locked_at, 'offers'::text
  FROM s
  WHERE s.offered_price IS NOT NULL AND s.offer_locked_at IS NOT NULL
  UNION ALL
  SELECT 'insp-' || s.id::text, 'inspection', 'Inspection started',
    'The dealer began inspecting your vehicle.',
    s.inspection_started_notified_at, NULL::text
  FROM s
  WHERE s.inspection_started_notified_at IS NOT NULL
  UNION ALL
  SELECT 'check-' || s.id::text, 'payment', 'Payment ready',
    'Your payout has been cut and is ready for delivery.',
    s.check_ready_at, 'payments'::text
  FROM s
  WHERE s.check_ready_at IS NOT NULL
  UNION ALL
  SELECT 'appt-' || a.id::text, 'pickup', 'Pickup appointment scheduled',
    concat('Scheduled for ',
      coalesce(a.preferred_date::text, ''),
      coalesce(' ' || a.preferred_time::text, '')),
    a.created_at, 'pickup'::text
  FROM s
  JOIN appointments a ON a.submission_token = s.token
  UNION ALL
  SELECT 'al-' || al.id::text,
    CASE al.action
      WHEN 'photos_uploaded' THEN 'photos'
      WHEN 'docs_uploaded' THEN 'docs'
      WHEN 'offer_accepted' THEN 'offer'
      WHEN 'inspection_started' THEN 'inspection'
      WHEN 'check_ready' THEN 'payment'
      ELSE 'system'
    END,
    CASE al.action
      WHEN 'photos_uploaded' THEN 'Photos uploaded'
      WHEN 'docs_uploaded' THEN 'Documents uploaded'
      WHEN 'offer_accepted' THEN 'Offer accepted'
      WHEN 'inspection_started' THEN 'Inspection started'
      WHEN 'check_ready' THEN 'Payment ready'
      ELSE al.action
    END,
    coalesce(al.new_value, ''),
    al.created_at,
    CASE al.action
      WHEN 'photos_uploaded' THEN 'documents'
      WHEN 'docs_uploaded' THEN 'documents'
      WHEN 'offer_accepted' THEN 'offers'
      WHEN 'check_ready' THEN 'payments'
      ELSE NULL
    END::text
  FROM s
  JOIN activity_log al ON al.submission_id = s.id
  WHERE al.action IN (
    'photos_uploaded', 'docs_uploaded', 'offer_accepted',
    'inspection_started', 'check_ready'
  )
  ORDER BY 5 DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.get_submission_activity(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';