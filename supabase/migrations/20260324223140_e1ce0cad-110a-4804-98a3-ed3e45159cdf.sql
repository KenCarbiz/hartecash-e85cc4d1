
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  trigger_key text NOT NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  dealership_id text NOT NULL DEFAULT 'default'
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read notification logs"
  ON public.notification_log FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Service role can insert notification logs"
  ON public.notification_log FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX idx_notification_log_created ON public.notification_log (created_at DESC);
CREATE INDEX idx_notification_log_trigger ON public.notification_log (trigger_key);
