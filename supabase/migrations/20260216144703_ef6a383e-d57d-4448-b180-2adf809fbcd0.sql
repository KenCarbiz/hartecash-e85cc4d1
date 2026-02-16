
-- Create activity_log table for audit trail
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  performed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Staff can read activity logs
CREATE POLICY "Staff can read activity logs"
ON public.activity_log
FOR SELECT
USING (is_staff(auth.uid()));

-- Staff can insert activity logs
CREATE POLICY "Staff can insert activity logs"
ON public.activity_log
FOR INSERT
WITH CHECK (is_staff(auth.uid()));

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to activity_log"
ON public.activity_log
FOR SELECT
USING (false);

-- Index for fast lookups by submission
CREATE INDEX idx_activity_log_submission ON public.activity_log(submission_id, created_at DESC);
