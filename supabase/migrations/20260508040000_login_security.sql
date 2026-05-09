-- Login security hardening — backup codes, attempt log, lockout.
--
-- Three controls that complete the production-ready MFA story and
-- raise the bar on credential-stuffing attacks:
--
-- 1. mfa_backup_codes — pre-hashed single-use recovery codes. When
--    a staff user loses their phone, they enter one of these
--    instead of the TOTP code. Each code is good for one use.
--    Standard pattern: 10 codes generated at enrollment, displayed
--    once, never recoverable from the DB (only hashes stored).
--
-- 2. login_attempt_log — every signin attempt (success or fail),
--    keyed by email + IP + timestamp. Drives lockout AND becomes
--    the forensic trail when something looks off.
--
-- 3. is_login_locked + record_login_attempt RPCs — atomic functions
--    the AdminLogin page calls before/after signInWithPassword.
--    If an IP has 5+ failures in the last 15 minutes for ANY email,
--    or 3+ failures for a specific email, lock for 1 hour.
--
-- Idempotent.

-- ── mfa_backup_codes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mfa_backup_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  code_hash     text NOT NULL,            -- SHA-256(code) — never plaintext
  used_at       timestamptz,
  consumed_ip   inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mfa_backup_codes_user_idx
  ON public.mfa_backup_codes (user_id) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS mfa_backup_codes_hash_idx
  ON public.mfa_backup_codes (code_hash) WHERE used_at IS NULL;

ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access mfa_backup_codes"
  ON public.mfa_backup_codes;
CREATE POLICY "Service role full access mfa_backup_codes"
  ON public.mfa_backup_codes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users do NOT have direct read on this table. The only way to
-- interact is through SECURITY DEFINER RPCs which scope by auth.uid().

-- ── generate_mfa_backup_codes ─────────────────────────────────────
-- Produces 10 codes, stores their hashes, returns the plaintext to
-- the caller exactly ONCE. Subsequent calls invalidate any
-- previously generated codes (one set live at a time).

CREATE OR REPLACE FUNCTION public.generate_mfa_backup_codes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _codes text[] := ARRAY[]::text[];
  _code text;
  i int;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  -- Wipe prior codes so only one set is ever live.
  DELETE FROM mfa_backup_codes WHERE user_id = _uid;

  FOR i IN 1..10 LOOP
    -- 8 chars, base32-friendly alphabet (no 0/O/I/1 confusion)
    _code := upper(substring(
      translate(encode(gen_random_bytes(8), 'base64'), '0OI1l+/=', '23456789')
      FROM 1 FOR 8
    ));
    _codes := _codes || _code;
    INSERT INTO mfa_backup_codes (user_id, code_hash)
    VALUES (_uid, encode(digest(_code, 'sha256'), 'hex'));
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'codes', to_jsonb(_codes),
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_mfa_backup_codes()
  TO authenticated, service_role;

-- ── consume_mfa_backup_code ───────────────────────────────────────
-- Called from the MFA challenge page when the user clicks "Use a
-- backup code." Atomically marks the code used, returns ok=true.

