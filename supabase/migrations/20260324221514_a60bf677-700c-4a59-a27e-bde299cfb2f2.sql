
-- Notification message templates (custom overrides only; defaults live in code)
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key text NOT NULL,
  channel text NOT NULL,
  subject text,
  body text NOT NULL,
  dealership_id text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trigger_key, channel, dealership_id)
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Staff can read
CREATE POLICY "Staff can read notification templates"
  ON public.notification_templates FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Admins can manage
CREATE POLICY "Admins can manage notification templates"
  ON public.notification_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
