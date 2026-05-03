-- Tier 3.15 — Per-state F&I user scoping.
--
-- Audit insight: "A finance manager licensed in TX cannot sign deals
-- in CA. Tenant model must enforce per-state user scoping. Legacy
-- DMS systems handle this by hoping; Autocurb should bake it in."
--
-- The model:
--   1. user_roles.licensed_states text[]  — null = unrestricted (admins,
--      sales, anyone whose role doesn't transact F&I). When non-null
--      and non-empty, the user can only act on deals/leads in one of
--      those states.
--   2. role_requires_state_license(role) — pure function that returns
--      true for F&I roles. Used by triggers/policies to decide when
--      the licensed_states check applies.
--   3. can_act_in_state(_user_id, _state) — SECURITY DEFINER predicate
--      RLS policies use to gate deal-related actions. Platform admins
--      and dealership admins always pass. Non-F&I roles always pass.
--      F&I roles must have the deal's state in their licensed_states.
--
-- Subsequent migrations / app code wires can_act_in_state() into:
--   - submissions WRITE policies (a TX-only F&I rep can't approve a
--     CA submission)
--   - the customer-file deal-completion buttons in the UI
--   - the offer-page sign-deal flow
--
-- This migration is the data layer + helper functions; per-table
-- enforcement is incremental and driven by where deals actually land.

-- ── 1. licensed_states column ───────────────────────────────────────────
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS licensed_states text[];

COMMENT ON COLUMN public.user_roles.licensed_states IS
  'Two-letter US state codes the user is licensed to transact F&I in. NULL or empty = unrestricted (the user does not transact F&I, or licensing is enforced elsewhere). Enforced by can_act_in_state() in RLS policies on deal-related tables.';

-- Defensive constraint: every entry must be a 2-letter uppercase code.
-- Postgres array CHECK is the simplest path here.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_licensed_states_format;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_licensed_states_format
  CHECK (
    licensed_states IS NULL
    OR (
      array_length(licensed_states, 1) IS NULL
      OR (
        SELECT bool_and(s ~ '^[A-Z]{2}$')
          FROM unnest(licensed_states) AS s
      )
    )
  );

-- Index for the common predicate "find users who can sign in CA".
CREATE INDEX IF NOT EXISTS user_roles_licensed_states_gin
  ON public.user_roles USING GIN (licensed_states)
  WHERE licensed_states IS NOT NULL;

-- ── 2. role_requires_state_license helper ──────────────────────────────
CREATE OR REPLACE FUNCTION public.role_requires_state_license(_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _role IN (
    'fi_manager',          -- F&I manager
    'finance_manager',     -- alias
    'closer',              -- F&I closer
    'gsm_gm',              -- general sales manager who signs deals
    'gm'                   -- general manager who signs deals
  );
$$;

COMMENT ON FUNCTION public.role_requires_state_license IS
  'Returns true for roles that legally need a state F&I license to transact. Other roles (sales, BDC, inspector, receptionist, admin) bypass the licensed_states check.';

-- ── 3. can_act_in_state predicate ──────────────────────────────────────
-- Used by RLS policies on submissions / appointments / deal-related
-- tables. Returns true when:
--   a. user is a platform admin, OR
--   b. user's role doesn't require state licensing, OR
--   c. user's licensed_states is NULL or empty (treated as unrestricted), OR
--   d. the requested state is in the user's licensed_states.
CREATE OR REPLACE FUNCTION public.can_act_in_state(
  _user_id uuid,
  _state text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH role_row AS (
    SELECT role::text AS role, licensed_states
      FROM public.user_roles
     WHERE user_id = _user_id
     LIMIT 1
  )
  SELECT
    -- Platform admin or no row found (super-admin in another tenant) → pass.
    public.is_platform_admin(_user_id)
    OR NOT EXISTS (SELECT 1 FROM role_row)
    -- Role doesn't require licensing → pass.
    OR (SELECT NOT public.role_requires_state_license(role) FROM role_row)
    -- No state restrictions on the user → pass.
    OR (SELECT licensed_states IS NULL OR cardinality(licensed_states) = 0 FROM role_row)
    -- The requested state is in the licensed list → pass.
    OR (SELECT _state = ANY(licensed_states) FROM role_row);
$$;

COMMENT ON FUNCTION public.can_act_in_state IS
  'RLS predicate: can this user act on a deal in this US state? Platform admins always pass. Non-F&I roles always pass. F&I roles with no licensed_states are treated as unrestricted (back-compat). F&I roles with a non-empty licensed_states must include the requested state.';

NOTIFY pgrst, 'reload schema';
