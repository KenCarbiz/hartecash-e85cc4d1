-- Admin V2 Command Center exact KPIs RPC
CREATE OR REPLACE FUNCTION public.get_admin_kpis(
  p_dealership_id text,
  p_assigned_rep_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
WITH base AS (
  SELECT
    s.progress_status AS status,
    s.offered_price,
    s.created_at,
    s.needs_appraisal,
    s.acv_value
  FROM submissions s
  WHERE s.dealership_id::text = p_dealership_id
    AND (p_assigned_rep_email IS NULL OR s.assigned_rep_email = p_assigned_rep_email)
),
flags AS (
  SELECT
    b.*,
    (b.status = ANY (ARRAY[
      'offer_accepted','appraisal_completed','price_agreed',
      'inspection_scheduled','inspection_completed','deal_finalized',
      'title_ownership_verified','check_request_submitted','purchase_complete'
    ])) AS is_accepted_status,
    (b.status = ANY (ARRAY['purchase_complete','check_request_submitted'])) AS is_closed
  FROM base b
),
agg AS (
  SELECT
    count(*) AS total_leads,
    count(*) FILTER (
      WHERE NOT is_closed AND status <> 'dead_lead'
        AND (offered_price IS NOT NULL OR is_accepted_status)
    ) AS active_deals,
    coalesce(sum(offered_price) FILTER (
      WHERE NOT is_closed AND status <> 'dead_lead'
        AND (offered_price IS NOT NULL OR is_accepted_status)
    ), 0) AS pipeline_value,
    count(*) FILTER (WHERE offered_price IS NOT NULL OR is_accepted_status) AS accepted,
    count(*) FILTER (WHERE needs_appraisal IS TRUE AND acv_value IS NULL) AS appraiser_queue
  FROM flags
),
by_status AS (
  SELECT coalesce(
    jsonb_agg(jsonb_build_object('status', status, 'n', n) ORDER BY n DESC),
    '[]'::jsonb
  ) AS arr
  FROM (SELECT status, count(*) AS n FROM base GROUP BY status) q
),
days AS (
  SELECT to_char(d, 'YYYY-MM-DD') AS day
  FROM generate_series(
    (now() AT TIME ZONE 'UTC')::date - 13,
    (now() AT TIME ZONE 'UTC')::date,
    interval '1 day'
  ) AS g(d)
),
trend AS (
  SELECT coalesce(
    jsonb_agg(jsonb_build_object('date', dd.day, 'leads', coalesce(c.n, 0)) ORDER BY dd.day),
    '[]'::jsonb
  ) AS arr
  FROM days dd
  LEFT JOIN (
    SELECT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, count(*) AS n
    FROM base
    GROUP BY 1
  ) c ON c.day = dd.day
)
SELECT jsonb_build_object(
  'total_leads',    agg.total_leads,
  'active_deals',   agg.active_deals,
  'pipeline_value', agg.pipeline_value,
  'accepted',       agg.accepted,
  'conversion_pct', CASE WHEN agg.total_leads > 0
                         THEN round(agg.accepted::numeric * 100 / agg.total_leads)
                         ELSE 0 END,
  'appraiser_queue', agg.appraiser_queue,
  'by_status',      by_status.arr,
  'trend',          trend.arr
)
FROM agg, by_status, trend;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_kpis(text, text) TO authenticated;

-- ── Rewards engine ──
CREATE TABLE IF NOT EXISTS public.reward_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  event_type    text NOT NULL,
  reward_type   text NOT NULL DEFAULT 'flat',
  amount        numeric NOT NULL DEFAULT 0,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reward_rules_dealer_event_uniq
  ON public.reward_rules (dealership_id, event_type);

CREATE TABLE IF NOT EXISTS public.reward_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  staff_email   text NOT NULL,
  event_type    text NOT NULL,
  amount        numeric NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'pending',
  source        text,
  reference_id  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  paid_at       timestamptz
);
CREATE INDEX IF NOT EXISTS reward_ledger_dealer_staff
  ON public.reward_ledger (dealership_id, staff_email);
CREATE INDEX IF NOT EXISTS reward_ledger_dealer_status
  ON public.reward_ledger (dealership_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_rules TO authenticated;
GRANT ALL ON public.reward_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_ledger TO authenticated;
GRANT ALL ON public.reward_ledger TO service_role;

ALTER TABLE public.reward_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read tenant reward_rules" ON public.reward_rules;
CREATE POLICY "Staff read tenant reward_rules"
  ON public.reward_rules FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Platform admins manage reward_rules" ON public.reward_rules;
CREATE POLICY "Platform admins manage reward_rules"
  ON public.reward_rules FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

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
                       WHEN sums.acq >= 3  THEN 6  - sums.acq
                       ELSE 3 - sums.acq END
)
FROM sums, by_event, rules;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_rewards(text) TO authenticated;

NOTIFY pgrst, 'reload schema';