-- rate_limit_hits — generic DB-backed rate limiter for edge functions.
-- Edge functions live on short-lived, horizontally scaled isolates so an
-- in-memory counter is useless; this table provides a shared store that
-- any function can use. Each function inserts one row per attempt with
-- a stable key (usually a hash of the client IP + function name), then
-- counts rows within a rolling window to decide whether to reject.
--
-- Rows are short-lived; a cron (pg_cron or scheduled edge function)
-- should delete rows older than the longest active window. For now
-- partial indexes + a TTL column let callers query efficiently.

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigserial PRIMARY KEY,
  -- Scope prefix + hashed identifier, e.g. "unsub:<sha256(ip)>"
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_key_created_idx
  ON public.rate_limit_hits (key, created_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- No direct client access — this table is written/read only by service
-- role (edge functions). Deny everyone else.
DROP POLICY IF EXISTS "rate_limit_hits_deny_all" ON public.rate_limit_hits;
CREATE POLICY "rate_limit_hits_deny_all"
  ON public.rate_limit_hits
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);
