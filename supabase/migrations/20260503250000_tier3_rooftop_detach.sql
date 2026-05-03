-- Tier 3.13 — Rooftop-detach as a first-class operation.
--
-- Audit insight: dealer groups buy and sell rooftops constantly.
-- Lithia tripled from 154 to 455 stores 2016-2024. When a group sells
-- a rooftop, that rooftop's customer/lead/inspection history is the
-- ROOFTOP'S property, not the group's. The departing rooftop must be
-- able to take its data with it and start fresh under a new tenant —
-- and the group must be able to drop the rooftop from its dashboards
-- the same day.
--
-- This migration:
--   1. Adds a rooftop_detach_log table tracking every detach
--      operation for audit. A detach is non-reversible (acquisitions
--      can be undone, detaches typically cannot) so we keep a full
--      ledger.
--   2. Adds a SECURITY DEFINER function detach_rooftop(_dealership_id,
--      _new_dealer_group_id, _reason) that:
--        a. records the operation in rooftop_detach_log
--        b. deactivates any in-flight rooftop_activations under the
--           old group
--        c. moves the rooftop to a new group (NULL = independent)
--        d. NOTIFY pgrst so the cache picks up the new group ownership
--      This function is the API for the admin UI; it does NOT mutate
--      the underlying customer/lead data — that stays where it is,
--      keyed on the unchanged dealership_id, and continues to be
--      readable by the now-detached dealership's own admins.
--   3. Authorization: platform admins only. Group admins of either
--      the source or destination group must work through a platform
--      admin. This is intentional: rooftop detach is a high-stakes
--      legal-and-financial operation, not a self-service feature.
--
-- IDEMPOTENT — table + function are CREATE IF NOT EXISTS / CREATE OR
-- REPLACE.

