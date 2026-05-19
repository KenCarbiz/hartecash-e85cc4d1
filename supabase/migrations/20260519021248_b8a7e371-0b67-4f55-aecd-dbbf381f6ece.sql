-- Apply 11 missing backfill migrations in timestamp order
-- 20260410120000_vehicle_scans.sql
CREATE TABLE IF NOT EXISTS public.vehicle_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by text,
  scanner_device text,
  vin_from_obd text,
  odometer_km numeric,
  odometer_miles numeric,
  dtc_codes jsonb DEFAULT '[]'::jsonb,
  pending_dtc_codes jsonb DEFAULT '[]'::jsonb,
  permanent_dtc_codes jsonb DEFAULT '[]'::jsonb,
  mil_on boolean DEFAULT false,
  dtc_count int DEFAULT 0,
  readiness_monitors jsonb DEFAULT '{}'::jsonb,
  monitors_ready_count int DEFAULT 0,
  monitors_not_ready_count int DEFAULT 0,
  engine_coolant_temp numeric,
  fuel_system_status text,
  battery_voltage numeric,
  protocol text,
  ecu_name text,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_scans_submission ON public.vehicle_scans(submission_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_scans_scanned_at ON public.vehicle_scans(scanned_at DESC);
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS obd_scan_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS obd_has_active_dtcs boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS obd_odometer_verified boolean,
  ADD COLUMN IF NOT EXISTS obd_mil_on boolean,
  ADD COLUMN IF NOT EXISTS latest_scan_id uuid REFERENCES public.vehicle_scans(id);
ALTER TABLE public.vehicle_scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view scans" ON public.vehicle_scans;
CREATE POLICY "Staff can view scans" ON public.vehicle_scans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can insert scans" ON public.vehicle_scans;
CREATE POLICY "Staff can insert scans" ON public.vehicle_scans FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Staff can update scans" ON public.vehicle_scans;
CREATE POLICY "Staff can update scans" ON public.vehicle_scans FOR UPDATE USING (true);

-- 20260410130000_vauto_integration.sql
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS vauto_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vauto_api_key text,
  ADD COLUMN IF NOT EXISTS vauto_dealer_id text,
  ADD COLUMN IF NOT EXISTS vauto_auto_push boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vauto_api_environment text DEFAULT 'sandbox';
CREATE TABLE IF NOT EXISTS public.vauto_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id uuid,
  pushed_at timestamptz NOT NULL DEFAULT now(),
  pushed_by text,
  push_status text NOT NULL DEFAULT 'pending',
  vauto_vehicle_id text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  retry_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vauto_push_log_submission ON public.vauto_push_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_vauto_push_log_status ON public.vauto_push_log(push_status);
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS vauto_pushed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vauto_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS vauto_vehicle_id text;
ALTER TABLE public.vauto_push_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view push logs" ON public.vauto_push_log;
CREATE POLICY "Staff can view push logs" ON public.vauto_push_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff can insert push logs" ON public.vauto_push_log;
CREATE POLICY "Staff can insert push logs" ON public.vauto_push_log FOR INSERT WITH CHECK (true);

-- 20260410150000_revaluation_log.sql
CREATE TABLE IF NOT EXISTS public.revaluation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  old_retail_avg numeric,
  new_retail_avg numeric,
  old_tradein_avg numeric,
  new_tradein_avg numeric,
  value_change numeric,
  notification_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revaluation_log_submission ON public.revaluation_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_revaluation_log_run_at ON public.revaluation_log(run_at DESC);
ALTER TABLE public.revaluation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view revaluation log" ON public.revaluation_log;
CREATE POLICY "Staff can view revaluation log" ON public.revaluation_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service can insert revaluation" ON public.revaluation_log;
CREATE POLICY "Service can insert revaluation" ON public.revaluation_log FOR INSERT WITH CHECK (true);
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS last_revalued_at timestamptz,
  ADD COLUMN IF NOT EXISTS revaluation_count int DEFAULT 0;

-- 20260411000000_vin_cache_and_tz_quiet_hours.sql
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone text NOT NULL DEFAULT 'America/New_York';
COMMENT ON COLUMN public.notification_settings.quiet_hours_timezone IS
  'IANA timezone used when evaluating quiet_hours_start/end. Defaults to America/New_York.';
CREATE TABLE IF NOT EXISTS public.bb_vin_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  lookup_type text NOT NULL,
  vin text,
  plate text,
  state text,
  mileage integer,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_bb_vin_cache_expires ON public.bb_vin_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_bb_vin_cache_vin ON public.bb_vin_cache (vin) WHERE vin IS NOT NULL;
ALTER TABLE public.bb_vin_cache ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.cleanup_expired_bb_vin_cache()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.bb_vin_cache WHERE expires_at < now();
END;
$$;

-- 20260411000100_consent_text_versioning.sql
CREATE TABLE IF NOT EXISTS public.consent_text_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  version text NOT NULL,
  consent_type text NOT NULL DEFAULT 'sms_calls_email',
  text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, version, consent_type)
);
CREATE INDEX IF NOT EXISTS idx_consent_text_versions_active
  ON public.consent_text_versions (dealership_id, consent_type, is_active, published_at DESC);
