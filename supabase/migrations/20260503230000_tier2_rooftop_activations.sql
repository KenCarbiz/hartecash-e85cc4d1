-- Tier 2.10 — Group MSA + per-rooftop activation workflow.
--
-- Audit recommendation: "One MSA per group, activate rooftops one-by-one,
-- 30-day pilot per rooftop with no penalty to deactivate. The antidote
-- to the multi-decade-contract complaint about CDK/Reynolds." This
-- migration introduces the data layer for that workflow.
--
-- Master MSA columns already exist on dealer_groups (Tier 2.6). This
-- migration adds:
--
--   1. rooftop_activations table — one row per (dealer_group, dealership)
--      pairing tracking activation state and the per-rooftop pilot window.
--      Optionally scoped further by location_id when a single dealership
--      has multiple stores under different activations (rare).
--
--   2. dealer_subscriptions.rooftop_activation_id FK so a Stripe
--      Subscription created via billing-activate-rooftop is linked
--      back to the activation row. The webhook updates both in lockstep.
--
--   3. RLS scoped to: platform admins (everything), group admins (all
--      activations beneath their group), dealership admins (only their
--      own row).
--
--   4. Helper functions:
--      - public.activation_in_pilot(activation_id) — true when status =
--        'pilot' AND pilot_ends_at > now(). Used by the deactivate edge
--        function to decide whether to issue a no-penalty cancel.
--      - public.expire_pilots() — cron-callable that promotes any pilot
--        whose pilot_ends_at has passed to 'active'.
--
-- IDEMPOTENT — IF NOT EXISTS guards on the table + columns + indexes.

-- ── 1. The rooftop_activations table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rooftop_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_group_id uuid NOT NULL
    REFERENCES public.dealer_groups(id) ON DELETE CASCADE,
  dealership_id text NOT NULL,
  -- Optional further scoping: when a single dealership has multiple
  -- locations beneath it and they need separate activation timelines.
  -- NULL = the activation is for the entire dealership.
  location_id uuid
    REFERENCES public.dealership_locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pilot'
    CHECK (status IN ('pilot', 'active', 'deactivated', 'terminated')),
  -- 30-day pilot window. activated_at is set by the activate edge fn;
  -- pilot_ends_at = activated_at + 30 days (computed client-side at
  -- insert; left as a stored column so dashboards can render the
  -- countdown without recomputing).
  activated_at timestamptz NOT NULL DEFAULT now(),
  pilot_ends_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  deactivated_at timestamptz,
  deactivation_reason text,
  -- Stripe linkage. Set by billing-activate-rooftop after the
  -- Subscription is created; cleared on hard deactivation.
  stripe_subscription_id text,
  -- Audit trail for who activated. NULL = activated by edge function
  -- without an authenticated caller (rare — usually super-admin script).
  activated_by_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One active activation per (dealer_group, dealership, location) tuple.
-- Past activations (status='deactivated' / 'terminated') don't block
-- a fresh activation — partial unique index is the right tool.
CREATE UNIQUE INDEX IF NOT EXISTS rooftop_activations_one_active_per_tuple
  ON public.rooftop_activations (dealer_group_id, dealership_id, COALESCE(location_id::text, ''))
  WHERE status IN ('pilot', 'active');

CREATE INDEX IF NOT EXISTS rooftop_activations_dealer_group_idx
  ON public.rooftop_activations (dealer_group_id);

CREATE INDEX IF NOT EXISTS rooftop_activations_dealership_idx
  ON public.rooftop_activations (dealership_id);

CREATE INDEX IF NOT EXISTS rooftop_activations_status_idx
  ON public.rooftop_activations (status)
  WHERE status IN ('pilot', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS rooftop_activations_stripe_subscription_uniq
  ON public.rooftop_activations (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON TABLE public.rooftop_activations IS
  'Per-rooftop activation under a dealer_groups parent MSA. Each activation has a 30-day pilot window during which deactivation is free. After pilot, normal Stripe cancellation rules (cancel-at-period-end) apply. One row per dealership (and optionally per location) per group; deactivated rows stay for audit.';

-- ── 2. updated_at trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rooftop_activations_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooftop_activations_set_updated_at ON public.rooftop_activations;
CREATE TRIGGER rooftop_activations_set_updated_at
  BEFORE UPDATE ON public.rooftop_activations
  FOR EACH ROW
  EXECUTE FUNCTION public.rooftop_activations_set_updated_at();

-- ── 3. dealer_subscriptions.rooftop_activation_id ───────────────────────
ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS rooftop_activation_id uuid
    REFERENCES public.rooftop_activations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dealer_subscriptions_rooftop_activation_idx
  ON public.dealer_subscriptions (rooftop_activation_id)
  WHERE rooftop_activation_id IS NOT NULL;

COMMENT ON COLUMN public.dealer_subscriptions.rooftop_activation_id IS
  'When set, this subscription was created via billing-activate-rooftop under a group MSA. The activation row tracks the pilot window and the deactivation history; this column is the back-pointer.';

-- ── 4. Helper functions ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.activation_in_pilot(_activation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.rooftop_activations
     WHERE id = _activation_id
       AND status = 'pilot'
       AND pilot_ends_at > now()
  );
$$;

COMMENT ON FUNCTION public.activation_in_pilot IS
  'Returns true when the activation is still inside its 30-day pilot window. The deactivate edge function uses this to decide between no-penalty immediate cancellation (during pilot) and cancel-at-period-end (after pilot).';

-- Promote any pilot whose pilot_ends_at has passed to 'active'. Wire to
-- pg_cron in a follow-up migration once the cadence-tick cron pattern
-- is stable. Safe to call ad-hoc from a one-off admin script too.
CREATE OR REPLACE FUNCTION public.expire_pilots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promoted_count integer;
BEGIN
  UPDATE public.rooftop_activations
     SET status = 'active',
         updated_at = now()
   WHERE status = 'pilot'
     AND pilot_ends_at <= now();
  GET DIAGNOSTICS promoted_count = ROW_COUNT;
  RETURN promoted_count;
END;
$$;

-- ── 5. RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.rooftop_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin can manage activations" ON public.rooftop_activations;
CREATE POLICY "Platform admin can manage activations"
  ON public.rooftop_activations FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admins read own group activations" ON public.rooftop_activations;
CREATE POLICY "Group admins read own group activations"
  ON public.rooftop_activations FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_dealer_group_admin(auth.uid(), dealer_group_id)
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
