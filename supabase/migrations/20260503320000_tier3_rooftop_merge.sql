-- Sprint E — Rooftop-merge (acquisition flow).
--
-- Mirrors the rooftop-detach pattern from Tier 3.13. A platform
-- admin uses merge_rooftop() when a group acquires a rooftop from
-- another group (or absorbs a previously-independent dealership).
-- The function:
--   1. Records the operation in rooftop_detach_log (re-used as the
--      ledger; row.from_dealer_group_id = source, to = destination).
--   2. Sets dealer_accounts.dealer_group_id to the destination group.
--   3. Optionally creates a fresh rooftop_activations row in pilot
--      under the destination group so the acquisition gets a clean
--      30-day window in the new context.
--
-- Authorization: platform admins only.
--
-- IDEMPOTENT — function is CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.merge_rooftop(
  _dealership_id        text,
  _to_dealer_group_id   uuid,           -- destination group, NOT NULL
  _reason               text,
  _create_pilot         boolean DEFAULT true,
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
BEGIN
  caller_id := COALESCE(_performed_by_user_id, auth.uid());

  SELECT public.is_platform_admin(caller_id) INTO is_admin;
  IF NOT is_admin THEN
    RAISE EXCEPTION 'merge_rooftop requires platform-admin privileges';
  END IF;

  IF _to_dealer_group_id IS NULL THEN
    RAISE EXCEPTION 'merge_rooftop requires a destination group; use detach_rooftop to remove a rooftop from a group';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN
    RAISE EXCEPTION 'reason must be at least 10 characters';
  END IF;

  SELECT dealer_group_id INTO current_group
    FROM public.dealer_accounts
   WHERE dealership_id = _dealership_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'dealership % not found', _dealership_id;
  END IF;

  IF current_group IS NOT DISTINCT FROM _to_dealer_group_id THEN
    RAISE EXCEPTION 'rooftop is already in the target group';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dealer_groups WHERE id = _to_dealer_group_id AND status <> 'terminated'
  ) THEN
    RAISE EXCEPTION 'destination group % not found or terminated', _to_dealer_group_id;
  END IF;

  INSERT INTO public.rooftop_detach_log (
    dealership_id, from_dealer_group_id, to_dealer_group_id,
    performed_by_user_id, performed_by_email, reason, snapshot
  )
  VALUES (
    _dealership_id, current_group, _to_dealer_group_id,
    caller_id, _performed_by_email, _reason,
    jsonb_build_object('kind', 'merge', 'create_pilot', _create_pilot)
  )
  RETURNING id INTO log_id;

  -- Move the rooftop.
  UPDATE public.dealer_accounts
     SET dealer_group_id = _to_dealer_group_id,
         updated_at = now()
   WHERE dealership_id = _dealership_id;

  -- Terminate any active activations under the OLD group so the
  -- destination's pilot is the only live one. Caller is responsible
  -- for canceling the underlying Stripe subs first.
  UPDATE public.rooftop_activations
     SET status = 'terminated',
         deactivation_reason = COALESCE(deactivation_reason, _reason),
         deactivated_at = COALESCE(deactivated_at, now()),
         updated_at = now()
   WHERE dealership_id = _dealership_id
     AND dealer_group_id IS NOT DISTINCT FROM current_group
     AND status IN ('pilot','active');

  -- Optionally start a fresh pilot under the destination group.
  IF _create_pilot THEN
    INSERT INTO public.rooftop_activations (
      dealer_group_id, dealership_id, status,
      activated_at, pilot_ends_at, activated_by_user_id, notes
    )
    VALUES (
      _to_dealer_group_id, _dealership_id, 'pilot',
      now(), now() + interval '30 days', caller_id,
      'Pilot created via merge_rooftop. ' || _reason
    );
  END IF;

  PERFORM pg_notify('pgrst', 'reload schema');
  RETURN log_id;
END;
$$;

COMMENT ON FUNCTION public.merge_rooftop IS
  'Move a rooftop from one group (or independent) into a destination group. Records the operation in rooftop_detach_log. By default creates a fresh 30-day pilot under the destination — pass _create_pilot=false when continuing an existing billing arrangement.';

REVOKE ALL ON FUNCTION public.merge_rooftop FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_rooftop TO authenticated;

NOTIFY pgrst, 'reload schema';
