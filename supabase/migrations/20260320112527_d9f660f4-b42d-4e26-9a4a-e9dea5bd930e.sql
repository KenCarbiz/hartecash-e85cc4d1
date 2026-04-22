
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  
  -- Recipients
  email_recipients text[] NOT NULL DEFAULT '{}',
  sms_recipients text[] NOT NULL DEFAULT '{}',
  
  -- Trigger toggles
  notify_new_submission boolean NOT NULL DEFAULT true,
  notify_hot_lead boolean NOT NULL DEFAULT true,
  notify_appointment_booked boolean NOT NULL DEFAULT true,
  notify_photos_uploaded boolean NOT NULL DEFAULT false,
  notify_docs_uploaded boolean NOT NULL DEFAULT false,
  notify_status_change boolean NOT NULL DEFAULT false,
  
  -- Channel preferences per trigger
  new_submission_channels text[] NOT NULL DEFAULT '{email,sms}',
  hot_lead_channels text[] NOT NULL DEFAULT '{email,sms}',
  appointment_channels text[] NOT NULL DEFAULT '{email,sms}',
  photos_uploaded_channels text[] NOT NULL DEFAULT '{email}',
  docs_uploaded_channels text[] NOT NULL DEFAULT '{email}',
  status_change_channels text[] NOT NULL DEFAULT '{email}',
  
  -- Quiet hours
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start text NOT NULL DEFAULT '21:00',
  quiet_hours_end text NOT NULL DEFAULT '08:00',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(dealership_id)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notification settings"
  ON public.notification_settings FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can manage notification settings"
  ON public.notification_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
