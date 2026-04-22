
CREATE TABLE public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  customer_name text,
  customer_phone text,
  customer_email text,
  consent_type text NOT NULL DEFAULT 'sms_calls_email',
  consent_text text NOT NULL,
  form_source text NOT NULL,
  ip_address text,
  submission_token text,
  user_agent text
);

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous form submissions)
CREATE POLICY "Anyone can create consent records"
  ON public.consent_log FOR INSERT
  WITH CHECK (true);

-- Only staff can read
CREATE POLICY "Staff can read consent logs"
  ON public.consent_log FOR SELECT
  USING (is_staff(auth.uid()));

-- Deny anonymous reads
CREATE POLICY "Deny anonymous access to consent_log"
  ON public.consent_log FOR SELECT
  USING (false);
