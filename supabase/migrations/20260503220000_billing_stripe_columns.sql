-- Billing 1 — Stripe sync columns + idempotency table.
--
-- We're consolidating onto Stripe-led billing. This migration prepares
-- the local schema so the billing-stripe-webhook handler can write
-- subscription state into dealer_subscriptions reliably:
--
--   1. Add stripe_customer_id, stripe_subscription_id, stripe_price_id,
--      current_period_end, cancel_at_period_end columns to
--      dealer_subscriptions. dealer_subscriptions becomes the local
--      cache of what Stripe says is true; the picker no longer writes
--      to it directly (the next migration relaxes its RLS to platform-
--      admin-only writes after the webhook is wired).
--
--   2. New stripe_events table for webhook idempotency. Stripe is at-
--      least-once; the webhook handler short-circuits on
--      already-processed event ids.
--
--   3. tenants.stripe_customer_id is referenced by the existing
--      billing-* edge functions. Add the column if it's not already
--      there so the new wiring can use the same surface.
--
-- Grandfathering: Stripe Subscriptions lock their Price ID at
-- creation. When prices are raised later, existing subscribers stay
-- on their original Price unless the platform admin migrates them
-- explicitly. This migration adds stripe_price_id so the dealer can
-- see "you're on the legacy $X plan" in the UI when they're behind
-- the current Price for their tier.
--
-- IDEMPOTENT — every column add is IF NOT EXISTS; the events table
-- uses CREATE TABLE IF NOT EXISTS.

-- ── 1. Stripe columns on dealer_subscriptions ───────────────────────────
ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS dealer_subscriptions_stripe_subscription_id_uniq
  ON public.dealer_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dealer_subscriptions_stripe_customer_idx
  ON public.dealer_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN public.dealer_subscriptions.stripe_subscription_id IS
  'Stripe Subscription id. When set, this row is a cache of Stripe state synced by billing-stripe-webhook. NULL = trial / pre-checkout / legacy seed.';

COMMENT ON COLUMN public.dealer_subscriptions.stripe_price_id IS
  'The Stripe Price id locked in at subscription creation. Grandfathering is automatic — when prices change, existing subscribers stay on their original Price until a platform admin migrates them.';

-- ── 2. tenants.stripe_customer_id ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    EXECUTE 'ALTER TABLE public.tenants
              ADD COLUMN IF NOT EXISTS stripe_customer_id text';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_customer_id_uniq
               ON public.tenants (stripe_customer_id)
               WHERE stripe_customer_id IS NOT NULL';
  END IF;
END $$;

COMMENT ON COLUMN public.tenants.stripe_customer_id IS
  'One Stripe Customer per tenant. Created lazily on first checkout via billing-checkout edge function. Used by billing-portal-session for the Customer Portal.';

-- ── 3. Webhook idempotency ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY, -- evt_... straight from Stripe
  type text NOT NULL,
  livemode boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  -- Lightweight payload reference for debugging. Don't store the full
  -- Stripe event blob — that's potentially sensitive and Stripe's
  -- dashboard already has it. We just keep the type + a short summary.
  summary text
);

CREATE INDEX IF NOT EXISTS stripe_events_received_at_idx
  ON public.stripe_events (received_at DESC);

CREATE INDEX IF NOT EXISTS stripe_events_type_idx
  ON public.stripe_events (type);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin can read stripe events" ON public.stripe_events;
CREATE POLICY "Platform admin can read stripe events"
  ON public.stripe_events FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Inserts come from the service-role webhook handler, which bypasses
-- RLS. No INSERT policy is needed for authenticated users.

COMMENT ON TABLE public.stripe_events IS
  'Idempotency log for Stripe webhook events. The webhook handler short-circuits on duplicate event ids — Stripe is at-least-once.';

NOTIFY pgrst, 'reload schema';
