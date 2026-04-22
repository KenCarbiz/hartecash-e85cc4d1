-- OBD-II vehicle scan integration
-- Creates the vehicle_scans table for storing diagnostic data captured from
-- OBD-II scanners (via Web Bluetooth, mobile app, or manual entry) and
-- adds quick-access flags on the submissions table.

CREATE TABLE IF NOT EXISTS public.vehicle_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by text, -- staff user identifier
  scanner_device text, -- 'web_bluetooth' | 'mobile_app' | 'manual'

  -- Core OBD data
  vin_from_obd text, -- VIN read from OBD-II
  odometer_km numeric, -- odometer reading in km
  odometer_miles numeric, -- converted to miles

  -- Diagnostic Trouble Codes
  dtc_codes jsonb DEFAULT '[]'::jsonb, -- array of {code, description, severity}
  pending_dtc_codes jsonb DEFAULT '[]'::jsonb,
  permanent_dtc_codes jsonb DEFAULT '[]'::jsonb,

  -- Status flags
  mil_on boolean DEFAULT false, -- check engine light
  dtc_count int DEFAULT 0,

  -- Readiness monitors (emissions)
  readiness_monitors jsonb DEFAULT '{}'::jsonb, -- catalyst, evap, etc.
  monitors_ready_count int DEFAULT 0,
  monitors_not_ready_count int DEFAULT 0,

  -- Live data snapshot
  engine_coolant_temp numeric,
  fuel_system_status text,
  battery_voltage numeric,

  -- Metadata
  protocol text, -- ISO 15765-4, ISO 14230-4, etc.
  ecu_name text,
  raw_data jsonb, -- full response from scanner
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_scans_submission ON public.vehicle_scans(submission_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_scans_scanned_at ON public.vehicle_scans(scanned_at DESC);

-- Add columns to submissions table for quick access
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS obd_scan_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS obd_has_active_dtcs boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS obd_odometer_verified boolean,
  ADD COLUMN IF NOT EXISTS obd_mil_on boolean,
  ADD COLUMN IF NOT EXISTS latest_scan_id uuid REFERENCES public.vehicle_scans(id);

-- RLS policies
ALTER TABLE public.vehicle_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view scans" ON public.vehicle_scans;
CREATE POLICY "Staff can view scans" ON public.vehicle_scans
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can insert scans" ON public.vehicle_scans;
CREATE POLICY "Staff can insert scans" ON public.vehicle_scans
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update scans" ON public.vehicle_scans;
CREATE POLICY "Staff can update scans" ON public.vehicle_scans
  FOR UPDATE USING (true);
