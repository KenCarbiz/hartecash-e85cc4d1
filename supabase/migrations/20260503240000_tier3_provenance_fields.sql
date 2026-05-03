-- Tier 3 — Provenance fields + free data egress.
--
-- The May-2026 industry benchmark identified data-access tying as the
-- single loudest dealer complaint about CDK/Reynolds:
--
--   "Being charged by your DMS to let third parties read your own
--    data. Cox v CDK and Authenticom litigation are the textbook cases."
--
-- Autocurb's brand position: "we will give you your data back, in
-- CSV, in 24 hours, free, in your contract." This migration is the
-- data-layer half of that promise.
--
-- 1. Add provenance fields (imported_from_dms, imported_at, legacy_id)
--    to every record-bearing table that could ever absorb migrated
--    customer history. So when Autocurb wins a 30-rooftop group off
--    CDK, every imported row carries lineage and the dealer's reverse
--    export is a clean, auditable CSV.
--
-- 2. Add data_egress_log table — every CSV export is logged so the
--    dealer can prove (to an OEM, lawyer, or buyer) what they pulled
--    and when. Free, contractual, no per-call fee. The
--    edge function `data-egress-export` is the single entry point.
--
-- 3. RLS: dealer's own data is theirs. Platform admins can read
--    egress logs across tenants. Group admins can read egress logs
--    for any rooftop in their group.
--
-- IDEMPOTENT — IF NOT EXISTS guards on every column add.

-- ── 1. Provenance columns on record-bearing tables ──────────────────────
-- Pattern: imported_from_dms (text — "cdk", "reynolds", "tekion",
-- "dealersocket", "manual"), imported_at (timestamptz), legacy_id
-- (text — the DMS's own row id for cross-reference).

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'submissions',
      'appointments',
      'follow_ups',
      'consent_log',
      'damage_reports',
      'voice_call_log',
      'notification_log'
    ])
  LOOP
    -- Only add if the table exists in this DB. follow_ups, consent_log
    -- etc. are introduced in different migrations and a multi-pass
    -- environment may be missing some.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('
        ALTER TABLE public.%I
          ADD COLUMN IF NOT EXISTS imported_from_dms text,
          ADD COLUMN IF NOT EXISTS imported_at timestamptz,
          ADD COLUMN IF NOT EXISTS legacy_id text;
      ', t);

      EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I
          ON public.%I (imported_from_dms, imported_at)
          WHERE imported_from_dms IS NOT NULL;
      ', t || '_provenance_idx', t);

      EXECUTE format($cmt$
        COMMENT ON COLUMN public.%I.imported_from_dms IS
          'When this row was imported from a previous DMS, the DMS slug ("cdk", "reynolds", "tekion", "dealersocket", "manual"). NULL = native to Autocurb.';
      $cmt$, t);
      EXECUTE format($cmt$
        COMMENT ON COLUMN public.%I.legacy_id IS
          'The previous DMS''s own primary key for this record. Lets a reverse-export CSV carry the lineage so a dealer can prove what came from where.';
      $cmt$, t);
    END IF;
  END LOOP;
END $$;

-- ── 2. data_egress_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.data_egress_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who exported what.
  dealership_id text NOT NULL,
  exported_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  exported_by_email text,
  -- What was exported. table_names is an array because a "Full Data
  -- Export" can produce a zip of CSVs across many tables; one log row
  -- covers the whole export.
  export_kind text NOT NULL DEFAULT 'csv'
    CHECK (export_kind IN ('csv', 'json', 'archive', 'api')),
  table_names text[] NOT NULL DEFAULT '{}',
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Filter context — date range, location filter, etc. Free-form so
  -- new export types don't need schema changes.
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The signed URL handed back to the dealer (24-hour expiry on the
  -- bucket). Stored so the same export can be re-downloaded within
  -- the window without re-running the underlying queries.
  download_url text,
  expires_at timestamptz,
  -- File metadata for audit.
  file_bytes bigint,
  file_path text,
  -- Outcome.
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'failed', 'expired')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_egress_log_dealership_idx
  ON public.data_egress_log (dealership_id, created_at DESC);

CREATE INDEX IF NOT EXISTS data_egress_log_status_idx
  ON public.data_egress_log (status)
  WHERE status IN ('pending', 'ready');

COMMENT ON TABLE public.data_egress_log IS
  'Audit trail of every CSV / JSON / archive export by a dealer. Free, contractual, unlimited — the data is theirs. Group admins can read any rooftop''s exports under their group; platform admins can read everything.';

CREATE OR REPLACE FUNCTION public.data_egress_log_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS data_egress_log_set_updated_at ON public.data_egress_log;
CREATE TRIGGER data_egress_log_set_updated_at
  BEFORE UPDATE ON public.data_egress_log
  FOR EACH ROW
  EXECUTE FUNCTION public.data_egress_log_set_updated_at();

-- ── 3. RLS on data_egress_log ───────────────────────────────────────────
ALTER TABLE public.data_egress_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin can read all egress logs" ON public.data_egress_log;
CREATE POLICY "Platform admin can read all egress logs"
  ON public.data_egress_log FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admin can read group egress logs" ON public.data_egress_log;
CREATE POLICY "Group admin can read group egress logs"
  ON public.data_egress_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.dealer_accounts da
       WHERE da.dealership_id = data_egress_log.dealership_id
         AND da.dealer_group_id IS NOT NULL
         AND public.is_dealer_group_admin(auth.uid(), da.dealer_group_id)
    )
  );

DROP POLICY IF EXISTS "Dealer admin can read own egress logs" ON public.data_egress_log;
CREATE POLICY "Dealer admin can read own egress logs"
  ON public.data_egress_log FOR SELECT
  TO authenticated
  USING (
    dealership_id = public.get_user_dealership_id(auth.uid())
  );

-- INSERTs come from the service-role edge function (data-egress-export),
-- which bypasses RLS. No INSERT policy needed for authenticated users.

NOTIFY pgrst, 'reload schema';
