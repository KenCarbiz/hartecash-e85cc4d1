-- Tires & Brakes — split the input mode + per-location overrides.
--
-- Two changes that close gaps the user flagged:
--   1. The single tire_brake_input_mode column controls BOTH tires
--      and brakes. Some dealers want exact tread depth on tires
--      (where it drives offer math heavily) but pass/fail on brakes
--      (where they trust the inspector). Split into two columns so
--      each can be toggled independently.
--   2. inspection_config is keyed by dealership_id only, so a dealer
--      group can't have one rooftop on measurement-mode and another
--      on pass-fail. New inspection_config_overrides table layers a
--      per-location override on top of the corporate setting,
--      mirroring the permissions cascade pattern from #103.
--
-- Backwards compat:
--   - The old tire_brake_input_mode column stays for now. Both new
--     columns default to whatever the legacy column held, so reads
--     keep working with the legacy column AND the split columns.
--   - When the inspection_config_overrides table is empty for a
--     given (dealership, location), the cascade resolver returns
--     the corporate value — no behavior change for tenants who
--     don't opt into per-location settings.

-- ── Part 1: split the toggle ─────────────────────────────────────
ALTER TABLE public.inspection_config
  ADD COLUMN IF NOT EXISTS tire_input_mode text NOT NULL DEFAULT 'measurement',
  ADD COLUMN IF NOT EXISTS brake_input_mode text NOT NULL DEFAULT 'measurement';

-- Carry over whatever the legacy single-column held so existing
-- tenants don't notice a change. Idempotent — only updates rows
-- where the new columns still hold the column default and the
-- legacy column has a non-default value to copy.
UPDATE public.inspection_config
   SET tire_input_mode  = tire_brake_input_mode,
       brake_input_mode = tire_brake_input_mode
 WHERE (tire_input_mode = 'measurement' AND tire_brake_input_mode <> 'measurement')
    OR (brake_input_mode = 'measurement' AND tire_brake_input_mode <> 'measurement');

ALTER TABLE public.inspection_config
  DROP CONSTRAINT IF EXISTS inspection_config_tire_input_mode_check;
ALTER TABLE public.inspection_config
  ADD CONSTRAINT inspection_config_tire_input_mode_check
  CHECK (tire_input_mode IN ('measurement', 'pass_fail'));

ALTER TABLE public.inspection_config
  DROP CONSTRAINT IF EXISTS inspection_config_brake_input_mode_check;
ALTER TABLE public.inspection_config
  ADD CONSTRAINT inspection_config_brake_input_mode_check
  CHECK (brake_input_mode IN ('measurement', 'pass_fail'));

COMMENT ON COLUMN public.inspection_config.tire_input_mode IS
  'measurement = inspector enters tread depth (32nds); pass_fail = simple Pass/Fail toggle. Replaces tire_brake_input_mode for tires.';
COMMENT ON COLUMN public.inspection_config.brake_input_mode IS
  'measurement = inspector enters brake pad depth (mm); pass_fail = simple Pass/Fail toggle. Replaces tire_brake_input_mode for brakes.';

-- ── Part 2: per-location overrides ───────────────────────────────
-- Keyed by (dealership_id, location_id). Each column is nullable —
-- a NULL value means "inherit from corporate", a set value means
-- "this rooftop is different." Resolver picks per-column override
-- > corporate, so a rooftop can override just tires while
-- inheriting the brake setting (or vice versa).

CREATE TABLE IF NOT EXISTS public.inspection_config_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   text NOT NULL,
  location_id     uuid NOT NULL REFERENCES public.dealership_locations(id) ON DELETE CASCADE,
  -- Override values — NULL means inherit corporate
  tire_input_mode  text,
  brake_input_mode text,
  -- Bookkeeping
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inspection_config_overrides_unique UNIQUE (dealership_id, location_id),
  CONSTRAINT inspection_config_overrides_tire_check
    CHECK (tire_input_mode IS NULL OR tire_input_mode IN ('measurement', 'pass_fail')),
  CONSTRAINT inspection_config_overrides_brake_check
    CHECK (brake_input_mode IS NULL OR brake_input_mode IN ('measurement', 'pass_fail'))
);

ALTER TABLE public.inspection_config_overrides ENABLE ROW LEVEL SECURITY;

-- Dealers see / manage their own tenant's overrides; super admins
-- see everything. Mirrors the policies on inspection_config itself.
CREATE POLICY "Tenant admins can read inspection_config_overrides"
  ON public.inspection_config_overrides
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      public.get_user_dealership_id(auth.uid()) = 'default'
      OR dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

CREATE POLICY "Tenant admins can write inspection_config_overrides"
  ON public.inspection_config_overrides
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      public.get_user_dealership_id(auth.uid()) = 'default'
      OR dealership_id = public.get_user_dealership_id(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      public.get_user_dealership_id(auth.uid()) = 'default'
      OR dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

-- Resolver: returns the effective input modes for a given dealership
-- + location, applying the per-location override on top of the
-- corporate inspection_config row. NULL location_id means "give me
-- the corporate value."
CREATE OR REPLACE FUNCTION public.effective_inspection_input_modes(
  _dealership_id text,
  _location_id uuid
) RETURNS TABLE (tire_mode text, brake_mode text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(o.tire_input_mode,  c.tire_input_mode,  'measurement') AS tire_mode,
    COALESCE(o.brake_input_mode, c.brake_input_mode, 'measurement') AS brake_mode
  FROM public.inspection_config c
  LEFT JOIN public.inspection_config_overrides o
    ON o.dealership_id = c.dealership_id
   AND o.location_id   = _location_id
  WHERE c.dealership_id = _dealership_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.effective_inspection_input_modes(text, uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
