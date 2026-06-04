-- ── vehicle_scans ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff can insert scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff can update scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff read own-tenant vehicle_scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff write own-tenant vehicle_scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff update own-tenant vehicle_scans" ON public.vehicle_scans;

CREATE POLICY "Staff read own-tenant vehicle_scans"
  ON public.vehicle_scans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = vehicle_scans.submission_id AND (s.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.is_platform_admin(auth.uid()))));

CREATE POLICY "Staff write own-tenant vehicle_scans"
  ON public.vehicle_scans FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = vehicle_scans.submission_id AND (s.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.is_platform_admin(auth.uid()))));

CREATE POLICY "Staff update own-tenant vehicle_scans"
  ON public.vehicle_scans FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = vehicle_scans.submission_id AND (s.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.is_platform_admin(auth.uid()))));

-- ── vauto_push_log ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view push logs" ON public.vauto_push_log;
DROP POLICY IF EXISTS "Staff can insert push logs" ON public.vauto_push_log;
DROP POLICY IF EXISTS "Staff read own-tenant vauto_push_log" ON public.vauto_push_log;
DROP POLICY IF EXISTS "Staff write own-tenant vauto_push_log" ON public.vauto_push_log;

CREATE POLICY "Staff read own-tenant vauto_push_log"
  ON public.vauto_push_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = vauto_push_log.submission_id AND (s.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.is_platform_admin(auth.uid()))));

CREATE POLICY "Staff write own-tenant vauto_push_log"
  ON public.vauto_push_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = vauto_push_log.submission_id AND (s.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.is_platform_admin(auth.uid()))));

-- ── revaluation_log ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view revaluation log" ON public.revaluation_log;
DROP POLICY IF EXISTS "Service can insert revaluation" ON public.revaluation_log;
DROP POLICY IF EXISTS "Staff read own-tenant revaluation_log" ON public.revaluation_log;

CREATE POLICY "Staff read own-tenant revaluation_log"
  ON public.revaluation_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = revaluation_log.submission_id AND (s.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.is_platform_admin(auth.uid()))));

-- ── sms_inbound_log ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff read inbound log" ON public.sms_inbound_log;
DROP POLICY IF EXISTS "Staff read own-tenant sms_inbound_log" ON public.sms_inbound_log;

CREATE POLICY "Staff read own-tenant sms_inbound_log"
  ON public.sms_inbound_log FOR SELECT TO authenticated
  USING (
    (submission_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = sms_inbound_log.submission_id AND s.dealership_id = public.get_user_dealership_id(auth.uid())))
    OR (submission_id IS NULL AND sms_inbound_log.dealership_id = public.get_user_dealership_id(auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

-- ── photo_metadata ──────────────────────────────────────────────────
DROP POLICY IF EXISTS photo_metadata_select_all ON public.photo_metadata;
DROP POLICY IF EXISTS photo_metadata_insert_all ON public.photo_metadata;
DROP POLICY IF EXISTS photo_metadata_update_all ON public.photo_metadata;
DROP POLICY IF EXISTS "Staff read own-tenant photo_metadata" ON public.photo_metadata;
DROP POLICY IF EXISTS "Anonymous insert photo_metadata" ON public.photo_metadata;
DROP POLICY IF EXISTS "Staff update own-tenant photo_metadata" ON public.photo_metadata;

CREATE POLICY "Staff read own-tenant photo_metadata"
  ON public.photo_metadata FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = photo_metadata.submission_id AND (s.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.is_platform_admin(auth.uid()))));

CREATE POLICY "Anonymous insert photo_metadata"
  ON public.photo_metadata FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff update own-tenant photo_metadata"
  ON public.photo_metadata FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = photo_metadata.submission_id AND (s.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.is_platform_admin(auth.uid()))));

