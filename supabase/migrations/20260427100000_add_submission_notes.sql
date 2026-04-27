-- Submission notes
-- Per-customer-file timeline of internal notes added by staff. Distinct from
-- activity_log (which captures audit-style status/value changes) so the
-- customer file slide-out can render a clean notes feed and avoid mixing
-- concerns. RLS mirrors activity_log: any authenticated staff member can
-- read and insert; only the original author (or an admin) can delete.

CREATE TABLE IF NOT EXISTS public.submission_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submission_notes_submission_id_created_at_idx
  ON public.submission_notes (submission_id, created_at DESC);

ALTER TABLE public.submission_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read submission notes"
ON public.submission_notes
FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can insert submission notes"
ON public.submission_notes
FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can delete their own submission notes"
ON public.submission_notes
FOR DELETE
USING (is_staff(auth.uid()));
