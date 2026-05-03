-- =========================================================
-- MIGRATION 1: 20260420280000_conversation_events.sql
-- =========================================================
CREATE TABLE IF NOT EXISTS public.conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id text NOT NULL DEFAULT 'default',
  channel text NOT NULL
    CHECK (channel IN ('sms', 'email', 'voice', 'note', 'system', 'portal', 'status_change')),
  direction text NOT NULL DEFAULT 'internal'
    CHECK (direction IN ('inbound', 'outbound', 'internal')),
  actor_type text NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('customer', 'staff', 'system', 'ai')),
  actor_id uuid,
  actor_label text,
  body_text text,
  body_html text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_table text,
  source_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_events_submission_occurred_idx
  ON public.conversation_events (submission_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS conversation_events_dealership_idx
  ON public.conversation_events (dealership_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS conversation_events_source_idx
  ON public.conversation_events (source_table, source_id) WHERE source_table IS NOT NULL;

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff read own-dealership conversation events"
  ON public.conversation_events FOR SELECT TO authenticated
  USING (dealership_id = public.get_user_dealership_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff insert own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff insert own-dealership conversation events"
  ON public.conversation_events FOR INSERT TO authenticated
  WITH CHECK (dealership_id = public.get_user_dealership_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role full conversation events" ON public.conversation_events;
CREATE POLICY "Service role full conversation events"
  ON public.conversation_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =========================================================
-- MIGRATION 2: 20260429120000_channel_settings.sql
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tenant_channels (
  dealership_id text NOT NULL DEFAULT 'default',
  channel text NOT NULL CHECK (channel IN ('two_way_sms','two_way_email','ai_phone_calls','click_to_dial')),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (dealership_id, channel)
);

CREATE TABLE IF NOT EXISTS public.location_channels (
  location_id uuid NOT NULL REFERENCES public.dealership_locations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('two_way_sms','two_way_email','ai_phone_calls','click_to_dial')),
  enabled boolean,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (location_id, channel)
);

CREATE INDEX IF NOT EXISTS location_channels_location_idx ON public.location_channels (location_id);

ALTER TABLE public.tenant_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own-tenant channels" ON public.tenant_channels;
CREATE POLICY "Staff read own-tenant channels" ON public.tenant_channels FOR SELECT TO authenticated
  USING (dealership_id = public.get_user_dealership_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin manage own-tenant channels" ON public.tenant_channels;
CREATE POLICY "Admin manage own-tenant channels" ON public.tenant_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND (dealership_id = public.get_user_dealership_id(auth.uid()) OR public.get_user_dealership_id(auth.uid()) = 'default'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND (dealership_id = public.get_user_dealership_id(auth.uid()) OR public.get_user_dealership_id(auth.uid()) = 'default'));

DROP POLICY IF EXISTS "Service role full tenant channels" ON public.tenant_channels;
CREATE POLICY "Service role full tenant channels" ON public.tenant_channels FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read own-tenant location channels" ON public.location_channels;
CREATE POLICY "Staff read own-tenant location channels" ON public.location_channels FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dealership_locations dl WHERE dl.id = location_channels.location_id AND (dl.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))));

DROP POLICY IF EXISTS "Admin manage own-tenant location channels" ON public.location_channels;
CREATE POLICY "Admin manage own-tenant location channels" ON public.location_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.dealership_locations dl WHERE dl.id = location_channels.location_id AND (dl.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.get_user_dealership_id(auth.uid()) = 'default')))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.dealership_locations dl WHERE dl.id = location_channels.location_id AND (dl.dealership_id = public.get_user_dealership_id(auth.uid()) OR public.get_user_dealership_id(auth.uid()) = 'default')));

DROP POLICY IF EXISTS "Service role full location channels" ON public.location_channels;
CREATE POLICY "Service role full location channels" ON public.location_channels FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.channel_enabled(_dealership_id text, _location_id uuid, _channel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.location_channels WHERE location_id = _location_id AND channel = _channel LIMIT 1),
    (SELECT enabled FROM public.tenant_channels WHERE dealership_id = _dealership_id AND channel = _channel LIMIT 1),
    true);
$$;

INSERT INTO public.tenant_channels (dealership_id, channel, enabled)
SELECT DISTINCT t.dealership_id, c.channel, true
FROM (SELECT dealership_id FROM public.tenants UNION SELECT dealership_id FROM public.dealer_accounts) t
CROSS JOIN (VALUES ('two_way_sms'),('two_way_email'),('ai_phone_calls'),('click_to_dial')) AS c(channel)
WHERE t.dealership_id IS NOT NULL
ON CONFLICT (dealership_id, channel) DO NOTHING;