ALTER TABLE public.consent_text_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "consent_text_versions_read" ON public.consent_text_versions;
CREATE POLICY "consent_text_versions_read" ON public.consent_text_versions FOR SELECT TO authenticated USING (true);
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS consent_version text NOT NULL DEFAULT 'v1';
COMMENT ON COLUMN public.consent_log.consent_version IS
  'Version tag referencing consent_text_versions.version.';
INSERT INTO public.consent_text_versions (dealership_id, version, consent_type, text, is_active, published_by)
VALUES (
  'default','v1','sms_calls_email',
  'By submitting this form, you consent to receive autodialed calls, texts (SMS/MMS), and emails from {{dealership_name}} at the phone number and email provided regarding your vehicle submission, offer, and appointment. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out.',
  true,'system_seed'
) ON CONFLICT (dealership_id, version, consent_type) DO NOTHING;

-- 20260414000000_offer_watches.sql
CREATE TABLE IF NOT EXISTS public.offer_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  email text NOT NULL,
  phone text,
  vehicle text,
  current_offer numeric(10, 2),
  is_active boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  notification_count int NOT NULL DEFAULT 0,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS offer_watches_token_email_idx ON public.offer_watches (token, email);
CREATE INDEX IF NOT EXISTS offer_watches_email_active_idx ON public.offer_watches (email) WHERE is_active;
CREATE INDEX IF NOT EXISTS offer_watches_unsubscribe_token_idx ON public.offer_watches (unsubscribe_token);
ALTER TABLE public.offer_watches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offer_watches_insert_anyone" ON public.offer_watches;
CREATE POLICY "offer_watches_insert_anyone" ON public.offer_watches FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "offer_watches_staff_read" ON public.offer_watches;
CREATE POLICY "offer_watches_staff_read" ON public.offer_watches FOR SELECT USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "offer_watches_deny_anon_read" ON public.offer_watches;
CREATE POLICY "offer_watches_deny_anon_read" ON public.offer_watches AS RESTRICTIVE FOR SELECT TO anon USING (false);

-- 20260420020000_watch_my_car_and_voice_qa.sql
CREATE TABLE IF NOT EXISTS public.watched_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  token text NOT NULL UNIQUE,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  customer_name text,
  email text,
  phone text,
  vin text,
  vehicle_year int,
  vehicle_make text,
  vehicle_model text,
  vehicle_trim text,
  mileage_at_save int NOT NULL DEFAULT 0,
  monthly_mileage_estimate int NOT NULL DEFAULT 1000,
  overall_condition text,
  baseline_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  delta_since_baseline numeric NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  notify_threshold_dollars int NOT NULL DEFAULT 200,
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT false,
  last_notified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vin IS NOT NULL OR (vehicle_year IS NOT NULL AND vehicle_make IS NOT NULL AND vehicle_model IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_watched_vehicles_dealership ON public.watched_vehicles(dealership_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_watched_vehicles_next_check ON public.watched_vehicles(next_check_at) WHERE is_active = true;
ALTER TABLE public.watched_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read watched vehicle by token" ON public.watched_vehicles;
CREATE POLICY "Anyone can read watched vehicle by token" ON public.watched_vehicles FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Staff read own tenant watched vehicles" ON public.watched_vehicles;
CREATE POLICY "Staff read own tenant watched vehicles" ON public.watched_vehicles FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));
DROP POLICY IF EXISTS "Anyone can insert watched vehicle" ON public.watched_vehicles;
CREATE POLICY "Anyone can insert watched vehicle" ON public.watched_vehicles FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update watched vehicle by token" ON public.watched_vehicles;
CREATE POLICY "Anyone can update watched vehicle by token" ON public.watched_vehicles FOR UPDATE TO public USING (true);

