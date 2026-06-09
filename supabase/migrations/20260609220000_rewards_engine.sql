-- Rewards engine for the Admin V2 "My Business" hub.
--
-- Two tables + one self-scoped read RPC. This is the backend for the
-- employee Rewards view; the dealer-facing rule editor and automatic
-- ledger population (earning rewards when a vehicle is acquired) are
-- downstream work and intentionally NOT included here — so the ledger
-- starts empty and the employee view shows real (zero) earnings plus the
-- dealership's configured rules.
--
-- Mirrors existing conventions: is_staff() / is_platform_admin() /
-- get_user_dealership_id() helpers for RLS, dealership_id text scoping.
-- Idempotent. Migrations are NOT auto-applied on merge — apply manually
-- (see CLAUDE.md). The V2 client falls back to a preview when the RPC is
-- absent, so there is no deploy-order window.

-- ── reward_rules: dealer-configured reward definitions ──
CREATE TABLE IF NOT EXISTS public.reward_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  event_type    text NOT NULL,             -- vehicle_acquired | referral_purchase | offer_generated | ...
  reward_type   text NOT NULL DEFAULT 'flat', -- flat | stair_step | tiered | contest | hybrid
  amount        numeric NOT NULL DEFAULT 0, -- flat amount; tier/stair detail lives in config
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reward_rules_dealer_event_uniq
  ON public.reward_rules (dealership_id, event_type);

-- ── reward_ledger: each reward earned by an employee ──
CREATE TABLE IF NOT EXISTS public.reward_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  staff_email   text NOT NULL,
  event_type    text NOT NULL,
  amount        numeric NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'pending', -- pending | approved | paid
  source        text,                            -- referral | lead_link | qr | manual | ...
  reference_id  text,                            -- e.g. submission/referral id
  created_at    timestamptz NOT NULL DEFAULT now(),
  paid_at       timestamptz
);
CREATE INDEX IF NOT EXISTS reward_ledger_dealer_staff
  ON public.reward_ledger (dealership_id, staff_email);
CREATE INDEX IF NOT EXISTS reward_ledger_dealer_status
  ON public.reward_ledger (dealership_id, status);

ALTER TABLE public.reward_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;

-- reward_rules: staff read their tenant's rules; platform admins manage all.
DROP POLICY IF EXISTS "Staff read tenant reward_rules" ON public.reward_rules;
CREATE POLICY "Staff read tenant reward_rules"
  ON public.reward_rules FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Platform admins manage reward_rules" ON public.reward_rules;
CREATE POLICY "Platform admins manage reward_rules"
  ON public.reward_rules FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- reward_ledger: staff read only their OWN rows; platform admins manage all.
-- (Manager-wide read is a later increment — the manager dashboard.)
DROP POLICY IF EXISTS "Staff read own reward_ledger" ON public.reward_ledger;
CREATE POLICY "Staff read own reward_ledger"
  ON public.reward_ledger FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid())
    AND dealership_id = get_user_dealership_id(auth.uid())
    AND staff_email = (auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "Platform admins manage reward_ledger" ON public.reward_ledger;
CREATE POLICY "Platform admins manage reward_ledger"
  ON public.reward_ledger FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- ── get_my_rewards: the employee's rewards summary ──
-- SECURITY DEFINER but scoped server-side to the caller's own email, so
-- it can never read another employee's ledger. Tier thresholds are
-- static here (configurable per-dealer in a later increment).
CREATE OR REPLACE FUNCTION public.get_my_rewards(p_dealership_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH me AS (SELECT (auth.jwt() ->> 'email') AS email),
led AS (
  SELECT rl.status, rl.event_type, rl.amount
  FROM reward_ledger rl, me
  WHERE rl.dealership_id = p_dealership_id
    AND rl.staff_email = me.email
),
sums AS (
  SELECT
    coalesce(sum(amount) FILTER (WHERE status = 'pending'), 0)  AS pending,
    coalesce(sum(amount) FILTER (WHERE status = 'approved'), 0) AS approved,
    coalesce(sum(amount) FILTER (WHERE status = 'paid'), 0)     AS paid,
    count(*) FILTER (WHERE event_type = 'vehicle_acquired' AND status IN ('approved', 'paid')) AS acq
  FROM led
),
by_event AS (
  SELECT coalesce(
    jsonb_agg(jsonb_build_object('event_type', event_type, 'amount', amt, 'n', n) ORDER BY amt DESC),
    '[]'::jsonb
  ) AS arr
  FROM (SELECT event_type, sum(amount) AS amt, count(*) AS n FROM led GROUP BY event_type) q
),
rules AS (
  SELECT coalesce(
    jsonb_agg(jsonb_build_object('event_type', event_type, 'reward_type', reward_type, 'amount', amount, 'config', config) ORDER BY event_type),
    '[]'::jsonb
  ) AS arr
  FROM reward_rules WHERE dealership_id = p_dealership_id AND active
)
SELECT jsonb_build_object(
  'pending',       sums.pending,
  'approved',      sums.approved,
  'paid_lifetime', sums.paid,
  'acquisitions',  sums.acq,
  'by_event',      by_event.arr,
  'rules',         rules.arr,
  'tier', CASE WHEN sums.acq >= 11 THEN 'Platinum'
               WHEN sums.acq >= 6  THEN 'Gold'
               WHEN sums.acq >= 3  THEN 'Silver'
               ELSE 'Bronze' END,
  'next_tier', CASE WHEN sums.acq >= 11 THEN NULL
                    WHEN sums.acq >= 6  THEN 'Platinum'
                    WHEN sums.acq >= 3  THEN 'Gold'
                    ELSE 'Silver' END,
  'to_next_tier', CASE WHEN sums.acq >= 11 THEN 0
                       WHEN sums.acq >= 6  THEN 11 - sums.acq
                       WHEN sums.acq >= 3  THEN 6 - sums.acq
                       ELSE 3 - sums.acq END
)
FROM sums, by_event, rules;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_rewards(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
