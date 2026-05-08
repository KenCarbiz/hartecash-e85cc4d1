CREATE TABLE IF NOT EXISTS public.trade_up_incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  trigger_moment text NOT NULL,
  headline text NOT NULL,
  description text,
  bonus_amount numeric NOT NULL DEFAULT 0,
  inventory_scope text NOT NULL DEFAULT 'all',
  inventory_price_floor numeric,
  inventory_price_ceiling numeric,
  inventory_url text,
  is_active boolean NOT NULL DEFAULT true,
  active_until timestamptz,
  disclaimer text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_up_incentives
  DROP CONSTRAINT IF EXISTS trade_up_incentives_trigger_moment_chk;
ALTER TABLE public.trade_up_incentives
  ADD  CONSTRAINT trade_up_incentives_trigger_moment_chk
  CHECK (trigger_moment IN ('pre_acceptance','post_acceptance'));

ALTER TABLE public.trade_up_incentives
  DROP CONSTRAINT IF EXISTS trade_up_incentives_inventory_scope_chk;
ALTER TABLE public.trade_up_incentives
  ADD  CONSTRAINT trade_up_incentives_inventory_scope_chk
  CHECK (inventory_scope IN ('all','new_only','used_only','certified_only'));

ALTER TABLE public.trade_up_incentives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own tenant trade-up incentives" ON public.trade_up_incentives;
CREATE POLICY "Admins manage own tenant trade-up incentives"
  ON public.trade_up_incentives FOR ALL TO authenticated
  USING  (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Anyone can read active trade-up incentives" ON public.trade_up_incentives;
CREATE POLICY "Anyone can read active trade-up incentives"
  ON public.trade_up_incentives FOR SELECT TO public
  USING (is_active = true AND (active_until IS NULL OR active_until > now()));

CREATE INDEX IF NOT EXISTS trade_up_incentives_dealer_idx
  ON public.trade_up_incentives (dealership_id, trigger_moment, is_active)
  WHERE is_active = true;

NOTIFY pgrst, 'reload schema';