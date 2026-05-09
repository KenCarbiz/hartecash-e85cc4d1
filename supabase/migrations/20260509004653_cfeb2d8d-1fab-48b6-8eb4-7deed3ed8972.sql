CREATE TABLE IF NOT EXISTS public.mfa_enforcement_config (
  dealership_id        text PRIMARY KEY,
  require_mfa          boolean NOT NULL DEFAULT false,
  required_for_roles   text[] NOT NULL DEFAULT ARRAY['admin','gsm_gm','gm','used_car_manager']::text[],
  grace_period_days    integer NOT NULL DEFAULT 7,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  CHECK (grace_period_days BETWEEN 0 AND 90)
);

INSERT INTO public.mfa_enforcement_config (dealership_id)
VALUES ('default')
ON CONFLICT (dealership_id) DO NOTHING;

ALTER TABLE public.mfa_enforcement_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access mfa_enf_cfg" ON public.mfa_enforcement_config;
CREATE POLICY "Service role full access mfa_enf_cfg"
  ON public.mfa_enforcement_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read mfa_enf_cfg" ON public.mfa_enforcement_config;
CREATE POLICY "Staff read mfa_enf_cfg"
  ON public.mfa_enforcement_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins manage own tenant mfa cfg" ON public.mfa_enforcement_config;
CREATE POLICY "Admins manage own tenant mfa cfg"
  ON public.mfa_enforcement_config FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.mfa_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  user_label    text,
  dealership_id text,
  event_kind    text NOT NULL CHECK (event_kind IN (
    'enrolled', 'verified', 'failed', 'removed', 'enforcement_bounce'
  )),
  factor_type   text,
  ip_addr       inet,
  user_agent    text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mfa_audit_log_user_idx
  ON public.mfa_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mfa_audit_log_dealer_idx
  ON public.mfa_audit_log (dealership_id, created_at DESC);

ALTER TABLE public.mfa_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access mfa_audit_log" ON public.mfa_audit_log;
CREATE POLICY "Service role full access mfa_audit_log"
  ON public.mfa_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users write own mfa events" ON public.mfa_audit_log;
CREATE POLICY "Authenticated users write own mfa events"
  ON public.mfa_audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read own tenant mfa audit" ON public.mfa_audit_log;
CREATE POLICY "Admins read own tenant mfa audit"
  ON public.mfa_audit_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

CREATE OR REPLACE VIEW public.v_dealership_mfa_status AS
SELECT
  ur.dealership_id,
  count(*)                                                          AS total_staff,
  count(*) FILTER (WHERE f.id IS NOT NULL)                          AS enrolled_staff,
  CASE WHEN count(*) > 0
    THEN round((count(*) FILTER (WHERE f.id IS NOT NULL))::numeric
               / count(*)::numeric * 100, 1)
    ELSE 0 END                                                      AS enrollment_pct,
  count(*) FILTER (
    WHERE ur.role IN ('admin'::app_role,'gsm_gm'::app_role,'gm'::app_role,'used_car_manager'::app_role)
      AND f.id IS NULL
  )                                                                 AS missing_high_priv_count
FROM public.user_roles ur
LEFT JOIN LATERAL (
  SELECT id FROM auth.mfa_factors mf
  WHERE mf.user_id = ur.user_id
    AND mf.status = 'verified'
  LIMIT 1
) f ON true
GROUP BY ur.dealership_id;

GRANT SELECT ON public.v_dealership_mfa_status TO authenticated;

CREATE OR REPLACE FUNCTION public.require_mfa_for_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid       uuid := auth.uid();
  _dealer    text;
  _role      text;
  _cfg       record;
  _has_fac   boolean;
  _role_age  integer;
  _grace_left integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT ur.dealership_id, ur.role::text,
         GREATEST(0, EXTRACT(day FROM now() - ur.created_at)::integer)
    INTO _dealer, _role, _role_age
  FROM public.user_roles ur
  WHERE ur.user_id = _uid
  ORDER BY ur.created_at ASC
  LIMIT 1;

  IF _dealer IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'required', false, 'has_factor', false);
  END IF;

  SELECT * INTO _cfg
  FROM public.mfa_enforcement_config
  WHERE dealership_id = _dealer;
  IF _cfg.dealership_id IS NULL THEN
    SELECT * INTO _cfg FROM public.mfa_enforcement_config WHERE dealership_id = 'default';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = _uid AND status = 'verified'
  ) INTO _has_fac;

  IF NOT _cfg.require_mfa THEN
    RETURN jsonb_build_object('ok', true, 'required', false, 'has_factor', _has_fac);
  END IF;

  IF _has_fac THEN
    RETURN jsonb_build_object('ok', true, 'required', false, 'has_factor', true);
  END IF;

  IF _cfg.required_for_roles IS NOT NULL
     AND array_length(_cfg.required_for_roles, 1) > 0
     AND NOT (_role = ANY(_cfg.required_for_roles)) THEN
    RETURN jsonb_build_object('ok', true, 'required', false, 'has_factor', false);
  END IF;

  _grace_left := GREATEST(0, _cfg.grace_period_days - _role_age);
  IF _grace_left > 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'required', false,
      'has_factor', false,
      'grace_days_left', _grace_left
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'required', true,
    'has_factor', false,
    'grace_days_left', 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.require_mfa_for_user()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_mfa_event(
  _event_kind text,
  _factor_type text DEFAULT 'totp',
  _metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid    uuid := auth.uid();
  _dealer text;
  _label  text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT dealership_id, COALESCE(display_name, email)
    INTO _dealer, _label
  FROM public.user_roles
  WHERE user_id = _uid
  LIMIT 1;

  INSERT INTO public.mfa_audit_log
    (user_id, user_label, dealership_id, event_kind, factor_type, metadata)
  VALUES
    (_uid, _label, _dealer, _event_kind, _factor_type, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_mfa_event(text, text, jsonb)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';