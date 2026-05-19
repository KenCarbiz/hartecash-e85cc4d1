-- Create ocr_jobs table to track live status of AI OCR runs per uploaded document.
-- One row per (submission_id, doc_id, storage_path) attempt. Realtime-enabled so
-- the upload UI can flip queued -> running -> completed/failed without polling.

CREATE TABLE IF NOT EXISTS public.ocr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  submission_token TEXT,
  dealership_id TEXT,
  doc_id TEXT NOT NULL,
  pipeline TEXT NOT NULL,
  storage_bucket TEXT,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ocr_jobs_status_check CHECK (status IN ('queued','running','completed','failed'))
);

CREATE INDEX IF NOT EXISTS ocr_jobs_submission_idx ON public.ocr_jobs (submission_id, doc_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ocr_jobs_token_idx ON public.ocr_jobs (submission_token, created_at DESC);

ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY;

-- Operational metadata, accessed by unauthenticated customer portal via submission token.
-- Permissive policies keyed on table presence (no PII stored beyond status text).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ocr_jobs' AND policyname='ocr_jobs_select_all') THEN
    CREATE POLICY ocr_jobs_select_all ON public.ocr_jobs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ocr_jobs' AND policyname='ocr_jobs_insert_all') THEN
    CREATE POLICY ocr_jobs_insert_all ON public.ocr_jobs FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ocr_jobs' AND policyname='ocr_jobs_update_all') THEN
    CREATE POLICY ocr_jobs_update_all ON public.ocr_jobs FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_ocr_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ocr_jobs_updated_at ON public.ocr_jobs;
CREATE TRIGGER trg_ocr_jobs_updated_at
BEFORE UPDATE ON public.ocr_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_ocr_jobs_updated_at();

ALTER TABLE public.ocr_jobs REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ocr_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ocr_jobs';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';