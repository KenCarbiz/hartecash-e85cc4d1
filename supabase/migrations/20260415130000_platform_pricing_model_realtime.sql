-- Enable Supabase realtime replication on the pricing-model row so
-- admin saves propagate live to every open pricing picker
-- (DealerOnboarding, PricingPlanPicker in Billing & Plan).
--
-- Without this, the picker only picks up edits on mount/refresh.

ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_pricing_model;

-- Belt-and-suspenders: ensure full row data is shipped on updates so
-- the client can apply `.new` directly without re-fetching.
ALTER TABLE public.platform_pricing_model REPLICA IDENTITY FULL;
