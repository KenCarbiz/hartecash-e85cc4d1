-- Trade-up incentive system.
--
-- Dealers configure a per-rooftop incentive that adds a sweetener
-- to the customer's offer when they ALSO buy a new or pre-owned
-- vehicle from the same dealership. Two surfaces:
--
--   pre_acceptance  — shown on the offer page + decline-winback email
--                     as a reason to accept ("Trade us your car, take
--                     home an extra $500 off any vehicle on our lot").
--   post_acceptance — shown on the acceptance page + acceptance email
--                     as a sweetener at signing ("Your offer just
--                     went up by $1,000 if you take a new car home
--                     today").
--
-- Both can be active simultaneously (different amounts and copy)
-- because they target different decision moments. The dealer
-- decides which to enable, on what kind of vehicles (new only,
-- used only, certain models, certain price floors), and the
-- amount.
--
-- Per-dealer; no network defaults — incentives are too margin-
-- sensitive to share across rooftops. New dealers start with
-- nothing configured and the offer/acceptance flows render
-- normally without the incentive block.
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.trade_up_incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  -- 'pre_acceptance'  → shows on offer page + decline winback emails
  -- 'post_acceptance' → shows on accepted page + acceptance email
  trigger_moment text NOT NULL,
  -- Headline shown to the customer ("Take an extra $500 off any new
  -- car"). Dealer-editable.
  headline text NOT NULL,
  -- Longer prose body (under the headline). Optional.
  description text,
  -- Dollar amount the customer gets if they redeem. Used in copy
  -- substitution + the math the customer sees on the offer/acceptance
  -- breakdown.
  bonus_amount numeric NOT NULL DEFAULT 0,
  -- Which inventory the incentive applies to. Lets the dealer scope
  -- it to "new only," "used 2020+," etc. Drives the eligibility
  -- copy ("any new vehicle on our lot," "any vehicle priced over
  -- $20,000," etc.) and informs the inventory link surfaced.
  inventory_scope text NOT NULL DEFAULT 'all',
    -- 'all' | 'new_only' | 'used_only' | 'certified_only'
    --   plus optional: 'price_floor', 'price_ceiling'
  inventory_price_floor numeric,
  inventory_price_ceiling numeric,
  -- Optional URL the customer can click through to the dealer's
  -- inventory feed pre-filtered to the eligible vehicles.
  inventory_url text,
  -- Lifecycle.
  is_active boolean NOT NULL DEFAULT true,
  -- Optional expiry. NULL = no expiry (always active until disabled).
  active_until timestamptz,
  -- Optional fine-print legal disclaimer rendered in micro text on
  -- the customer surface ("OAC. Not combinable with other offers.").
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
