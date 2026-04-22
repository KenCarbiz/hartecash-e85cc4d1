-- vAuto (Cox Automotive) integration scaffolding
-- Adds dealer-level credentials, audit trail, and per-submission sync status.
-- Built as a skeleton — safe to run now with no real Cox API credentials,
-- ready to be wired to the Cox Automotive API when credentials are available.

-- ── dealer_accounts: vAuto integration fields ──────────────────────────
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS vauto_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vauto_api_key text,
  ADD COLUMN IF NOT EXISTS vauto_dealer_id text,
  ADD COLUMN IF NOT EXISTS vauto_auto_push boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vauto_api_environment text DEFAULT 'sandbox';

-- ── vauto_push_log: audit trail of every push attempt ─────────────────
CREATE TABLE IF NOT EXISTS public.vauto_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id uuid,
  pushed_at timestamptz NOT NULL DEFAULT now(),
  pushed_by text,
  push_status text NOT NULL DEFAULT 'pending', -- pending, success, failed
  vauto_vehicle_id text, -- ID returned by vAuto on success
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  retry_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vauto_push_log_submission ON public.vauto_push_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_vauto_push_log_status ON public.vauto_push_log(push_status);

-- ── submissions: per-record sync status ───────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS vauto_pushed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vauto_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS vauto_vehicle_id text;

-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.vauto_push_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view push logs" ON public.vauto_push_log;
CREATE POLICY "Staff can view push logs"
  ON public.vauto_push_log
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can insert push logs" ON public.vauto_push_log;
CREATE POLICY "Staff can insert push logs"
  ON public.vauto_push_log
  FOR INSERT
  WITH CHECK (true);
