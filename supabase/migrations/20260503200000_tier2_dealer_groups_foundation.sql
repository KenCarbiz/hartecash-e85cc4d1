-- Tier 2.6 — Dealer Groups foundation.
--
-- Today the schema has only two levels: dealership (text id) and
-- dealership_locations. dealer_accounts.architecture = 'dealer_group'
-- is just a label — there is no dealer_groups table, no parent FK,
-- no group-level admins, no group billing. The May-2026 multi-tenant
-- audit identified this as the single biggest gap to addressing the
-- 3-100 rooftop ICP.
--
-- This migration introduces the foundation only. Subsequent migrations
-- in this tier will:
--   - re-key dealer_subscriptions on (dealer_group_id, dealership_id)
--   - add group-level RLS to existing tables (one targeted pass per table)
--   - add group-aware role-permission cascade
--   - rooftop-detach / rooftop-merge stored procedures
--
-- Self-referential parent_group_id supports Tekion/Penske-style depth
-- (Group → Region → Brand → Rooftop). Most dealers will only use the
-- top level; the column is nullable so single-level usage is friction-free.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. The dealer_groups table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dealer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Internal short identifier — used in slugs, audit trails, and as a
  -- foreign key from dealer_accounts. Lowercase, hyphenated.
  slug text UNIQUE NOT NULL,
  -- Customer-facing names.
  name text NOT NULL,
  display_name text,
  -- Self-reference for arbitrary-depth org trees (Tekion pattern).
  -- NULL = top-level group. The check constraint below blocks direct
  -- self-parenting; deeper cycles are blocked at the application layer.
  parent_group_id uuid REFERENCES public.dealer_groups(id) ON DELETE SET NULL,
  -- Group-level contacts + billing identity.
  primary_contact_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  billing_email text,
  -- Master Service Agreement is signed at the group level; individual
  -- rooftops activate beneath it. This is the antidote to the
  -- multi-decade-contract complaint about CDK/Reynolds.
  master_msa_signed_at timestamptz,
  master_msa_url text,
  -- Operational status. Same enum as dealer_accounts to keep the
  -- group-vs-rooftop status reasoning consistent.
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pilot', 'paused', 'terminated')),
  -- Free-form notes for the platform-admin operator.
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dealer_groups_no_self_parent CHECK (parent_group_id <> id)
);

CREATE INDEX IF NOT EXISTS dealer_groups_parent_idx
  ON public.dealer_groups (parent_group_id);
CREATE INDEX IF NOT EXISTS dealer_groups_status_idx
  ON public.dealer_groups (status)
  WHERE status <> 'terminated';

COMMENT ON TABLE public.dealer_groups IS
  'Corporate parent above one or more dealerships. Supports arbitrary-depth org trees via parent_group_id self-reference (Tekion/Penske pattern). Hosts the master MSA that rooftops activate beneath.';

-- ── 2. dealer_group_id FK on dealer_accounts ────────────────────────────
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS dealer_group_id uuid
    REFERENCES public.dealer_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dealer_accounts_dealer_group_id_idx
  ON public.dealer_accounts (dealer_group_id);

COMMENT ON COLUMN public.dealer_accounts.dealer_group_id IS
  'When set, this dealership belongs to a dealer_groups parent. NULL = independent single-rooftop or multi-location dealer with no group above. Replaces the previous architecture=''dealer_group'' label-only approach.';

-- ── 3. dealer_group_id on user_roles (group-level admin role) ───────────
-- A group CFO / group IT / group HR can be granted admin rights at
-- the group level (sees all rooftops underneath) without needing a
-- per-rooftop user_roles row. dealership_id remains nullable when
-- dealer_group_id is set — the cascade resolver picks the broader
-- scope automatically.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS dealer_group_id uuid
    REFERENCES public.dealer_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_roles_dealer_group_idx
  ON public.user_roles (dealer_group_id)
  WHERE dealer_group_id IS NOT NULL;

COMMENT ON COLUMN public.user_roles.dealer_group_id IS
  'When set on an admin row, this user has cross-rooftop access scoped to the group. Distinct from is_platform_admin (which is cross-tenant) and dealership_id (which is single-rooftop).';

-- ── 4. updated_at trigger on dealer_groups ──────────────────────────────
CREATE OR REPLACE FUNCTION public.dealer_groups_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dealer_groups_set_updated_at ON public.dealer_groups;
CREATE TRIGGER dealer_groups_set_updated_at
  BEFORE UPDATE ON public.dealer_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.dealer_groups_set_updated_at();

-- ── 5. Helper functions ─────────────────────────────────────────────────

-- Resolve the dealer_group_id for a user. Priority:
--   1. Direct user_roles.dealer_group_id (group-level admin)
--   2. Indirect via the user's dealership → dealer_accounts.dealer_group_id
--   3. NULL when the user belongs to a dealership not in any group.
CREATE OR REPLACE FUNCTION public.get_user_dealer_group_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Direct group admin grant
    (SELECT dealer_group_id
       FROM public.user_roles
      WHERE user_id = _user_id
        AND dealer_group_id IS NOT NULL
      LIMIT 1),
    -- Inferred from dealership membership
    (SELECT da.dealer_group_id
       FROM public.user_roles ur
       JOIN public.dealer_accounts da ON da.dealership_id = ur.dealership_id
      WHERE ur.user_id = _user_id
        AND da.dealer_group_id IS NOT NULL
      LIMIT 1)
  );
$$;

-- Test whether a user has group-admin rights over a specific group
-- (or an ancestor of it). Used by RLS policies on group-scoped tables.
CREATE OR REPLACE FUNCTION public.is_dealer_group_admin(
  _user_id uuid,
  _group_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE ancestry AS (
    -- Start with the requested group itself
    SELECT id, parent_group_id FROM public.dealer_groups WHERE id = _group_id
    UNION ALL
    -- Walk up the parent chain (capped by Postgres's recursion guard)
    SELECT g.id, g.parent_group_id
      FROM public.dealer_groups g
      JOIN ancestry a ON g.id = a.parent_group_id
  )
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN ancestry a ON a.id = ur.dealer_group_id
     WHERE ur.user_id = _user_id
       AND ur.role = 'admin'::app_role
  );
$$;

-- ── 6. RLS on dealer_groups itself ──────────────────────────────────────
ALTER TABLE public.dealer_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin can manage dealer groups"
  ON public.dealer_groups;
CREATE POLICY "Platform admin can manage dealer groups"
  ON public.dealer_groups FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Group admins can read own group"
  ON public.dealer_groups;
CREATE POLICY "Group admins can read own group"
  ON public.dealer_groups FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_dealer_group_admin(auth.uid(), id)
    OR id = public.get_user_dealer_group_id(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
