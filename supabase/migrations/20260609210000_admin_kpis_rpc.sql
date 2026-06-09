-- Admin V2 Command Center — exact, full-book KPI aggregates.
--
-- The V2 Command Center previously derived deal / pipeline / conversion
-- numbers from the currently-loaded leads page (a "recent snapshot").
-- This RPC computes them across the whole book of business so the
-- headline tiles are accurate without the client paging every row.
--
-- Security: SECURITY INVOKER (the default) — RLS on `submissions`
-- applies to the caller, so an admin only ever aggregates rows their
-- policies already let them read. The function mirrors the client's
-- own scoping: filter by dealership, and (for sales reps) by assigned
-- rep email. Both params come from the same values useAdminDashboard
-- uses for fetchSubmissions, so there is no behavioural drift.
--
-- Progressive enhancement: the V2 client falls back to the loaded-page
-- snapshot when this RPC is absent, so there is no deploy-order window —
-- the dashboard keeps working before this migration is applied and
-- upgrades to exact numbers once it is.
--
-- Idempotent (CREATE OR REPLACE). Migrations are NOT auto-applied on
-- merge in this project — apply manually (see CLAUDE.md).

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

NOTIFY pgrst, 'reload schema';