-- =========================================================
-- MIGRATION 3: 20260501000000_auto_firm_offer_pct.sql
-- =========================================================
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS auto_firm_offer_pct numeric DEFAULT NULL;
ALTER TABLE public.offer_settings DROP CONSTRAINT IF EXISTS offer_settings_auto_firm_offer_pct_bounds;
ALTER TABLE public.offer_settings ADD CONSTRAINT offer_settings_auto_firm_offer_pct_bounds
  CHECK (auto_firm_offer_pct IS NULL OR (auto_firm_offer_pct >= 0.5 AND auto_firm_offer_pct <= 1.0));

-- =========================================================
-- MIGRATION 4: 20260501020000_tire_brake_split_and_overrides.sql
-- =========================================================
ALTER TABLE public.inspection_config
  ADD COLUMN IF NOT EXISTS tire_input_mode text NOT NULL DEFAULT 'measurement',
  ADD COLUMN IF NOT EXISTS brake_input_mode text NOT NULL DEFAULT 'measurement';

ALTER TABLE public.inspection_config DROP CONSTRAINT IF EXISTS inspection_config_tire_input_mode_check;
ALTER TABLE public.inspection_config ADD CONSTRAINT inspection_config_tire_input_mode_check
  CHECK (tire_input_mode IN ('measurement','pass_fail'));
ALTER TABLE public.inspection_config DROP CONSTRAINT IF EXISTS inspection_config_brake_input_mode_check;
ALTER TABLE public.inspection_config ADD CONSTRAINT inspection_config_brake_input_mode_check
  CHECK (brake_input_mode IN ('measurement','pass_fail'));

CREATE TABLE IF NOT EXISTS public.inspection_config_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  location_id uuid NOT NULL REFERENCES public.dealership_locations(id) ON DELETE CASCADE,
  tire_input_mode text,
  brake_input_mode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inspection_config_overrides_unique UNIQUE (dealership_id, location_id),
  CONSTRAINT inspection_config_overrides_tire_check CHECK (tire_input_mode IS NULL OR tire_input_mode IN ('measurement','pass_fail')),
  CONSTRAINT inspection_config_overrides_brake_check CHECK (brake_input_mode IS NULL OR brake_input_mode IN ('measurement','pass_fail'))
);
ALTER TABLE public.inspection_config_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can read inspection_config_overrides" ON public.inspection_config_overrides;
CREATE POLICY "Tenant admins can read inspection_config_overrides" ON public.inspection_config_overrides FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND (public.get_user_dealership_id(auth.uid()) = 'default' OR dealership_id = public.get_user_dealership_id(auth.uid())));