CREATE TABLE IF NOT EXISTS public.watched_vehicle_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watched_vehicle_id uuid NOT NULL REFERENCES public.watched_vehicles(id) ON DELETE CASCADE,
  snapshot_value numeric NOT NULL,
  mileage_assumed int NOT NULL,
  delta_from_previous numeric NOT NULL DEFAULT 0,
  bb_data jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_watched_history_vehicle ON public.watched_vehicle_history(watched_vehicle_id, checked_at DESC);
ALTER TABLE public.watched_vehicle_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read history" ON public.watched_vehicle_history;
CREATE POLICY "Anyone can read history" ON public.watched_vehicle_history FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Service role manages history" ON public.watched_vehicle_history;
CREATE POLICY "Service role manages history" ON public.watched_vehicle_history FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
COMMENT ON TABLE public.watched_vehicles IS
  'Customer-opt-in vehicle value tracking.';

-- 20260420080000_obd_repair_estimates.sql
CREATE TABLE IF NOT EXISTS public.obd_repair_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  code_title text NOT NULL,
  repair_category text NOT NULL,
  common_causes text[] NOT NULL DEFAULT '{}',
  cost_low numeric NOT NULL,
  cost_expected numeric NOT NULL,
  cost_high numeric NOT NULL,
  severity text NOT NULL CHECK (severity IN ('minor','moderate','severe')),
  often_trivial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_obd_estimates_category ON public.obd_repair_estimates(repair_category);
