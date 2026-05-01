-- Security hardening — close two over-permissive RLS policies that were
-- never actually relied on by the public-facing app:
--
--   1. public.referrals "Anyone can read referral by code" — granted
--      anon a USING (true) SELECT on the entire row, exposing referrer
--      and referred names, emails, phones, and reward amounts. The only
--      anon write path is submissions.referral_code (a string column),
--      which doesn't need to read the referrals table. Staff continue
--      to read/write under the existing tenant-scoped policies.
--
--   2. public.opt_outs "Anyone can delete own opt-out by token" — was
--      USING (true) DELETE for public, meaning any anon could
--      *re-enable* marketing for an opted-out user just by guessing or
--      iterating the row id. Replace with a staff-only delete policy
--      gated on is_staff(auth.uid()) so compliance corrections still
--      work but unauthenticated callers cannot.
--
-- Idempotent — safe to apply against any DB state.

-- ── 1. Drop the anon SELECT on referrals ──────────────────────────────
DROP POLICY IF EXISTS "Anyone can read referral by code" ON public.referrals;

-- ── 2. Replace the anon DELETE on opt_outs with a staff-only policy ──
DROP POLICY IF EXISTS "Anyone can delete own opt-out by token" ON public.opt_outs;
DROP POLICY IF EXISTS "Staff can delete opt-outs" ON public.opt_outs;

CREATE POLICY "Staff can delete opt-outs"
  ON public.opt_outs
  FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

NOTIFY pgrst, 'reload schema';
