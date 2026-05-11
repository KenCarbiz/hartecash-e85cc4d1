-- Two-factor authentication (TOTP) — enrollment, enforcement, audit.
--
-- Supabase Auth supports MFA natively via the auth.mfa_factors table
-- and the supabase.auth.mfa.* JS API. This migration adds:
--
--   mfa_enforcement_config  — per-tenant policy. When require_mfa is
--                             true, staff users without an enrolled
--                             factor are redirected to /admin/mfa-setup
--                             on next login. grace_period_days lets a
--                             dealership opt new staff into a soft-
--                             enforce window before hard-blocking.
--
--   mfa_audit_log           — append-only trail of MFA events
--                             (enrolled, verified, failed, removed)
--                             for the privacy posture page.
--
--   v_dealership_mfa_status — per-tenant rollup: total staff, staff
--                             with at least one verified factor,
--                             enrollment %.
--
--   require_mfa_for_role    — RPC the frontend calls to know whether
--                             the user must enroll before continuing.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.mfa_enforcement_config (
  dealership_id        text PRIMARY KEY,
  require_mfa          boolean NOT NULL DEFAULT false,
  required_for_roles   text[] NOT NULL DEFAULT ARRAY['admin','manager']::text[],
  grace_period_days    integer NOT NULL DEFAULT 7,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid,
  CHECK (grace_period_days BETWEEN 0 AND 90)
);

INSERT INTO public.mfa_enforcement_config (dealership_id)
VALUES ('default')
ON CONFLICT (dealership_id) DO NOTHING;

ALTER TABLE public.mfa_enforcement_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access mfa_enf_cfg"
  ON public.mfa_enforcement_config;
CREATE POLICY "Service role full access mfa_enf_cfg"
  ON public.mfa_enforcement_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read mfa_enf_cfg"
  ON public.mfa_enforcement_config;
CREATE POLICY "Staff read mfa_enf_cfg"
  ON public.mfa_enforcement_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins manage own tenant mfa cfg"
  ON public.mfa_enforcement_config;
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

-- ── 2. MFA audit log ──────────────────────────────────────────────
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

DROP POLICY IF EXISTS "Service role full access mfa_audit_log"
  ON public.mfa_audit_log;
CREATE POLICY "Service role full access mfa_audit_log"
  ON public.mfa_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users write own mfa events"
  ON public.mfa_audit_log;
CREATE POLICY "Authenticated users write own mfa events"
  ON public.mfa_audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read own tenant mfa audit"
  ON public.mfa_audit_log;
CREATE POLICY "Admins read own tenant mfa audit"
  ON public.mfa_audit_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

-- ── 3. v_dealership_mfa_status — enrollment rollup ────────────────
-- Lists every user_role row, joins to auth.mfa_factors to detect a
-- verified factor. The view runs as authenticated (PostgREST relays
-- the staff JWT), so RLS still applies.

CREATE OR REPLACE VIEW public.v_dealership_mfa_status AS
SELECT
  ur.dealership_id,
  count(*)                                                          AS total_staff,
  count(*) FILTER (WHERE f.id IS NOT NULL)                          AS enrolled_staff,
  CASE WHEN count(*) > 0
    THEN round((count(*) FILTER (WHERE f.id IS NOT NULL))::numeric
               / count(*)::numeric * 100, 1)
    ELSE 0 END                                                      AS enrollment_pct,
  -- ur.role is the app_role enum; cast to text so the IN-list of text
  -- literals compares cleanly.
  count(*) FILTER (WHERE ur.role::text IN ('admin','manager') AND f.id IS NULL)
                                                                    AS missing_high_priv_count
FROM public.user_roles ur
LEFT JOIN LATERAL (
  SELECT id FROM auth.mfa_factors mf
  WHERE mf.user_id = ur.user_id
    AND mf.status = 'verified'
  LIMIT 1
) f ON true
GROUP BY ur.dealership_id;

GRANT SELECT ON public.v_dealership_mfa_status TO authenticated;

-- ── 4. require_mfa_for_user RPC ───────────────────────────────────
-- Frontend calls this after signin to learn whether the user must
-- enroll an MFA factor before being allowed past the login flow.
-- Returns:
--   { ok: true, required: bool, has_factor: bool, grace_days_left: int }
--
-- Logic:
--   If tenant.require_mfa = false → required=false
--   If user already has verified factor → required=false (no reset)
--   If user_roles.created_at within grace_period_days → required=false
--   Else → required=true

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
    -- No staff role; MFA isn't ours to require.
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

  -- No factor enrolled and tenant requires it. Honor role filter +
  -- grace period.
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

-- ── 5. log_mfa_event RPC ──────────────────────────────────────────
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

  -- user_roles holds tenant scope but no display fields. Pull tenant
  -- from there and the human label from profiles (display_name/email).
  SELECT dealership_id INTO _dealer
  FROM public.user_roles
  WHERE user_id = _uid
  LIMIT 1;

  SELECT COALESCE(display_name, email) INTO _label
  FROM public.profiles
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
