-- ============================================================
-- Batched security hardening PR (3 logical sections, one file)
-- A) Drop legacy plaintext offer_settings.manager_pin column
-- B) Make get_user_dealership_id deterministic + enforce 1:1
-- C) Tighten dealer_subscriptions tenant isolation
-- ============================================================

-- ─── A. Drop legacy plaintext manager_pin ────────────────────
ALTER TABLE public.offer_settings DROP COLUMN IF EXISTS manager_pin;

-- ─── B. Deterministic get_user_dealership_id + UNIQUE ────────
-- NOTE: User-to-dealership is 1:1 by design as of 2026-05-13.
-- If multi-rooftop assignment ever becomes a product requirement,
-- drop the UNIQUE constraint below and add an `is_primary`
-- discriminator on user_roles BEFORE relaxing the helper —
-- otherwise get_user_dealership_id() will silently return
-- non-deterministic results and every tenant-scoped RLS policy
-- that depends on it will become a cross-tenant leak.
-- (user_roles has no created_at column, so we tiebreak using
-- is_platform_admin DESC then id ASC for stability.)
CREATE OR REPLACE FUNCTION public.get_user_dealership_id(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT dealership_id
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY is_platform_admin DESC, id ASC
  LIMIT 1;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_unique'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END$$;

-- ─── C. Subscriptions tenant isolation ───────────────────────
DROP POLICY IF EXISTS "Staff can read own subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Staff can read subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can manage subscriptions" ON public.dealer_subscriptions;

CREATE POLICY "Staff can read own subscriptions"
ON public.dealer_subscriptions
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    public.is_staff(auth.uid())
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

CREATE POLICY "Admin can manage subscriptions"
ON public.dealer_subscriptions
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';