ALTER TABLE public.obd_repair_estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read OBD repair estimates" ON public.obd_repair_estimates;
CREATE POLICY "Anyone can read OBD repair estimates" ON public.obd_repair_estimates FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Staff can manage OBD repair estimates" ON public.obd_repair_estimates;
CREATE POLICY "Staff can manage OBD repair estimates" ON public.obd_repair_estimates FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
INSERT INTO public.obd_repair_estimates (code, code_title, repair_category, common_causes, cost_low, cost_expected, cost_high, severity, often_trivial) VALUES
('P0100','Mass Air Flow Circuit','air_intake',ARRAY['dirty MAF sensor','faulty MAF sensor','wiring'],120,320,600,'moderate',false),
('P0101','Mass Air Flow Performance','air_intake',ARRAY['dirty MAF','air filter','intake leak','faulty MAF'],120,320,600,'moderate',false),
('P0106','MAP Sensor Performance','air_intake',ARRAY['MAP sensor','vacuum leak','hose'],140,280,450,'moderate',false),
('P0110','Intake Air Temp Circuit','air_intake',ARRAY['IAT sensor','wiring'],80,180,280,'minor',false),
('P0113','Intake Air Temp Circuit High','air_intake',ARRAY['IAT sensor','open circuit'],80,180,280,'minor',false),
('P0115','Engine Coolant Temp Circuit','cooling',ARRAY['ECT sensor','wiring','cooling system'],140,260,450,'moderate',false),
('P0121','Throttle Position Sensor Performance','throttle',ARRAY['TPS','throttle body','wiring'],180,360,650,'moderate',false),
('P0128','Coolant Below Thermostat Regulating Temp','cooling',ARRAY['thermostat','ECT sensor'],240,420,700,'moderate',false),
('P0133','O2 Sensor Slow Response (B1S1)','emissions',ARRAY['O2 sensor','exhaust leak','wiring'],180,350,600,'moderate',false),
('P0134','O2 Sensor No Activity (B1S1)','emissions',ARRAY['O2 sensor','heater circuit','wiring'],180,350,600,'moderate',false),
('P0135','O2 Heater Circuit (B1S1)','emissions',ARRAY['O2 sensor heater','fuse','wiring'],180,350,600,'moderate',false),
('P0141','O2 Heater Circuit (B1S2)','emissions',ARRAY['downstream O2 sensor','wiring'],180,350,600,'moderate',false),
('P0155','O2 Heater Circuit (B2S1)','emissions',ARRAY['O2 sensor','wiring'],180,350,600,'moderate',false),
('P0171','System Too Lean (Bank 1)','fuel_air',ARRAY['vacuum leak','dirty MAF','fuel pump','fuel pressure regulator'],180,700,1500,'moderate',false),
('P0172','System Too Rich (Bank 1)','fuel_air',ARRAY['fuel pressure regulator','leaking injector','MAF'],180,600,1400,'moderate',false),
('P0174','System Too Lean (Bank 2)','fuel_air',ARRAY['vacuum leak','fuel pump','fuel pressure','MAF'],180,700,1500,'moderate',false),
('P0175','System Too Rich (Bank 2)','fuel_air',ARRAY['fuel pressure','leaking injector'],180,600,1400,'moderate',false),
('P0200','Injector Circuit / Open','fuel_injection',ARRAY['fuel injector','wiring','ECM driver'],380,800,1600,'severe',false),
('P0217','Engine Over Temperature','cooling',ARRAY['thermostat','water pump','head gasket'],400,1200,3500,'severe',false),
('P0219','Engine Overspeed Condition','drivetrain',ARRAY['shifting error','manual transmission misuse'],0,0,0,'minor',true),
('P0300','Random / Multiple Cylinder Misfire','ignition',ARRAY['spark plugs','coils','fuel','compression','timing'],150,600,2800,'moderate',false),
('P0301','Cylinder 1 Misfire','ignition',ARRAY['plug','coil','injector','compression'],120,420,900,'moderate',false),
('P0302','Cylinder 2 Misfire','ignition',ARRAY['plug','coil','injector','compression'],120,420,900,'moderate',false),
('P0303','Cylinder 3 Misfire','ignition',ARRAY['plug','coil','injector','compression'],120,420,900,'moderate',false),
('P0304','Cylinder 4 Misfire','ignition',ARRAY['plug','coil','injector','compression'],120,420,900,'moderate',false),
('P0305','Cylinder 5 Misfire','ignition',ARRAY['plug','coil','injector','compression'],120,420,900,'moderate',false),
('P0306','Cylinder 6 Misfire','ignition',ARRAY['plug','coil','injector','compression'],120,420,900,'moderate',false),
('P0307','Cylinder 7 Misfire','ignition',ARRAY['plug','coil','injector','compression'],120,420,900,'moderate',false),
('P0308','Cylinder 8 Misfire','ignition',ARRAY['plug','coil','injector','compression'],120,420,900,'moderate',false),
('P0325','Knock Sensor Circuit','ignition',ARRAY['knock sensor','wiring'],280,480,800,'moderate',false),
('P0335','Crankshaft Position Sensor','ignition',ARRAY['CKP sensor','wiring','reluctor'],220,420,700,'moderate',false),
('P0340','Camshaft Position Sensor','ignition',ARRAY['CMP sensor','wiring','timing'],220,420,700,'moderate',false),
('P0401','EGR Flow Insufficient','emissions',ARRAY['EGR valve','carbon buildup','hose'],240,500,850,'moderate',false),
('P0411','Secondary Air Injection','emissions',ARRAY['secondary air pump','check valve'],300,800,1600,'moderate',false),
('P0420','Catalyst System Efficiency Below Threshold (B1)','catalyst',ARRAY['catalytic converter','upstream O2','misfire'],180,1200,2500,'severe',false),
('P0430','Catalyst System Efficiency Below Threshold (B2)','catalyst',ARRAY['catalytic converter','upstream O2','misfire'],180,1200,2500,'severe',false),
('P0440','Evap Emission Control System','evap_leak',ARRAY['gas cap','hose','charcoal canister'],10,200,600,'minor',true),
('P0442','Evap Small Leak','evap_leak',ARRAY['gas cap','small hose'],10,120,500,'minor',true),
('P0446','Evap Vent Control','evap_leak',ARRAY['vent valve','solenoid'],150,300,500,'minor',false),
('P0455','Evap Large Leak','evap_leak',ARRAY['gas cap','large hose','canister'],10,220,600,'minor',true),
('P0456','Evap Very Small Leak','evap_leak',ARRAY['gas cap','pinhole hose'],10,140,500,'minor',true),
('P0480','Cooling Fan Relay 1 Control','cooling',ARRAY['relay','fan motor','wiring'],150,300,600,'moderate',false),
('P0500','Vehicle Speed Sensor','drivetrain',ARRAY['VSS','wiring'],150,280,450,'moderate',false),
('P0505','Idle Air Control','throttle',ARRAY['IAC valve','throttle body'],200,380,700,'moderate',false),
('P0507','Idle Higher than Expected','throttle',ARRAY['vacuum leak','IAC valve','throttle plate'],180,360,700,'moderate',false),
('P0562','System Voltage Low','electrical',ARRAY['battery','alternator','wiring'],180,450,950,'moderate',false),
('P0563','System Voltage High','electrical',ARRAY['alternator','voltage regulator'],380,650,1100,'moderate',false),
('P0600','Serial Communication Link','electrical',ARRAY['wiring','module'],220,650,2500,'severe',false),
('P0606','PCM Processor Fault','electrical',ARRAY['ECM','PCM','flash/reprogram'],500,1400,2800,'severe',false),
('P0700','Transmission Control Malfunction','transmission',ARRAY['TCM','solenoid','internal damage'],450,1500,3500,'severe',false),
('P0715','Input/Turbine Speed Sensor','transmission',ARRAY['input speed sensor','wiring'],220,420,700,'moderate',false),
('P0720','Output Speed Sensor','transmission',ARRAY['output speed sensor','wiring'],220,420,700,'moderate',false),
('P0740','Torque Converter Clutch Circuit','transmission',ARRAY['TCC solenoid','converter','fluid'],350,1400,3500,'severe',false),
('P0750','Shift Solenoid A','transmission',ARRAY['shift solenoid','fluid'],240,550,900,'severe',false),
('P0755','Shift Solenoid B','transmission',ARRAY['shift solenoid','fluid'],240,550,900,'severe',false),
('B1318','Battery Voltage Low During Scan','electrical',ARRAY['weak battery','parasitic draw'],150,220,380,'minor',true),
('U0100','Lost Communication with ECM/PCM','electrical',ARRAY['wiring','ECM','CAN bus'],180,800,2500,'severe',false),
('U0121','Lost Comm with ABS','brakes',ARRAY['wiring','ABS module'],200,650,1800,'severe',false),
('U0140','Lost Comm with BCM','electrical',ARRAY['BCM','wiring'],300,900,1800,'severe',false),
('C0035','Left Front Wheel Speed Sensor','brakes',ARRAY['wheel speed sensor','wiring','tone ring'],220,350,600,'moderate',false),
('C0040','Right Front Wheel Speed Sensor','brakes',ARRAY['wheel speed sensor','wiring','tone ring'],220,350,600,'moderate',false),
('C0045','Left Rear Wheel Speed Sensor','brakes',ARRAY['wheel speed sensor','wiring','tone ring'],220,350,600,'moderate',false),
('C0050','Right Rear Wheel Speed Sensor','brakes',ARRAY['wheel speed sensor','wiring','tone ring'],220,350,600,'moderate',false)
ON CONFLICT (code) DO NOTHING;
COMMENT ON TABLE public.obd_repair_estimates IS
  'US-average parts + labor ranges for a baseline mainstream vehicle.';

