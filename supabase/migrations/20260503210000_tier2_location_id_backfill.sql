-- Tier 2.7 — Backfill `store_location_id` on every lead-adjacent table
-- that today has only `dealership_id` scoping.
--
-- Audit finding: a multi-store dealer can't answer "how many SMS / calls
-- went out from the Wallingford store this month" because appointments,
-- follow_ups, consent_log, notification_log, voice_call_log,
-- damage_reports, and voice_campaigns either have no location column
-- or have it as free-form text (appointments.store_location). This
-- migration adds proper `store_location_id uuid REFERENCES
-- dealership_locations(id)` on each, sets up indexes, and best-effort
-- backfills appointments by parsing the legacy text column.
--
-- Strategy:
--   - All new columns are nullable (NULL = "not yet attributed to a
--     specific store" — same semantics submissions.store_location_id
--     uses for legacy rows).
--   - ON DELETE SET NULL so deleting a location doesn't cascade and
--     lose lead history.
--   - Indexes on (dealership_id, store_location_id) for the per-store
--     reporting query path.
--   - appointments.store_location (text) is preserved as a legacy
--     fallback during the cutover; a follow-up migration drops it
--     once UI writes have moved to the new column.
--
-- IDEMPOTENT — uses ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT
-- EXISTS / NOT EXISTS guards on backfills.

-- ── 1. appointments ─────────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS store_location_id uuid
    REFERENCES public.dealership_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_dealership_location_idx
  ON public.appointments (dealership_id, store_location_id);

COMMENT ON COLUMN public.appointments.store_location_id IS
  'Replaces the legacy free-text store_location column. NULL for rows that pre-date the multi-store split or for single-rooftop dealers.';

-- Best-effort backfill from the legacy text column. Matches by exact
-- name (case-insensitive) within the same dealership. Anything that
-- doesn't match exactly stays NULL — UI will resolve later.
UPDATE public.appointments a
   SET store_location_id = l.id
  FROM public.dealership_locations l
 WHERE a.store_location_id IS NULL
   AND a.store_location IS NOT NULL
   AND a.store_location <> ''
   AND l.dealership_id = a.dealership_id
   AND lower(l.name) = lower(a.store_location);

-- ── 2. follow_ups ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='follow_ups') THEN
    EXECUTE 'ALTER TABLE public.follow_ups
              ADD COLUMN IF NOT EXISTS store_location_id uuid
                REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS follow_ups_dealership_location_idx
               ON public.follow_ups (dealership_id, store_location_id)';
    EXECUTE $cmt$ COMMENT ON COLUMN public.follow_ups.store_location_id IS
      'Per-store attribution for follow-up tasks. NULL for legacy rows.' $cmt$;
    -- Backfill from the parent submission, which already carries the FK.
    EXECUTE 'UPDATE public.follow_ups f
                SET store_location_id = s.store_location_id
               FROM public.submissions s
              WHERE f.store_location_id IS NULL
                AND f.submission_id IS NOT NULL
                AND f.submission_id = s.id
                AND s.store_location_id IS NOT NULL';
  END IF;
END $$;

-- ── 3. consent_log ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='consent_log') THEN
    EXECUTE 'ALTER TABLE public.consent_log
              ADD COLUMN IF NOT EXISTS store_location_id uuid
                REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS consent_log_dealership_location_idx
               ON public.consent_log (dealership_id, store_location_id)';
    EXECUTE $cmt$ COMMENT ON COLUMN public.consent_log.store_location_id IS
      'Which store collected this consent. Required for per-rooftop TCPA audit reports.' $cmt$;
    -- Backfill from the parent submission when present.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='consent_log' AND column_name='submission_id') THEN
      EXECUTE 'UPDATE public.consent_log c
                  SET store_location_id = s.store_location_id
                 FROM public.submissions s
                WHERE c.store_location_id IS NULL
                  AND c.submission_id = s.id
                  AND s.store_location_id IS NOT NULL';
    END IF;
  END IF;
END $$;

-- ── 4. notification_log ─────────────────────────────────────────────────
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS store_location_id uuid
    REFERENCES public.dealership_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notification_log_dealership_location_idx
  ON public.notification_log (dealership_id, store_location_id);

COMMENT ON COLUMN public.notification_log.store_location_id IS
  'Which store originated the notification. Required for per-rooftop send-volume reports.';

-- Backfill notification_log from the parent submission when the
-- log row carries a submission_id link.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification_log' AND column_name='submission_id') THEN
    EXECUTE 'UPDATE public.notification_log n
                SET store_location_id = s.store_location_id
               FROM public.submissions s
              WHERE n.store_location_id IS NULL
                AND n.submission_id = s.id
                AND s.store_location_id IS NOT NULL';
  END IF;
END $$;

-- ── 5. voice_call_log ───────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='voice_call_log') THEN
    EXECUTE 'ALTER TABLE public.voice_call_log
              ADD COLUMN IF NOT EXISTS store_location_id uuid
                REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS voice_call_log_dealership_location_idx
               ON public.voice_call_log (dealership_id, store_location_id)';
    EXECUTE $cmt$ COMMENT ON COLUMN public.voice_call_log.store_location_id IS
      'Which store originated/received the call. Required for per-rooftop voice analytics.' $cmt$;
  END IF;
END $$;

-- ── 6. damage_reports ───────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='damage_reports') THEN
    EXECUTE 'ALTER TABLE public.damage_reports
              ADD COLUMN IF NOT EXISTS store_location_id uuid
                REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS damage_reports_dealership_location_idx
               ON public.damage_reports (dealership_id, store_location_id)';
    EXECUTE $cmt$ COMMENT ON COLUMN public.damage_reports.store_location_id IS
      'Which store inspected the vehicle. Required for per-rooftop appraisal reports.' $cmt$;
    -- Backfill from the parent submission when linked.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='damage_reports' AND column_name='submission_id') THEN
      EXECUTE 'UPDATE public.damage_reports d
                  SET store_location_id = s.store_location_id
                 FROM public.submissions s
                WHERE d.store_location_id IS NULL
                  AND d.submission_id = s.id
                  AND s.store_location_id IS NOT NULL';
    END IF;
  END IF;
END $$;

-- ── 7. voice_campaigns ──────────────────────────────────────────────────
-- Voice campaigns are scoped per-rooftop too — a campaign at the
-- Hartford store shouldn't dial Wallingford leads.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='voice_campaigns') THEN
    EXECUTE 'ALTER TABLE public.voice_campaigns
              ADD COLUMN IF NOT EXISTS store_location_id uuid
                REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS voice_campaigns_dealership_location_idx
               ON public.voice_campaigns (dealership_id, store_location_id)';
    EXECUTE $cmt$ COMMENT ON COLUMN public.voice_campaigns.store_location_id IS
      'Which store this campaign is scoped to. NULL = corporate-wide / all stores.' $cmt$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
