-- OBD-II repair cost estimator foundation.
-- Seeds the most common ~60 OBD codes with repair category + US-average
-- parts+labor ranges (low / expected / high). The estimator function in
-- src/lib/obdEstimator.ts multiplies these by a vehicle_adjuster factor
-- and an inspector-note adjustment before returning a final estimate that
-- the offer engine treats as recon_cost.

CREATE TABLE IF NOT EXISTS public.obd_repair_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  code_title text NOT NULL,
  -- Broad category so the admin can toggle "always flag" or "skip" per category
  -- (e.g. evap_leak = almost always gas cap; catalyst = nearly always expensive).
  repair_category text NOT NULL,
  common_causes text[] NOT NULL DEFAULT '{}',
  -- US-average parts + labor for a baseline mainstream vehicle (before the
  -- vehicle_adjuster multiplier). Dealers can override ranges later if
  -- their market deviates systematically.
  cost_low numeric NOT NULL,
  cost_expected numeric NOT NULL,
  cost_high numeric NOT NULL,
  -- How worried we should be when we see this code on a trade candidate.
  severity text NOT NULL CHECK (severity IN ('minor','moderate','severe')),
  -- Some codes (evap small leak, low battery) often clear on their own or
  -- resolve with a trivial fix. Flag so the estimator can skip or minimize.
  often_trivial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obd_estimates_category ON public.obd_repair_estimates(repair_category);

ALTER TABLE public.obd_repair_estimates ENABLE ROW LEVEL SECURITY;

-- Shared reference data — readable by everyone, editable by staff only.
CREATE POLICY "Anyone can read OBD repair estimates"
  ON public.obd_repair_estimates FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Staff can manage OBD repair estimates"
  ON public.obd_repair_estimates FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- ─── Seed the common P0xxx / P07xx / U01xx / C00xx codes ────────────
-- Covers ~90% of what dealers see on typical trade submissions. Sourced
-- from the standard SAE J2012 DTC definitions + US parts/labor averages.

