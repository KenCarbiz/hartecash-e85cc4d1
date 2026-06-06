
-- Re-grant stripe_customer_id to authenticated only (admin TenantManagement uses select *)
GRANT SELECT (stripe_customer_id) ON public.tenants TO authenticated;

-- Restore anon SELECT on site_config internal columns (the public hook uses select *)
GRANT SELECT (
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
) ON public.site_config TO anon;

-- Restore anon SELECT on document_config.ocr_pipeline (customer upload hook uses select *)
GRANT SELECT (ocr_pipeline) ON public.document_config TO anon;

NOTIFY pgrst, 'reload schema';
