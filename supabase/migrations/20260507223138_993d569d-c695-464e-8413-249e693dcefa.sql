CREATE TABLE IF NOT EXISTS public.voice_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  script_template text NOT NULL,
  target_criteria jsonb NOT NULL DEFAULT '{}',
  voice_provider text NOT NULL DEFAULT 'bland',
  voice_id text DEFAULT 'nat',
  max_calls_per_day int DEFAULT 50,
  calling_hours_start text DEFAULT '09:00',
  calling_hours_end text DEFAULT '18:00',
  max_call_duration int DEFAULT 5,
  transfer_phone text,
  retry_attempts int DEFAULT 2,
  retry_delay_hours int DEFAULT 24,
  total_calls_made int DEFAULT 0,
  total_connected int DEFAULT 0,
  total_converted int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.voice_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.voice_campaigns(id) ON DELETE SET NULL,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id uuid,
  provider_call_id text,
  phone_number text NOT NULL,
  customer_name text,
  vehicle_info text,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds numeric,
  status text NOT NULL DEFAULT 'queued',
  outcome text,
  transcript text,
  summary text,
  recording_url text,
  answered_by text,
  original_offer numeric,
  bump_offered numeric,
  attempt_number int DEFAULT 1,
  retry_scheduled_at timestamptz,
  consent_verified boolean DEFAULT false,
  opt_out_requested boolean DEFAULT false,
  tcpa_disclosure_given boolean DEFAULT false,
  provider_response jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_call_log_submission ON public.voice_call_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_log_campaign ON public.voice_call_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_log_status ON public.voice_call_log(status);
CREATE INDEX IF NOT EXISTS idx_voice_call_log_scheduled ON public.voice_call_log(scheduled_at) WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS public.voice_script_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid,
  name text NOT NULL,
  description text,
  script_template text NOT NULL,
  category text DEFAULT 'follow_up',
  is_default boolean DEFAULT false,
  variables jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS voice_ai_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_ai_provider text DEFAULT 'bland',
  ADD COLUMN IF NOT EXISTS voice_ai_api_key text,
  ADD COLUMN IF NOT EXISTS voice_ai_from_number text,
  ADD COLUMN IF NOT EXISTS voice_ai_transfer_number text,
  ADD COLUMN IF NOT EXISTS voice_ai_max_bump_amount numeric DEFAULT 500;

ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_script_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view campaigns" ON public.voice_campaigns;
CREATE POLICY "Staff can view campaigns" ON public.voice_campaigns FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admin can manage campaigns" ON public.voice_campaigns;
CREATE POLICY "Admin can manage campaigns" ON public.voice_campaigns FOR ALL USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Staff can view call log" ON public.voice_call_log;
CREATE POLICY "Staff can view call log" ON public.voice_call_log FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Service can insert calls" ON public.voice_call_log;
CREATE POLICY "Service can insert calls" ON public.voice_call_log FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service can update calls" ON public.voice_call_log;
CREATE POLICY "Service can update calls" ON public.voice_call_log FOR UPDATE TO service_role USING (true);
DROP POLICY IF EXISTS "Anyone can read templates" ON public.voice_script_templates;
CREATE POLICY "Anyone can read templates" ON public.voice_script_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can manage templates" ON public.voice_script_templates;
CREATE POLICY "Admin can manage templates" ON public.voice_script_templates FOR ALL USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

NOTIFY pgrst, 'reload schema';