-- ── 1. The audit log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rooftop_detach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  -- nullable: detaching to "independent" / no group is a valid endpoint.
  from_dealer_group_id uuid REFERENCES public.dealer_groups(id) ON DELETE SET NULL,
  to_dealer_group_id   uuid REFERENCES public.dealer_groups(id) ON DELETE SET NULL,
  -- Operator + when.
  performed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_email text,
  reason text NOT NULL,
  -- Snapshot of the rooftop's activation state at detach time so a
  -- future audit can answer "what did this rooftop have when it left?"
  -- without depending on the now-mutated rooftop_activations table.
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rooftop_detach_log_dealership_idx
  ON public.rooftop_detach_log (dealership_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS rooftop_detach_log_from_group_idx
  ON public.rooftop_detach_log (from_dealer_group_id, performed_at DESC)
  WHERE from_dealer_group_id IS NOT NULL;

ALTER TABLE public.rooftop_detach_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin can manage detach log" ON public.rooftop_detach_log;
CREATE POLICY "Platform admin can manage detach log"
  ON public.rooftop_detach_log FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admin can read group detach history" ON public.rooftop_detach_log;
CREATE POLICY "Group admin can read group detach history"
  ON public.rooftop_detach_log FOR SELECT
  TO authenticated
  USING (
    (from_dealer_group_id IS NOT NULL AND public.is_dealer_group_admin(auth.uid(), from_dealer_group_id))
    OR (to_dealer_group_id IS NOT NULL AND public.is_dealer_group_admin(auth.uid(), to_dealer_group_id))
  );

COMMENT ON TABLE public.rooftop_detach_log IS
  'Audit ledger of rooftop detach operations. Each detach moves a dealership from one group to another (or to independent). Customer/lead history stays on the dealership_id; only the group attribution changes.';

-- ── 2. The detach function ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.detach_rooftop(
  _dealership_id        text,
  _to_dealer_group_id   uuid,           -- NULL = detach to independent
  _reason               text,
  _performed_by_user_id uuid DEFAULT NULL,
  _performed_by_email   text DEFAULT NULL
)
RETURNS uuid                            -- the rooftop_detach_log row id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  is_admin  boolean;
  current_group uuid;
  log_id uuid;
  active_count integer;
BEGIN
  caller_id := COALESCE(_performed_by_user_id, auth.uid());

  -- Authorization. Platform admins only. Even though the function is
  -- SECURITY DEFINER, we explicitly re-check is_platform_admin so the
  -- function is safe to grant EXECUTE on more broadly later.
  SELECT public.is_platform_admin(caller_id) INTO is_admin;
  IF NOT is_admin THEN
    RAISE EXCEPTION 'detach_rooftop requires platform-admin privileges';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN
    RAISE EXCEPTION 'reason must be at least 10 characters';
  END IF;

  -- Pull current state.
  SELECT dealer_group_id INTO current_group
    FROM public.dealer_accounts
   WHERE dealership_id = _dealership_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'dealership % not found', _dealership_id;
  END IF;

  -- Refuse trivial detach (no-op).
  IF current_group IS NOT DISTINCT FROM _to_dealer_group_id THEN
    RAISE EXCEPTION 'rooftop is already in the target group (or both are NULL)';
  END IF;

  -- Snapshot active activations under the source group for the audit row.
  WITH snap AS (
    SELECT jsonb_agg(
             jsonb_build_object(
               'id', id,
               'status', status,
               'pilot_ends_at', pilot_ends_at,
               'stripe_subscription_id', stripe_subscription_id
             )
           ) AS j
      FROM public.rooftop_activations
     WHERE dealership_id = _dealership_id
       AND dealer_group_id IS NOT DISTINCT FROM current_group
       AND status IN ('pilot','active')
  )
  INSERT INTO public.rooftop_detach_log (
    dealership_id, from_dealer_group_id, to_dealer_group_id,
    performed_by_user_id, performed_by_email, reason, snapshot
  )
  SELECT
    _dealership_id, current_group, _to_dealer_group_id,
    caller_id, _performed_by_email, _reason,
    COALESCE((SELECT j FROM snap), '[]'::jsonb)
  RETURNING id INTO log_id;

  -- Move the dealership.
  UPDATE public.dealer_accounts
     SET dealer_group_id = _to_dealer_group_id,
         updated_at = now()
   WHERE dealership_id = _dealership_id;

  -- Mark active activations under the OLD group as terminated. The
  -- caller is responsible for canceling the underlying Stripe
  -- subscriptions via the billing-deactivate-rooftop edge function
  -- BEFORE calling detach_rooftop — this update is a safety net so
  -- the dashboard doesn't keep showing the rooftop as active under
  -- the source group after the detach.
  UPDATE public.rooftop_activations
     SET status = 'terminated',
         deactivation_reason = COALESCE(deactivation_reason, _reason),
         deactivated_at = COALESCE(deactivated_at, now()),
         updated_at = now()
   WHERE dealership_id = _dealership_id
     AND dealer_group_id IS NOT DISTINCT FROM current_group
     AND status IN ('pilot','active');

  GET DIAGNOSTICS active_count = ROW_COUNT;
  IF active_count > 0 THEN
    RAISE NOTICE
      'detach_rooftop terminated % active activation(s) under source group. Cancel matching Stripe subscriptions via billing-deactivate-rooftop.',
      active_count;
  END IF;

  PERFORM pg_notify('pgrst', 'reload schema');
  RETURN log_id;
END;
$$;

COMMENT ON FUNCTION public.detach_rooftop IS
  'Move a dealership from one group to another (or to independent). Records a snapshot of active activations in rooftop_detach_log. Caller MUST cancel underlying Stripe subscriptions via billing-deactivate-rooftop first; this function is safe-net for the data layer only.';

-- Restrict EXECUTE to platform admins only. SECURITY DEFINER means
-- the function runs as the migration owner, so we can be deliberate
-- about who can invoke it.
REVOKE ALL ON FUNCTION public.detach_rooftop FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detach_rooftop TO authenticated;
-- The function's first action re-checks is_platform_admin, so a
-- non-admin authenticated session simply receives the exception.

NOTIFY pgrst, 'reload schema';
