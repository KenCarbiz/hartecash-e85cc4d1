-- Sprint A — AutoCurb Basic / Premium tier split.
--
-- Product decision (May 2026): AutoCurb stays one product but gains
-- a Basic / Premium tier distinction:
--
--   Basic  = the existing AutoCurb stack without the AI Voice agent
--   Premium = Basic + AI Voice agent (Voice AI campaigns, voicemail
--            drop, in-customer-file voice transcripts, Bland.ai/OpenAI
--            voice automation)
--
-- The legacy single-tier id 'autocurb_standard' is renamed to "Basic"
-- in display only — the ID is preserved so existing Stripe Subscription
-- Items locked on autocurb_standard stay grandfathered. New Premium
-- subscriptions land on the new 'autocurb_premium' tier.
--
-- Pricing here is placeholder per the existing "platform admin can
-- override in SaaS Pricing manager" pattern. Adjust via the admin UI;
-- no code change needed.
--
-- IDEMPOTENT — UPDATE WHERE EXISTS / INSERT ON CONFLICT DO NOTHING.

-- ── 1. Rename existing tier to "Basic" + ensure correct sort_order ────
UPDATE public.platform_product_tiers
   SET name = 'Basic',
       description = 'Off-street vehicle acquisition — instant offers, inspections, appraisals, dealer dashboard. Includes the cadence engine and click-to-dial; voice automation requires Premium.',
       sort_order = 0,
       updated_at = now()
 WHERE id = 'autocurb_standard';

-- ── 2. Add new Premium tier ─────────────────────────────────────────────
INSERT INTO public.platform_product_tiers
  (id, product_id, name, description, monthly_price, annual_price,
   features, inventory_limit, included_with_product_ids, is_introductory,
   allow_overage, overage_price_per_unit, sort_order, is_active)
VALUES
  ('autocurb_premium', 'autocurb',
   'Premium',
   'Everything in Basic, plus the AI Voice agent — outbound campaigns, voicemail drop, on-call qualification, voice-call analytics, and full transcript history in every customer file.',
   2495.00, 22455.00,
   '["Everything in Basic","AI Voice agent — outbound campaigns","Voicemail drop fallback","On-call qualification + appointment-set","Voice call transcripts in customer file","Voice analytics: connect rate, talk time, outcomes","Concurrent-call atomic billing","Bland.ai or OpenAI Realtime provider"]'::jsonb,
   NULL, ARRAY[]::text[], false,
   false, NULL, 1, true)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      features = EXCLUDED.features,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active,
      updated_at = now();

NOTIFY pgrst, 'reload schema';
