-- 1) Extend get_submission_portal RPC to expose additional portal fields.
DROP FUNCTION IF EXISTS public.get_submission_portal(text);

CREATE FUNCTION public.get_submission_portal(_token text)
RETURNS TABLE(
  id uuid,
  vehicle_year text,
  vehicle_make text,
  vehicle_model text,
  name text,
  email text,
  phone text,
  mileage text,
  exterior_color text,
  overall_condition text,
  progress_status text,
  offered_price numeric,
  acv_value numeric,
  photos_uploaded boolean,
  docs_uploaded boolean,
  created_at timestamptz,
  loan_status text,
  token text,
  vin text,
  zip text,
  estimated_offer_low numeric,
  estimated_offer_high numeric,
  bb_tradein_avg numeric,
  appointment_set boolean,
  brake_lf integer,
  brake_rf integer,
  brake_lr integer,
  brake_rr integer,
  tire_lf integer,
  tire_rf integer,
  tire_lr integer,
  tire_rr integer,
  dealership_id text,
  state text,
  inspection_started_notified_at timestamptz,
  check_ready_at timestamptz,
  offer_locked_at timestamptz,
  portal_view_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.id, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name, s.email, s.phone,
         s.mileage, s.exterior_color, s.overall_condition, s.progress_status,
         s.offered_price, s.acv_value, s.photos_uploaded, s.docs_uploaded, s.created_at,
         s.loan_status, s.token, s.vin, s.zip,
         s.estimated_offer_low, s.estimated_offer_high, s.bb_tradein_avg,
         s.appointment_set,
         s.brake_lf, s.brake_rf, s.brake_lr, s.brake_rr,
         s.tire_lf, s.tire_rf, s.tire_lr, s.tire_rr,
         s.dealership_id, s.state,
         s.inspection_started_notified_at,
         NULL::timestamptz AS check_ready_at,
         s.offer_locked_at,
         s.portal_view_count
  FROM submissions s
  WHERE s.token = _token
    AND (s.token_expires_at IS NULL OR s.token_expires_at > now());
$function$;

GRANT EXECUTE ON FUNCTION public.get_submission_portal(text) TO anon, authenticated;

-- 2) New RPC: get_submission_activity — customer-safe timeline union of
--    submission lifecycle stamps, appointments, and whitelisted activity_log rows.
DROP FUNCTION IF EXISTS public.get_submission_activity(text);

CREATE FUNCTION public.get_submission_activity(_token text)
RETURNS TABLE(
  id text,
  event_type text,
  title text,
  body text,
  occurred_at timestamptz,
  nav_target text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH sub AS (
    SELECT *
    FROM submissions s
    WHERE s.token = _token
      AND (s.token_expires_at IS NULL OR s.token_expires_at > now())
    LIMIT 1
  ),
  lifecycle AS (
    SELECT
      'sub-created-' || s.id::text AS id,
      'submission'::text AS event_type,
      'Vehicle submitted'::text AS title,
      ('You submitted your ' || coalesce(s.vehicle_year,'') || ' ' ||
        coalesce(s.vehicle_make,'') || ' ' || coalesce(s.vehicle_model,''))::text AS body,
      s.created_at AS occurred_at,
      'vehicle'::text AS nav_target
    FROM sub s
    UNION ALL
    SELECT 'sub-offer-' || s.id::text, 'offer',
           'Offer generated',
           'Your initial offer estimate is ready.',
           s.created_at, 'offer'
    FROM sub s
    WHERE s.estimated_offer_low IS NOT NULL OR s.estimated_offer_high IS NOT NULL
    UNION ALL
    SELECT 'sub-firm-' || s.id::text, 'offer',
           'Firm offer issued',
           'Your dealer issued a firm offer.',
           s.offer_locked_at, 'offer'
    FROM sub s
    WHERE s.offer_locked_at IS NOT NULL
    UNION ALL
    SELECT 'sub-inspect-' || s.id::text, 'inspection',
           'Inspection started',
           'Your dealer began reviewing your vehicle.',
           s.inspection_started_notified_at, 'inspection'
    FROM sub s
    WHERE s.inspection_started_notified_at IS NOT NULL
    UNION ALL
    SELECT 'sub-docs-' || s.id::text, 'documents',
           'Documents uploaded',
           'Your documents were received.',
           s.created_at, 'documents'
    FROM sub s
    WHERE coalesce(s.docs_uploaded, false) = true
    UNION ALL
    SELECT 'sub-photos-' || s.id::text, 'photos',
           'Photos uploaded',
           'Your vehicle photos were received.',
           s.created_at, 'photos'
    FROM sub s
    WHERE coalesce(s.photos_uploaded, false) = true
  ),
  appts AS (
    SELECT
      'appt-' || a.id::text AS id,
      'pickup'::text AS event_type,
      CASE
        WHEN a.confirmed_at IS NOT NULL THEN 'Appointment confirmed'
        WHEN a.rescheduled_at IS NOT NULL THEN 'Appointment rescheduled'
        ELSE 'Appointment scheduled'
      END AS title,
      coalesce(a.location, a.store_location, 'Appointment scheduled')::text AS body,
      coalesce(a.scheduled_at, a.confirmed_at, a.created_at) AS occurred_at,
      'pickup'::text AS nav_target
    FROM appointments a
    JOIN sub s ON s.token = a.submission_token
  ),
  acts AS (
    SELECT
      'act-' || al.id::text AS id,
      'messages'::text AS event_type,
      CASE al.action
        WHEN 'message_sent'      THEN 'Message sent'
        WHEN 'message_received'  THEN 'Message received'
        WHEN 'offer_accepted'    THEN 'Offer accepted'
        WHEN 'offer_updated'     THEN 'Offer updated'
        WHEN 'document_approved' THEN 'Document approved'
        WHEN 'document_rejected' THEN 'Document needs attention'
        WHEN 'payment_initiated' THEN 'Payment initiated'
        WHEN 'payment_completed' THEN 'Payment completed'
        ELSE initcap(replace(al.action, '_', ' '))
      END AS title,
      coalesce(al.new_value, '')::text AS body,
      al.created_at AS occurred_at,
      CASE al.action
        WHEN 'message_sent' THEN 'messages'
        WHEN 'message_received' THEN 'messages'
        WHEN 'offer_accepted' THEN 'offer'
        WHEN 'offer_updated' THEN 'offer'
        WHEN 'document_approved' THEN 'documents'
        WHEN 'document_rejected' THEN 'documents'
        WHEN 'payment_initiated' THEN 'payment'
        WHEN 'payment_completed' THEN 'payment'
        ELSE 'dashboard'
      END::text AS nav_target
    FROM activity_log al
    JOIN sub s ON s.id = al.submission_id
    WHERE al.action IN (
      'message_sent','message_received',
      'offer_accepted','offer_updated',
      'document_approved','document_rejected',
      'payment_initiated','payment_completed'
    )
  )
  SELECT * FROM lifecycle WHERE occurred_at IS NOT NULL
  UNION ALL
  SELECT * FROM appts WHERE occurred_at IS NOT NULL
  UNION ALL
  SELECT * FROM acts WHERE occurred_at IS NOT NULL
  ORDER BY occurred_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_submission_activity(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';