-- ── admin_set_customer_timezone: broaden role list ──────────────────
CREATE OR REPLACE FUNCTION public.admin_set_customer_timezone(_submission_id uuid, _timezone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_email text;
  v_old_tz text;
  v_sub_dealership text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller_id AND role IN ('admin','manager','staff','gsm_gm','gm','used_car_manager','salesperson','bdc')) THEN
    RAISE EXCEPTION 'not_staff' USING ERRCODE = '42501';
  END IF;
  BEGIN
    PERFORM now() AT TIME ZONE _timezone;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_timezone: %', _timezone USING ERRCODE = '22023';
  END;
  SELECT customer_timezone, dealership_id INTO v_old_tz, v_sub_dealership FROM public.submissions WHERE id = _submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found: %', _submission_id USING ERRCODE = '02000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller_id AND (is_platform_admin = true OR dealership_id = v_sub_dealership)) THEN
    RAISE EXCEPTION 'wrong_tenant' USING ERRCODE = '42501';
  END IF;
  UPDATE public.submissions SET customer_timezone = _timezone WHERE id = _submission_id;
  BEGIN
    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
    INSERT INTO public.staff_action_log (dealership_id, user_id, user_email, action, target_type, target_id, before, after, notes)
    VALUES (v_sub_dealership, v_caller_id, v_caller_email, 'customer_timezone_overridden', 'submission', _submission_id::text,
      jsonb_build_object('customer_timezone', v_old_tz),
      jsonb_build_object('customer_timezone', _timezone),
      'Manual override via admin_set_customer_timezone RPC');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'admin_set_customer_timezone: audit insert failed (continuing): %', SQLERRM;
  END;
  RETURN _submission_id;
END;
$$;