INSERT INTO public.obd_repair_estimates (code, code_title, repair_category, common_causes, cost_low, cost_expected, cost_high, severity, often_trivial) VALUES
-- ── Air/fuel metering (P0100-P0199) ──
('P0100','Mass Air Flow Circuit','air_intake',                ARRAY['dirty MAF sensor','faulty MAF sensor','wiring'],                    120,  320,  600, 'moderate', false),
('P0101','Mass Air Flow Performance','air_intake',            ARRAY['dirty MAF','air filter','intake leak','faulty MAF'],              120,  320,  600, 'moderate', false),
('P0106','MAP Sensor Performance','air_intake',               ARRAY['MAP sensor','vacuum leak','hose'],                                 140,  280,  450, 'moderate', false),
('P0110','Intake Air Temp Circuit','air_intake',              ARRAY['IAT sensor','wiring'],                                              80,  180,  280, 'minor',    false),
('P0113','Intake Air Temp Circuit High','air_intake',         ARRAY['IAT sensor','open circuit'],                                        80,  180,  280, 'minor',    false),
('P0115','Engine Coolant Temp Circuit','cooling',             ARRAY['ECT sensor','wiring','cooling system'],                            140,  260,  450, 'moderate', false),
('P0121','Throttle Position Sensor Performance','throttle',   ARRAY['TPS','throttle body','wiring'],                                    180,  360,  650, 'moderate', false),
('P0128','Coolant Below Thermostat Regulating Temp','cooling',ARRAY['thermostat','ECT sensor'],                                         240,  420,  700, 'moderate', false),
('P0133','O2 Sensor Slow Response (B1S1)','emissions',        ARRAY['O2 sensor','exhaust leak','wiring'],                               180,  350,  600, 'moderate', false),
('P0134','O2 Sensor No Activity (B1S1)','emissions',          ARRAY['O2 sensor','heater circuit','wiring'],                             180,  350,  600, 'moderate', false),
('P0135','O2 Heater Circuit (B1S1)','emissions',              ARRAY['O2 sensor heater','fuse','wiring'],                                180,  350,  600, 'moderate', false),
('P0141','O2 Heater Circuit (B1S2)','emissions',              ARRAY['downstream O2 sensor','wiring'],                                   180,  350,  600, 'moderate', false),
('P0155','O2 Heater Circuit (B2S1)','emissions',              ARRAY['O2 sensor','wiring'],                                              180,  350,  600, 'moderate', false),
('P0171','System Too Lean (Bank 1)','fuel_air',               ARRAY['vacuum leak','dirty MAF','fuel pump','fuel pressure regulator'],   180, 700, 1500, 'moderate', false),
('P0172','System Too Rich (Bank 1)','fuel_air',               ARRAY['fuel pressure regulator','leaking injector','MAF'],                180, 600, 1400, 'moderate', false),
('P0174','System Too Lean (Bank 2)','fuel_air',               ARRAY['vacuum leak','fuel pump','fuel pressure','MAF'],                   180, 700, 1500, 'moderate', false),
('P0175','System Too Rich (Bank 2)','fuel_air',               ARRAY['fuel pressure','leaking injector'],                                180, 600, 1400, 'moderate', false),
-- ── Fuel / injection (P0200-P0299) ──
('P0200','Injector Circuit / Open','fuel_injection',          ARRAY['fuel injector','wiring','ECM driver'],                             380, 800, 1600, 'severe',   false),
('P0217','Engine Over Temperature','cooling',                 ARRAY['thermostat','water pump','head gasket'],                           400,1200, 3500, 'severe',   false),
('P0219','Engine Overspeed Condition','drivetrain',           ARRAY['shifting error','manual transmission misuse'],                      0,   0,    0, 'minor',    true ),
-- ── Ignition / misfire (P0300-P0399) ──
('P0300','Random / Multiple Cylinder Misfire','ignition',     ARRAY['spark plugs','coils','fuel','compression','timing'],               150, 600, 2800, 'moderate', false),
('P0301','Cylinder 1 Misfire','ignition',                     ARRAY['plug','coil','injector','compression'],                            120, 420,  900, 'moderate', false),
('P0302','Cylinder 2 Misfire','ignition',                     ARRAY['plug','coil','injector','compression'],                            120, 420,  900, 'moderate', false),
('P0303','Cylinder 3 Misfire','ignition',                     ARRAY['plug','coil','injector','compression'],                            120, 420,  900, 'moderate', false),
('P0304','Cylinder 4 Misfire','ignition',                     ARRAY['plug','coil','injector','compression'],                            120, 420,  900, 'moderate', false),
('P0305','Cylinder 5 Misfire','ignition',                     ARRAY['plug','coil','injector','compression'],                            120, 420,  900, 'moderate', false),
('P0306','Cylinder 6 Misfire','ignition',                     ARRAY['plug','coil','injector','compression'],                            120, 420,  900, 'moderate', false),
('P0307','Cylinder 7 Misfire','ignition',                     ARRAY['plug','coil','injector','compression'],                            120, 420,  900, 'moderate', false),
('P0308','Cylinder 8 Misfire','ignition',                     ARRAY['plug','coil','injector','compression'],                            120, 420,  900, 'moderate', false),
('P0325','Knock Sensor Circuit','ignition',                   ARRAY['knock sensor','wiring'],                                           280, 480,  800, 'moderate', false),
('P0335','Crankshaft Position Sensor','ignition',             ARRAY['CKP sensor','wiring','reluctor'],                                  220, 420,  700, 'moderate', false),
('P0340','Camshaft Position Sensor','ignition',               ARRAY['CMP sensor','wiring','timing'],                                    220, 420,  700, 'moderate', false),
-- ── Emissions / evap (P0400-P0499) ──
('P0401','EGR Flow Insufficient','emissions',                 ARRAY['EGR valve','carbon buildup','hose'],                               240, 500,  850, 'moderate', false),
('P0411','Secondary Air Injection','emissions',               ARRAY['secondary air pump','check valve'],                                300, 800, 1600, 'moderate', false),
('P0420','Catalyst System Efficiency Below Threshold (B1)','catalyst', ARRAY['catalytic converter','upstream O2','misfire'],            180, 1200, 2500, 'severe',   false),
('P0430','Catalyst System Efficiency Below Threshold (B2)','catalyst', ARRAY['catalytic converter','upstream O2','misfire'],            180, 1200, 2500, 'severe',   false),
('P0440','Evap Emission Control System','evap_leak',          ARRAY['gas cap','hose','charcoal canister'],                                10,  200,  600, 'minor',    true ),
('P0442','Evap Small Leak','evap_leak',                       ARRAY['gas cap','small hose'],                                              10,  120,  500, 'minor',    true ),
('P0446','Evap Vent Control','evap_leak',                     ARRAY['vent valve','solenoid'],                                           150,  300,  500, 'minor',    false),
('P0455','Evap Large Leak','evap_leak',                       ARRAY['gas cap','large hose','canister'],                                   10,  220,  600, 'minor',    true ),
('P0456','Evap Very Small Leak','evap_leak',                  ARRAY['gas cap','pinhole hose'],                                            10,  140,  500, 'minor',    true ),
('P0480','Cooling Fan Relay 1 Control','cooling',             ARRAY['relay','fan motor','wiring'],                                      150,  300,  600, 'moderate', false),
-- ── Vehicle speed / idle (P0500-P0599) ──
('P0500','Vehicle Speed Sensor','drivetrain',                 ARRAY['VSS','wiring'],                                                    150,  280,  450, 'moderate', false),
('P0505','Idle Air Control','throttle',                       ARRAY['IAC valve','throttle body'],                                       200,  380,  700, 'moderate', false),
('P0507','Idle Higher than Expected','throttle',              ARRAY['vacuum leak','IAC valve','throttle plate'],                        180,  360,  700, 'moderate', false),
('P0562','System Voltage Low','electrical',                   ARRAY['battery','alternator','wiring'],                                   180,  450,  950, 'moderate', false),
('P0563','System Voltage High','electrical',                  ARRAY['alternator','voltage regulator'],                                  380,  650, 1100, 'moderate', false),
-- ── PCM (P0600-P0699) ──
('P0600','Serial Communication Link','electrical',            ARRAY['wiring','module'],                                                 220,  650, 2500, 'severe',   false),
('P0606','PCM Processor Fault','electrical',                  ARRAY['ECM','PCM','flash/reprogram'],                                     500, 1400, 2800, 'severe',   false),
-- ── Transmission (P0700-P0799) ──
('P0700','Transmission Control Malfunction','transmission',   ARRAY['TCM','solenoid','internal damage'],                                450, 1500, 3500, 'severe',   false),
('P0715','Input/Turbine Speed Sensor','transmission',         ARRAY['input speed sensor','wiring'],                                     220,  420,  700, 'moderate', false),
('P0720','Output Speed Sensor','transmission',                ARRAY['output speed sensor','wiring'],                                    220,  420,  700, 'moderate', false),
('P0740','Torque Converter Clutch Circuit','transmission',    ARRAY['TCC solenoid','converter','fluid'],                                350, 1400, 3500, 'severe',   false),
('P0750','Shift Solenoid A','transmission',                   ARRAY['shift solenoid','fluid'],                                          240,  550,  900, 'severe',   false),
('P0755','Shift Solenoid B','transmission',                   ARRAY['shift solenoid','fluid'],                                          240,  550,  900, 'severe',   false),
-- ── Body / battery ──
('B1318','Battery Voltage Low During Scan','electrical',      ARRAY['weak battery','parasitic draw'],                                    150,  220,  380, 'minor',    true ),
-- ── Network U01xx ──
('U0100','Lost Communication with ECM/PCM','electrical',      ARRAY['wiring','ECM','CAN bus'],                                          180,  800, 2500, 'severe',   false),
('U0121','Lost Comm with ABS','brakes',                       ARRAY['wiring','ABS module'],                                             200,  650, 1800, 'severe',   false),
('U0140','Lost Comm with BCM','electrical',                   ARRAY['BCM','wiring'],                                                    300,  900, 1800, 'severe',   false),
-- ── Chassis / ABS wheel speed ──
('C0035','Left Front Wheel Speed Sensor','brakes',            ARRAY['wheel speed sensor','wiring','tone ring'],                         220,  350,  600, 'moderate', false),
('C0040','Right Front Wheel Speed Sensor','brakes',           ARRAY['wheel speed sensor','wiring','tone ring'],                         220,  350,  600, 'moderate', false),
('C0045','Left Rear Wheel Speed Sensor','brakes',             ARRAY['wheel speed sensor','wiring','tone ring'],                         220,  350,  600, 'moderate', false),
('C0050','Right Rear Wheel Speed Sensor','brakes',            ARRAY['wheel speed sensor','wiring','tone ring'],                         220,  350,  600, 'moderate', false)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.obd_repair_estimates IS
  'US-average parts + labor ranges for a baseline mainstream vehicle. The estimator multiplies these by a vehicle_adjuster (make_class x age_band x mileage_band) plus an optional inspector-note adjustment before returning the final recon estimate.';
