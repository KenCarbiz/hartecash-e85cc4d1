-- ── Watch My Car's Worth ──
-- Lets a customer opt into tracking their vehicle value over time. A cron
-- function (recompute-watched-values) re-runs the BB lookup weekly with
-- drifted mileage and snapshots the result into watched_vehicle_history.
-- Notifications fire when the delta crosses a configurable threshold.

CREATE TABLE IF NOT EXISTS public.watched_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  -- Identity. token is the customer-facing handle for /watch-my-car/<token>;
  -- email/phone are how we re-engage. submission_id is set when this vehicle
  -- came out of an existing offer flow (vs. a standalone "save my car" entry).
  token text NOT NULL UNIQUE,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  customer_name text,
  email text,
  phone text,
  -- Vehicle. Either vin OR year/make/model is required at insert time.
  vin text,
  vehicle_year int,
  vehicle_make text,
  vehicle_model text,
  vehicle_trim text,
  mileage_at_save int NOT NULL DEFAULT 0,
  monthly_mileage_estimate int NOT NULL DEFAULT 1000,
  overall_condition text,
  -- Value tracking (current snapshot; full series lives in history table)
  baseline_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  delta_since_baseline numeric NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  -- Notification preferences
  notify_threshold_dollars int NOT NULL DEFAULT 200,
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT false,
  last_notified_at timestamptz,
  -- Lifecycle
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vin IS NOT NULL OR (vehicle_year IS NOT NULL AND vehicle_make IS NOT NULL AND vehicle_model IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_watched_vehicles_dealership ON public.watched_vehicles(dealership_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_watched_vehicles_next_check ON public.watched_vehicles(next_check_at) WHERE is_active = true;

ALTER TABLE public.watched_vehicles ENABLE ROW LEVEL SECURITY;

-- Customer reads via token (matches the page URL)
CREATE POLICY "Anyone can read watched vehicle by token" ON public.watched_vehicles
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Staff read own tenant watched vehicles" ON public.watched_vehicles
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

-- Public can insert (anonymous customer opting in from the offer page)
CREATE POLICY "Anyone can insert watched vehicle" ON public.watched_vehicles
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update watched vehicle by token" ON public.watched_vehicles
  FOR UPDATE TO public
  USING (true);

-- ── Snapshot history ───────────────────────────────────────────────────
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

CREATE POLICY "Anyone can read history" ON public.watched_vehicle_history
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role manages history" ON public.watched_vehicle_history
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

COMMENT ON TABLE public.watched_vehicles IS
  'Customer-opt-in vehicle value tracking. The cron function recompute-watched-values walks rows where next_check_at <= now() and inserts a fresh snapshot into watched_vehicle_history.';
