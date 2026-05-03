-- Tier 3.15 — Wire can_act_in_state() into submissions UPDATE policy.
--
-- The licensed_states column + can_act_in_state() helper landed in
-- 20260503260000_tier3_state_fi_scoping.sql. This migration is the
-- first per-table enforcement: an F&I-licensed user (fi_manager,
-- finance_manager, closer, gsm_gm, gm) can only UPDATE submissions
-- whose state matches one of their licensed_states (or whose
-- licensed_states is NULL/empty = unrestricted, back-compat).
--
-- Non-F&I roles (sales, BDC, inspector, receptionist, admin) bypass
-- the check via can_act_in_state's role_requires_state_license()
-- guard. Platform admins always pass.
--
-- This is the WRITE policy only. SELECT stays open per existing
-- dealership-scoped policies — F&I reps need to see leads outside
-- their states to refer / hand off.
--
-- IDEMPOTENT — DROP IF EXISTS / CREATE.

DROP POLICY IF EXISTS "Admins can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can update submissions in licensed states"
  ON public.submissions;

CREATE POLICY "Staff can update submissions in licensed states"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin')
      AND public.can_act_in_state(auth.uid(), COALESCE(state, ''))
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin')
      AND public.can_act_in_state(auth.uid(), COALESCE(state, ''))
    )
  );

COMMENT ON POLICY "Staff can update submissions in licensed states"
  ON public.submissions IS
  'Replaces the previous admin-only UPDATE policy with a state-licensing-aware version. F&I roles (fi_manager, finance_manager, closer, gsm_gm, gm) must have the submission''s state in user_roles.licensed_states. Other roles bypass the state check. Platform admins always pass. submissions with NULL state default to empty-string match — these will fail for licensed F&I users, which is the safer default.';

NOTIFY pgrst, 'reload schema';
