
CREATE TABLE public.damage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  photo_category text NOT NULL,
  photo_path text NOT NULL,
  ai_model text NOT NULL DEFAULT 'gemini',
  damage_detected boolean NOT NULL DEFAULT false,
  damage_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_severity text NOT NULL DEFAULT 'none',
  confidence_score numeric NOT NULL DEFAULT 0,
  suggested_condition text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view damage reports"
  ON public.damage_reports FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Service role can insert damage reports"
  ON public.damage_reports FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_damage_reports_submission ON public.damage_reports(submission_id);

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS ai_condition_score text,
  ADD COLUMN IF NOT EXISTS ai_damage_summary text;
