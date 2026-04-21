-- Floor plan rate + holding cost foundation.
--
-- Every day an acquired vehicle sits before it retails costs the dealer
-- real money — interest on the floor-plan loan used to buy inventory
-- plus lot/insurance/overhead per unit. The GM + owner use this number
-- to decide how aggressive to be on acquisition offers: a store with a
-- high rate and slow turn should buy cheaper and chase volume; a store
-- with a low rate can afford to pay up for the right unit.
--
-- We store the annual rate on `tenants` (per-dealership) plus a target
-- days-to-retail so the carrying-cost math can flag "aged" inventory.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS floor_plan_rate_annual_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS avg_holding_days_target int NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS overhead_per_day_per_unit numeric(8,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tenants.floor_plan_rate_annual_pct IS
  'Dealer floor-plan loan rate as annual percent (e.g. 8.25 for 8.25% APR). Feeds GM executive HUD holding-cost math: daily_cost = acv * (rate / 365 / 100) + overhead_per_day_per_unit. Null = not configured yet.';
COMMENT ON COLUMN public.tenants.avg_holding_days_target IS
  'Dealer target for days-to-retail. Inventory aged past this threshold surfaces on the aged-inventory widget. Default 45 — industry average for mid-tier used car operations.';
COMMENT ON COLUMN public.tenants.overhead_per_day_per_unit IS
  'Flat overhead per vehicle per day — lot insurance, detailing amortization, reconditioning staff time divided by capacity. Kept separate from floor-plan interest so we can show both components. Default 0 (interest only).';

NOTIFY pgrst, 'reload schema';
