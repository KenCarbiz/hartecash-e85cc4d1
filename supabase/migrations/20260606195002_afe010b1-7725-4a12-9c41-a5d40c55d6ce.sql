
REVOKE SELECT (manager_pin_hash, manager_pin_set_at) ON public.profiles FROM anon, authenticated;

REVOKE SELECT (stripe_customer_id) ON public.tenants FROM anon, authenticated;

REVOKE SELECT (
  ai_auto_bump_enabled,
  ai_auto_bump_max_pct,
  ai_auto_bump_max_dollars,
  ai_auto_bump_daily_cap,
  ai_auto_bump_confidence_floor,
  ai_photo_reappraisal,
  embed_escalation_enabled,
  embed_escalation_max_tier,
  force_autocurb_attribution,
  auto_lock_offer_on_re_engagement,
  auto_route_appraiser_queue,
  track_abandoned_leads,
  assign_customer_picks,
  assign_auto_zip,
  assign_oem_brand_match,
  assign_buying_center,
  buying_center_location_id,
  demo_mode,
  demo_offer_amount
) ON public.site_config FROM anon;

REVOKE SELECT (ocr_pipeline) ON public.document_config FROM anon;

DROP POLICY IF EXISTS "Anyone can read active changelog entries" ON public.changelog_entries;
CREATE POLICY "Anyone can read active platform changelog"
  ON public.changelog_entries
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND dealership_id = 'default');

CREATE OR REPLACE FUNCTION public.is_staff_of(_user_id uuid, _dealership_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.dealership_id = _dealership_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_of(uuid, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
