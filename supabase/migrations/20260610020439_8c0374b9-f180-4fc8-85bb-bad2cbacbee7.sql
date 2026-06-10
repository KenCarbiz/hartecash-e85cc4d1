-- Re-engagement targets RPC: server-side bucketing of saved offers for the
-- Admin V2 Re-engagement surface. Mirrors the client-side derivation but
-- authoritative and consistent across views.

CREATE OR REPLACE FUNCTION public.get_reengagement_targets(
  p_dealership_id uuid,
  p_reengage_window_days int DEFAULT 90,
  p_expiring_threshold_days int DEFAULT 3,
  p_limit int DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  token text,
  name text,
  vehicle_year text,
  vehicle_make text,
  vehicle_model text,
  offered_price numeric,
  progress_status text,
  status_updated_at timestamptz,
  created_at timestamptz,
  offer_expires_at timestamptz,
  days_left int,
  bucket text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Allow platform admins, or any staff bound to this dealership.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND (ur.dealership_id = p_dealership_id OR ur.dealership_id = 'default'::uuid OR ur.role = 'admin')
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized for this dealership';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.token,
      s.name,
      s.vehicle_year,
      s.vehicle_make,
      s.vehicle_model,
      s.offered_price,
      s.progress_status,
      s.status_updated_at,
      s.created_at,
      COALESCE(
        s.offer_expires_at,
        COALESCE(s.status_updated_at, s.created_at) + interval '8 days'
      ) AS eff_expires
    FROM public.submissions s
    WHERE s.dealership_id = p_dealership_id
      AND s.offered_price IS NOT NULL
      AND s.offered_price > 0
      AND s.progress_status NOT IN ('purchase_complete', 'dead_lead')
  ),
  scored AS (
    SELECT
      b.*,
      FLOOR(EXTRACT(EPOCH FROM (b.eff_expires - now())) / 86400)::int AS days_left_calc
    FROM base b
  )
  SELECT
    sc.id,
    sc.token,
    sc.name,
    sc.vehicle_year,
    sc.vehicle_make,
    sc.vehicle_model,
    sc.offered_price,
    sc.progress_status,
    sc.status_updated_at,
    sc.created_at,
    sc.eff_expires AS offer_expires_at,
    sc.days_left_calc AS days_left,
    CASE
      WHEN sc.days_left_calc >= 0 AND sc.days_left_calc <= p_expiring_threshold_days THEN 'expiring'
      WHEN sc.days_left_calc > p_expiring_threshold_days THEN 'active'
      WHEN sc.days_left_calc < 0 AND (-sc.days_left_calc) <= p_reengage_window_days THEN 'expired'
      ELSE 'stale'
    END AS bucket
  FROM scored sc
  WHERE
    (sc.days_left_calc >= -p_reengage_window_days)
  ORDER BY sc.status_updated_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_reengagement_targets(uuid, int, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_reengagement_targets(uuid, int, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reengagement_targets(uuid, int, int, int) TO service_role;

NOTIFY pgrst, 'reload schema';
