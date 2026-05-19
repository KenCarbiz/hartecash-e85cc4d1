CREATE TABLE IF NOT EXISTS public.photo_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  submission_token TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'submission-photos',
  storage_path TEXT NOT NULL,
  photo_category TEXT,
  has_exif BOOLEAN NOT NULL DEFAULT false,
  has_gps BOOLEAN NOT NULL DEFAULT false,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  taken_at TIMESTAMPTZ,
  camera_make TEXT,
  camera_model TEXT,
  software TEXT,
  distance_miles DOUBLE PRECISION,
  expected_lat DOUBLE PRECISION,
  expected_lng DOUBLE PRECISION,
  expected_source TEXT,
  freshness_hours DOUBLE PRECISION,
  trust_tier TEXT NOT NULL DEFAULT 'unverified',
  trust_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT photo_metadata_trust_tier_check CHECK (trust_tier IN ('verified','likely','unverified','suspicious')),
  CONSTRAINT photo_metadata_path_unique UNIQUE (submission_id, storage_path)
);

CREATE INDEX IF NOT EXISTS photo_metadata_submission_idx ON public.photo_metadata (submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photo_metadata_trust_idx ON public.photo_metadata (trust_tier);

ALTER TABLE public.photo_metadata ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='photo_metadata' AND policyname='photo_metadata_select_all') THEN
    CREATE POLICY photo_metadata_select_all ON public.photo_metadata FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='photo_metadata' AND policyname='photo_metadata_insert_all') THEN
    CREATE POLICY photo_metadata_insert_all ON public.photo_metadata FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='photo_metadata' AND policyname='photo_metadata_update_all') THEN
    CREATE POLICY photo_metadata_update_all ON public.photo_metadata FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_photo_metadata_updated_at ON public.photo_metadata;
CREATE TRIGGER trg_photo_metadata_updated_at
BEFORE UPDATE ON public.photo_metadata
FOR EACH ROW EXECUTE FUNCTION public.touch_ocr_jobs_updated_at();

ALTER TABLE public.photo_metadata REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='photo_metadata'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_metadata';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';