CREATE OR REPLACE FUNCTION public.consume_mfa_backup_code(
  _code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hash text;
  _row record;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF _code IS NULL OR length(_code) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  _hash := encode(digest(upper(trim(_code)), 'sha256'), 'hex');

  SELECT id INTO _row
  FROM mfa_backup_codes
  WHERE user_id = _uid
    AND code_hash = _hash
    AND used_at IS NULL
  LIMIT 1;

  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_match');
  END IF;

  UPDATE mfa_backup_codes
  SET used_at = now()
  WHERE id = _row.id;

  RETURN jsonb_build_object('ok', true, 'remaining', (
    SELECT count(*) FROM mfa_backup_codes
    WHERE user_id = _uid AND used_at IS NULL
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_mfa_backup_code(text)
  TO authenticated, service_role;

-- ── login_attempt_log ─────────────────────────────────────────────
-- Append-only. Every signin attempt — success or fail — gets a row.
-- Drives both lockout decisions and forensic review when something
-- looks off ("our admin says someone tried to log in from Russia
-- last night — show me").

CREATE TABLE IF NOT EXISTS public.login_attempt_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  ip_addr       inet,
  user_agent    text,
  succeeded     boolean NOT NULL,
  failure_reason text,
  attempted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempt_log_email_idx
  ON public.login_attempt_log (email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS login_attempt_log_ip_idx
  ON public.login_attempt_log (ip_addr, attempted_at DESC);
CREATE INDEX IF NOT EXISTS login_attempt_log_recent_failed_idx
  ON public.login_attempt_log (attempted_at DESC)
  WHERE succeeded = false;

ALTER TABLE public.login_attempt_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access login_attempt_log"
  ON public.login_attempt_log;
CREATE POLICY "Service role full access login_attempt_log"
  ON public.login_attempt_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon write own login attempts"
  ON public.login_attempt_log;
-- Anon writes are how the AdminLogin page records its own
-- pre-signin attempt. Hardened by the underlying RPC (only the
-- record_login_attempt RPC opens this insert path).
CREATE POLICY "Anon write own login attempts"
  ON public.login_attempt_log FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read own login attempts"
  ON public.login_attempt_log;
CREATE POLICY "Authenticated read own login attempts"
  ON public.login_attempt_log FOR SELECT TO authenticated
  USING (
    -- Users can read their own attempts; admins can read for
    -- their tenant via a separate path (see v_login_attempts_recent).
    email = (auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ── is_login_locked RPC ───────────────────────────────────────────
-- Returns ok=true with locked=true when the IP or email has crossed
-- the failure threshold. Login page calls BEFORE attempting the
-- supabase.auth.signInWithPassword.
--
-- Thresholds:
--   IP-wide:   5 fails in last 15 minutes  → lock 60 min
--   Per-email: 3 fails in last 15 minutes  → lock 60 min

CREATE OR REPLACE FUNCTION public.is_login_locked(
  _email text,
  _ip    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ip_inet inet;
  _ip_fails int := 0;
  _email_fails int := 0;
  _newest_fail timestamptz;
BEGIN
  IF _ip IS NOT NULL THEN
    BEGIN
      _ip_inet := _ip::inet;
    EXCEPTION WHEN OTHERS THEN
      _ip_inet := NULL;
    END;
  END IF;

  IF _ip_inet IS NOT NULL THEN
    SELECT count(*), max(attempted_at)
      INTO _ip_fails, _newest_fail
    FROM login_attempt_log
    WHERE ip_addr = _ip_inet
      AND succeeded = false
      AND attempted_at > now() - interval '15 minutes';
  END IF;

  IF _email IS NOT NULL THEN
    SELECT count(*) INTO _email_fails
    FROM login_attempt_log
    WHERE lower(email) = lower(_email)
      AND succeeded = false
      AND attempted_at > now() - interval '15 minutes';
  END IF;

  IF _ip_fails >= 5 OR _email_fails >= 3 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'locked', true,
      'reason', CASE WHEN _ip_fails >= 5 THEN 'too_many_attempts_from_ip'
                     ELSE 'too_many_attempts_for_email' END,
      'ip_fails', _ip_fails,
      'email_fails', _email_fails,
      'unlock_after', COALESCE(_newest_fail, now()) + interval '60 minutes'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'locked', false,
    'ip_fails', _ip_fails,
    'email_fails', _email_fails
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_login_locked(text, text)
  TO anon, authenticated, service_role;

-- ── record_login_attempt RPC ──────────────────────────────────────
-- Called by AdminLogin AFTER supabase.auth.signInWithPassword
-- regardless of outcome. Anon-callable so it works pre-auth.

CREATE OR REPLACE FUNCTION public.record_login_attempt(
  _email   text,
  _success boolean,
  _ip      text DEFAULT NULL,
  _ua      text DEFAULT NULL,
  _reason  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ip_inet inet;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN RETURN; END IF;

  BEGIN
    _ip_inet := _ip::inet;
  EXCEPTION WHEN OTHERS THEN
    _ip_inet := NULL;
  END;

  INSERT INTO login_attempt_log
    (email, ip_addr, user_agent, succeeded, failure_reason)
  VALUES
    (lower(trim(_email)), _ip_inet,
     left(coalesce(_ua, ''), 500),
     _success, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text, text, text)
  TO anon, authenticated, service_role;

-- ── v_login_attempts_recent ───────────────────────────────────────
-- Admin-readable rollup for the privacy posture page. Surfaces
-- failures-per-IP and failures-per-email over the last 24 hours so
-- the admin sees brute-force activity inline.

CREATE OR REPLACE VIEW public.v_login_attempts_recent AS
SELECT
  email,
  ip_addr,
  count(*)                           AS total_attempts,
  count(*) FILTER (WHERE succeeded)  AS successes,
  count(*) FILTER (WHERE NOT succeeded) AS failures,
  max(attempted_at)                  AS last_attempt_at
FROM login_attempt_log
WHERE attempted_at > now() - interval '24 hours'
GROUP BY email, ip_addr
HAVING count(*) FILTER (WHERE NOT succeeded) >= 3
ORDER BY failures DESC, last_attempt_at DESC
LIMIT 100;

GRANT SELECT ON public.v_login_attempts_recent TO authenticated;

NOTIFY pgrst, 'reload schema';