-- 20260420270000_pwa_push_subscriptions.sql
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dealership_id text NOT NULL DEFAULT 'default',
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_label text,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.push_subscriptions IS
  'Web-push subscriptions (one per user+device+browser).';
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS push_subscriptions_dealership_idx ON public.push_subscriptions (dealership_id, user_id) WHERE is_active = true;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role can read all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Service role can read all push subscriptions" ON public.push_subscriptions FOR SELECT TO service_role USING (true);

-- 20260420290000_sms_inbound_and_opt_outs.sql
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  dealership_id text,
  reason text,
  opted_out_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.sms_opt_outs IS
  'Phone numbers that replied STOP / UNSUBSCRIBE / CANCEL to our SMS.';
ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages opt-outs" ON public.sms_opt_outs;
CREATE POLICY "Service role manages opt-outs" ON public.sms_opt_outs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Staff read opt-outs" ON public.sms_opt_outs;
CREATE POLICY "Staff read opt-outs" ON public.sms_opt_outs FOR SELECT TO authenticated USING (true);
CREATE TABLE IF NOT EXISTS public.sms_inbound_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL UNIQUE,
  from_phone text NOT NULL,
  to_phone text,
  body text,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  dealership_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.sms_inbound_log IS
  'Every inbound SMS Twilio delivers. Provider_message_id is unique.';
CREATE INDEX IF NOT EXISTS sms_inbound_log_submission_idx ON public.sms_inbound_log (submission_id, created_at DESC) WHERE submission_id IS NOT NULL;
ALTER TABLE public.sms_inbound_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role writes inbound log" ON public.sms_inbound_log;
CREATE POLICY "Service role writes inbound log" ON public.sms_inbound_log FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Staff read inbound log" ON public.sms_inbound_log;
CREATE POLICY "Staff read inbound log" ON public.sms_inbound_log FOR SELECT TO authenticated USING (true);

-- 20260427100000_add_submission_notes.sql
CREATE TABLE IF NOT EXISTS public.submission_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submission_notes_submission_id_created_at_idx ON public.submission_notes (submission_id, created_at DESC);
ALTER TABLE public.submission_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can read submission notes" ON public.submission_notes;
CREATE POLICY "Staff can read submission notes" ON public.submission_notes FOR SELECT USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can insert submission notes" ON public.submission_notes;
CREATE POLICY "Staff can insert submission notes" ON public.submission_notes FOR INSERT WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can delete their own submission notes" ON public.submission_notes;
CREATE POLICY "Staff can delete their own submission notes" ON public.submission_notes FOR DELETE USING (is_staff(auth.uid()));

NOTIFY pgrst, 'reload schema';
