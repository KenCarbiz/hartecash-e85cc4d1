
-- Follow-up tracking table
CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  touch_number integer NOT NULL CHECK (touch_number BETWEEN 1 AND 3),
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  triggered_by text DEFAULT 'auto' CHECK (triggered_by IN ('auto', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, touch_number, channel)
);

-- RLS
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read follow-ups"
  ON public.follow_ups FOR SELECT
  TO public
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff can insert follow-ups"
  ON public.follow_ups FOR INSERT
  TO public
  WITH CHECK (is_staff(auth.uid()));

-- Also allow service role / edge functions to insert (no auth context)
CREATE POLICY "Service role can insert follow-ups"
  ON public.follow_ups FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role can read follow-ups"
  ON public.follow_ups FOR SELECT
  TO anon
  USING (true);

-- Index for cron lookups
CREATE INDEX idx_follow_ups_submission ON public.follow_ups(submission_id, touch_number);
