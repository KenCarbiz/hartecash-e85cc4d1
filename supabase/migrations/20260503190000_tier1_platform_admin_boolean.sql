-- Tier 1.1 — Replace the magic `dealership_id = 'default'` string with
-- an explicit `is_platform_admin` boolean on user_roles.
--
-- Today, public.is_platform_admin(_user_id) tests:
--
--     role = 'admin' AND dealership_id = 'default'
--
-- That means anyone whose user_roles row carries the literal string
-- 'default' as their dealership_id becomes a platform super-admin —
-- and 33 tables in this schema have `dealership_id text NOT NULL
-- DEFAULT 'default'`. Any insert that forgets to set dealership_id
-- silently grants platform-admin if the role is also 'admin'. The
-- May-2026 multi-tenant audit flagged this as the single biggest
-- scaling-time security footgun.
--
-- This migration:
--   1. Adds `is_platform_admin boolean NOT NULL DEFAULT false` to
--      public.user_roles.
--   2. Backfills it from the legacy condition so existing super
--      admins keep working without manual intervention.
--   3. Rewrites public.is_platform_admin(_user_id) to read the new
--      column. The legacy `dealership_id = 'default'` check is
--      retained as a fallback for one release so a missed backfill
--      doesn't lock anyone out — the next migration after this one
--      will drop the fallback once we've verified the column is the
--      sole source of truth in production.
--   4. Adds a defensive CHECK constraint that prevents `role <> 'admin'`
--      rows from setting is_platform_admin=true. Platform admin must
--      always also be an admin.
--   5. Adds a partial unique index that limits is_platform_admin=true
--      to one row per user_id (defense-in-depth against double-grant).
--
-- Migration is forward-compatible: every consumer of is_platform_admin()
-- (RLS policies on tenants / dealer_accounts / dealer_subscriptions /
-- platform_pricing_model / tenant_view_log etc.) calls the function,
-- not the magic string directly, so they all pick up the new logic
-- automatically.

-- ── 1. Add the column ───────────────────────────────────────────────────
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_roles.is_platform_admin IS
  'When true, this user has cross-tenant super-admin powers. Replaces the legacy convention of inferring super-admin from dealership_id = ''default''. Must coincide with role = ''admin''; enforced by check constraint user_roles_platform_admin_requires_admin_role.';

-- ── 2. Backfill from the legacy condition ───────────────────────────────
UPDATE public.user_roles
SET is_platform_admin = true
WHERE role = 'admin'::app_role
  AND dealership_id = 'default'
  AND is_platform_admin = false;

-- ── 3. Rewire the function ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::app_role
      AND (
        is_platform_admin = true
        -- Transitional fallback. Removed in the follow-up migration
        -- once the explicit boolean has been audited in production.
        OR dealership_id = 'default'
      )
  );
$$;

-- ── 4. Defensive constraint: platform admin requires admin role ────────
-- A row with is_platform_admin=true but role <> 'admin' is nonsense —
-- the SECURITY DEFINER function's WHERE clause would never include it
-- anyway, but a bad insert would leave a misleading row in the table.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_platform_admin_requires_admin_role;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_platform_admin_requires_admin_role
  CHECK (
    is_platform_admin = false
    OR role = 'admin'::app_role
  );

-- ── 5. Partial unique index ─────────────────────────────────────────────
-- A user should not have two rows that both flip is_platform_admin=true.
-- Existing schema lets one user_id appear in multiple user_roles rows
-- (one per dealership_id), so we restrict the uniqueness to platform-
-- admin rows only.
DROP INDEX IF EXISTS user_roles_one_platform_admin_per_user;
CREATE UNIQUE INDEX user_roles_one_platform_admin_per_user
  ON public.user_roles (user_id)
  WHERE is_platform_admin = true;

NOTIFY pgrst, 'reload schema';