-- ── get_submission_portal RPC ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_submission_portal(text);
CREATE FUNCTION public.get_submission_portal(_token text)
RETURNS TABLE(
  id uuid, vehicle_year text, vehicle_make text, vehicle_model text, name text, email text, phone text,
  mileage text, exterior_color text, overall_condition text, progress_status text,
  offered_price numeric, acv_value numeric, photos_uploaded boolean, docs_uploaded boolean,
  created_at timestamp with time zone, loan_status text, token text, vin text, zip text,
  estimated_offer_low numeric, estimated_offer_high numeric, bb_tradein_avg numeric,
  appointment_set boolean,
  brake_lf integer, brake_rf integer, brake_lr integer, brake_rr integer,
  tire_lf integer, tire_rf integer, tire_lr integer, tire_rr integer,
  dealership_id text, state text,
  inspection_started_notified_at timestamp with time zone,
  check_ready_at timestamp with time zone,
  offer_locked_at timestamp with time zone,
  portal_view_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name, s.email, s.phone,
    s.mileage, s.exterior_color, s.overall_condition, s.progress_status,
    s.offered_price, s.acv_value, s.photos_uploaded, s.docs_uploaded, s.created_at,
    s.loan_status, s.token, s.vin, s.zip,
    s.estimated_offer_low, s.estimated_offer_high, s.bb_tradein_avg,
    s.appointment_set,
    s.brake_lf, s.brake_rf, s.brake_lr, s.brake_rr,
    s.tire_lf, s.tire_rf, s.tire_lr, s.tire_rr,
    s.dealership_id, s.state,
    s.inspection_started_notified_at, s.check_ready_at, s.offer_locked_at, s.portal_view_count
  FROM submissions s
  WHERE s.token = _token AND (s.token_expires_at IS NULL OR s.token_expires_at > now());
$$;
GRANT EXECUTE ON FUNCTION public.get_submission_portal(text) TO anon, authenticated;

-- ── get_submission_activity RPC ────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_submission_activity(text);
CREATE FUNCTION public.get_submission_activity(_token text)
RETURNS TABLE(id text, event_type text, title text, body text, occurred_at timestamp with time zone, nav_target text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT * FROM submissions
    WHERE token = _token AND (token_expires_at IS NULL OR token_expires_at > now())
    LIMIT 1
  )
  SELECT 'sub-' || s.id::text, 'submission', 'Vehicle submitted',
    concat('You submitted your ', coalesce(s.vehicle_year, ''), ' ', coalesce(s.vehicle_make, ''), ' ', coalesce(s.vehicle_model, '')),
    s.created_at, 'vehicles'::text
  FROM s
  UNION ALL
  SELECT 'offer-' || s.id::text, 'offer', 'Firm offer issued',
    concat('Your firm offer: $', to_char(coalesce(s.offered_price, 0)::numeric, 'FM999,999,999')),
    s.offer_locked_at, 'offers'::text
  FROM s WHERE s.offered_price IS NOT NULL AND s.offer_locked_at IS NOT NULL
  UNION ALL
  SELECT 'insp-' || s.id::text, 'inspection', 'Inspection started',
    'The dealer began inspecting your vehicle.',
    s.inspection_started_notified_at, NULL::text
  FROM s WHERE s.inspection_started_notified_at IS NOT NULL
  UNION ALL
  SELECT 'check-' || s.id::text, 'payment', 'Payment ready',
    'Your payout has been cut and is ready for delivery.',
    s.check_ready_at, 'payments'::text
  FROM s WHERE s.check_ready_at IS NOT NULL
  UNION ALL
  SELECT 'appt-' || a.id::text, 'pickup', 'Pickup appointment scheduled',
    concat('Scheduled for ', coalesce(a.preferred_date::text, ''), coalesce(' ' || a.preferred_time::text, '')),
    a.created_at, 'pickup'::text
  FROM s JOIN appointments a ON a.submission_token = s.token
  UNION ALL
  SELECT 'al-' || al.id::text,
    CASE al.action WHEN 'photos_uploaded' THEN 'photos' WHEN 'docs_uploaded' THEN 'docs' WHEN 'offer_accepted' THEN 'offer' WHEN 'inspection_started' THEN 'inspection' WHEN 'check_ready' THEN 'payment' ELSE 'system' END,
    CASE al.action WHEN 'photos_uploaded' THEN 'Photos uploaded' WHEN 'docs_uploaded' THEN 'Documents uploaded' WHEN 'offer_accepted' THEN 'Offer accepted' WHEN 'inspection_started' THEN 'Inspection started' WHEN 'check_ready' THEN 'Payment ready' ELSE al.action END,
    coalesce(al.new_value, ''), al.created_at,
    CASE al.action WHEN 'photos_uploaded' THEN 'documents' WHEN 'docs_uploaded' THEN 'documents' WHEN 'offer_accepted' THEN 'offers' WHEN 'check_ready' THEN 'payments' ELSE NULL END::text
  FROM s JOIN activity_log al ON al.submission_id = s.id
  WHERE al.action IN ('photos_uploaded','docs_uploaded','offer_accepted','inspection_started','check_ready')
  ORDER BY 5 DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.get_submission_activity(text) TO anon, authenticated;

-- ── lookup_submission_by_contact: digits-only phone matching ───────
CREATE OR REPLACE FUNCTION public.lookup_submission_by_contact(_email text, _phone text)
 RETURNS TABLE(token text, vehicle_year text, vehicle_make text, vehicle_model text, name text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _ip_hash text;
  _attempt_count integer;
  _phone_norm text;
BEGIN
  _ip_hash := encode(digest(_email || _phone, 'sha256'), 'hex');
  PERFORM cleanup_old_lookup_attempts();
  SELECT COUNT(*) INTO _attempt_count FROM lookup_attempts WHERE ip_hash = _ip_hash AND attempted_at > now() - interval '15 minutes';
  IF _attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many lookup attempts. Please try again later.';
  END IF;
  INSERT INTO lookup_attempts (ip_hash) VALUES (_ip_hash);
  _phone_norm := regexp_replace(_phone, '\D', '', 'g');
  IF length(_phone_norm) = 11 AND left(_phone_norm, 1) = '1' THEN
    _phone_norm := substring(_phone_norm from 2);
  END IF;
  RETURN QUERY
  SELECT s.token, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name
  FROM submissions s
  WHERE LOWER(s.email) = LOWER(_email)
    AND (CASE WHEN length(regexp_replace(s.phone, '\D', '', 'g')) = 11 AND left(regexp_replace(s.phone, '\D', '', 'g'), 1) = '1'
              THEN substring(regexp_replace(s.phone, '\D', '', 'g') from 2)
              ELSE regexp_replace(s.phone, '\D', '', 'g') END) = _phone_norm
  ORDER BY s.created_at DESC LIMIT 5;
END;
$function$;

-- ── watched_vehicle_history RLS tightening ─────────────────────────
DROP POLICY IF EXISTS "Anyone can read history" ON public.watched_vehicle_history;
DROP POLICY IF EXISTS "Staff can read history" ON public.watched_vehicle_history;
DROP POLICY IF EXISTS "Service role manages history" ON public.watched_vehicle_history;
DROP POLICY IF EXISTS "Staff can read history within dealership" ON public.watched_vehicle_history;

CREATE POLICY "Staff can read history within dealership"
  ON public.watched_vehicle_history FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (SELECT 1 FROM public.watched_vehicles wv WHERE wv.id = watched_vehicle_history.watched_vehicle_id AND wv.dealership_id = public.get_user_dealership_id(auth.uid()))
  );

CREATE POLICY "Service role manages history"
  ON public.watched_vehicle_history FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Drop permissive write policies ─────────────────────────────────
DROP POLICY IF EXISTS "Service role can insert vehicle image cache" ON public.vehicle_image_cache;
DROP POLICY IF EXISTS "Anyone can log a demo view" ON public.prospect_demo_views;
DROP POLICY IF EXISTS "Anon write own login attempts" ON public.login_attempt_log;
DROP POLICY IF EXISTS "pricing_model_delete" ON public.platform_pricing_model;

DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
CREATE POLICY "Anyone can create submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (token IS NOT NULL AND dealership_id IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can opt out" ON public.opt_outs;
CREATE POLICY "Anyone can opt out"
  ON public.opt_outs FOR INSERT TO public
  WITH CHECK (token IS NOT NULL AND (phone IS NOT NULL OR email IS NOT NULL));

DROP POLICY IF EXISTS "dealer_subscriptions_insert" ON public.dealer_subscriptions;
CREATE POLICY "dealer_subscriptions_insert"
  ON public.dealer_subscriptions FOR INSERT
  WITH CHECK (dealership_id IS NOT NULL AND status = 'trial');

DROP POLICY IF EXISTS "dealer_subscriptions_update" ON public.dealer_subscriptions;
CREATE POLICY "dealer_subscriptions_update"
  ON public.dealer_subscriptions FOR UPDATE
  USING (status = 'trial')
  WITH CHECK (dealership_id IS NOT NULL AND status = 'trial');

DROP POLICY IF EXISTS "dealer_subscriptions_delete" ON public.dealer_subscriptions;

-- ── testimonials moderation ────────────────────────────────────────
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin';
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS moderated_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'testimonials_status_check') THEN
    ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_status_check CHECK (status IN ('pending','approved','denied'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'testimonials_source_check') THEN
    ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_source_check CHECK (source IN ('token','public','admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS testimonials_dealership_status_idx ON public.testimonials (dealership_id, status);

CREATE OR REPLACE FUNCTION public.scrub_anon_testimonial_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    NEW.is_active := false;
    NEW.status := 'pending';
    NEW.moderated_at := NULL;
    NEW.moderated_by := NULL;
    NEW.sort_order := COALESCE(NEW.sort_order, 99);
    IF NEW.source IS NULL OR NEW.source NOT IN ('token','public') THEN
      NEW.source := 'public';
    END IF;
    IF NEW.rating IS NULL OR NEW.rating < 1 THEN
      NEW.rating := 5;
    ELSIF NEW.rating > 5 THEN
      NEW.rating := 5;
    END IF;
    IF NEW.dealership_id IS NULL THEN
      NEW.dealership_id := 'default';
    ELSIF NEW.dealership_id <> 'default'
       AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.dealership_id = NEW.dealership_id) THEN
      NEW.dealership_id := 'default';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrub_anon_testimonial_insert_trg ON public.testimonials;
CREATE TRIGGER scrub_anon_testimonial_insert_trg
BEFORE INSERT ON public.testimonials
FOR EACH ROW EXECUTE FUNCTION public.scrub_anon_testimonial_insert();

-- ── early_access_signups table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.early_access_signups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name     text,
  dealership_name  text NOT NULL,
  email            text NOT NULL,
  phone            text,
  rooftops         text,
  current_solution text,
  status           text NOT NULL DEFAULT 'new',
  source           text NOT NULL DEFAULT 'early-access-page',
  created_at       timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.early_access_signups TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.early_access_signups TO authenticated;
GRANT ALL ON public.early_access_signups TO service_role;

CREATE INDEX IF NOT EXISTS early_access_signups_created_at_idx ON public.early_access_signups(created_at);
CREATE INDEX IF NOT EXISTS early_access_signups_status_idx ON public.early_access_signups(status);

ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit an early-access signup" ON public.early_access_signups;
CREATE POLICY "Anyone can submit an early-access signup"
ON public.early_access_signups FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins can read early-access signups" ON public.early_access_signups;
CREATE POLICY "Platform admins can read early-access signups"
ON public.early_access_signups FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND dealership_id = 'default' AND role = 'admin'));

-- ── vehicle_image_cache.image_source ───────────────────────────────
ALTER TABLE public.vehicle_image_cache ADD COLUMN IF NOT EXISTS image_source text;

NOTIFY pgrst, 'reload schema';