DROP POLICY IF EXISTS "Tenant admins can write inspection_config_overrides" ON public.inspection_config_overrides;
CREATE POLICY "Tenant admins can write inspection_config_overrides" ON public.inspection_config_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND (public.get_user_dealership_id(auth.uid()) = 'default' OR dealership_id = public.get_user_dealership_id(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND (public.get_user_dealership_id(auth.uid()) = 'default' OR dealership_id = public.get_user_dealership_id(auth.uid())));

CREATE OR REPLACE FUNCTION public.effective_inspection_input_modes(_dealership_id text, _location_id uuid)
RETURNS TABLE (tire_mode text, brake_mode text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(o.tire_input_mode, c.tire_input_mode, 'measurement'),
         COALESCE(o.brake_input_mode, c.brake_input_mode, 'measurement')
  FROM public.inspection_config c
  LEFT JOIN public.inspection_config_overrides o ON o.dealership_id = c.dealership_id AND o.location_id = _location_id
  WHERE c.dealership_id = _dealership_id LIMIT 1;
$$;

-- =========================================================
-- MIGRATION 5: 20260501030000_voice_ai_provider.sql
-- =========================================================
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS voice_ai_provider text NOT NULL DEFAULT 'bland';
ALTER TABLE public.dealer_accounts DROP CONSTRAINT IF EXISTS dealer_accounts_voice_ai_provider_check;
ALTER TABLE public.dealer_accounts ADD CONSTRAINT dealer_accounts_voice_ai_provider_check CHECK (voice_ai_provider IN ('bland','openai'));

-- =========================================================
-- MIGRATION 6: 20260502020000_cadence_decline_reason.sql
-- =========================================================
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS decline_reason_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason_source text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'submissions' AND constraint_name = 'submissions_decline_reason_chk') THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_decline_reason_chk
      CHECK (decline_reason IS NULL OR decline_reason IN ('price_too_low','shopping_around','not_ready','sold_elsewhere','other'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_submissions_decline_reason ON public.submissions (decline_reason) WHERE decline_reason IS NOT NULL;

-- =========================================================
-- MIGRATION 7: 20260502030000_cadence_engine.sql
-- =========================================================
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS cadence_state text,
  ADD COLUMN IF NOT EXISTS cadence_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cadence_last_touch_at timestamptz,
  ADD COLUMN IF NOT EXISTS cadence_next_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS cadence_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS cadence_started_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'submissions' AND constraint_name = 'submissions_cadence_state_chk') THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_cadence_state_chk
      CHECK (cadence_state IS NULL OR cadence_state IN ('declined','stall','reengage','completed','paused','expired'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_submissions_cadence_due ON public.submissions (cadence_next_due_at)
  WHERE cadence_state IS NOT NULL AND cadence_state NOT IN ('completed','paused','expired') AND cadence_paused_until IS NULL;

CREATE TABLE IF NOT EXISTS public.cadence_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  cadence_state text NOT NULL,
  step integer NOT NULL,
  channel text NOT NULL,
  trigger_key text,
  outcome text NOT NULL DEFAULT 'fired',
  outcome_detail text,
  fired_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cadence_log_submission ON public.cadence_log (submission_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadence_log_state_step ON public.cadence_log (submission_id, cadence_state, step);
ALTER TABLE public.cadence_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read cadence log" ON public.cadence_log;
CREATE POLICY "Staff can read cadence log" ON public.cadence_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Service role full access to cadence log" ON public.cadence_log;
CREATE POLICY "Service role full access to cadence log" ON public.cadence_log FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS cadence_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cadence_authorized_bump_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS cadence_reengage_max_days integer NOT NULL DEFAULT 90;

-- =========================================================
-- MIGRATION 8: 20260502060000_sms_slot_proposals.sql
-- =========================================================
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS pending_slot_proposals jsonb;
CREATE INDEX IF NOT EXISTS idx_submissions_pending_slots ON public.submissions ((pending_slot_proposals IS NOT NULL))
  WHERE pending_slot_proposals IS NOT NULL;

-- =========================================================
-- MIGRATION 9: 20260502070000_tcpa_consent_per_tenant.sql
-- =========================================================
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS tcpa_disclosure text NOT NULL DEFAULT
    'By submitting this form, I consent to receive automated and prerecorded calls, texts, and emails from this dealership and its agents about my vehicle inquiry, including via autodialer, even if my number is on a Do Not Call list. Consent is not a condition of any purchase. Standard message and data rates may apply. Reply STOP to opt out at any time.',
  ADD COLUMN IF NOT EXISTS tcpa_disclosure_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS tcpa_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS tcpa_consent_version integer,
  ADD COLUMN IF NOT EXISTS tcpa_consent_text text,
  ADD COLUMN IF NOT EXISTS tcpa_consent_ip text;

-- =========================================================
-- MIGRATION 10: 20260502080000_bdc_call_tasks.sql
-- =========================================================
CREATE TABLE IF NOT EXISTS public.bdc_call_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  cadence_state text NOT NULL,
  cadence_step integer NOT NULL DEFAULT 0,
  intent text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','expired','cancelled')),
  priority integer NOT NULL DEFAULT 5,
  due_at timestamptz NOT NULL DEFAULT now(),
  rep_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_email text,
  assigned_role text,
  outcome text,
  outcome_notes text,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bdc_call_tasks_status_due ON public.bdc_call_tasks (status, priority, due_at);
CREATE INDEX IF NOT EXISTS idx_bdc_call_tasks_submission ON public.bdc_call_tasks (submission_id);
ALTER TABLE public.bdc_call_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read bdc tasks" ON public.bdc_call_tasks;
CREATE POLICY "Staff read bdc tasks" ON public.bdc_call_tasks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff update bdc tasks" ON public.bdc_call_tasks;
CREATE POLICY "Staff update bdc tasks" ON public.bdc_call_tasks FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Service role full bdc tasks" ON public.bdc_call_tasks;
CREATE POLICY "Service role full bdc tasks" ON public.bdc_call_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';