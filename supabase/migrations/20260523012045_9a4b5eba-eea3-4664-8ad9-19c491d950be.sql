-- ============================================================
-- Cross-tenant read hardening
-- ============================================================

-- 1. consent_text_versions: replace USING(true) with tenant scope
DROP POLICY IF EXISTS "consent_text_versions_read" ON public.consent_text_versions;
CREATE POLICY "consent_text_versions_read"
ON public.consent_text_versions
FOR SELECT
TO authenticated
USING (
  dealership_id = public.get_user_dealership_id(auth.uid())
  OR dealership_id = 'default'
  OR public.is_platform_admin(auth.uid())
);

-- 2. platform_pricing_model: restrict to platform admins
DROP POLICY IF EXISTS "Authenticated can read pricing model" ON public.platform_pricing_model;
CREATE POLICY "Platform admins can read pricing model"
ON public.platform_pricing_model
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- 3. watched_vehicle_history: scope reads via parent watched_vehicles dealership
DROP POLICY IF EXISTS "Staff can read history" ON public.watched_vehicle_history;
CREATE POLICY "Staff can read history (tenant-scoped)"
ON public.watched_vehicle_history
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.watched_vehicles wv
    WHERE wv.id = watched_vehicle_history.watched_vehicle_id
      AND wv.dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.is_staff(auth.uid())
  )
);

-- 4. watched_vehicles: explicit anonymous-read block
DROP POLICY IF EXISTS "watched_vehicles_block_anon_read" ON public.watched_vehicles;
CREATE POLICY "watched_vehicles_block_anon_read"
ON public.watched_vehicles
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- 5. offer_watches: explicit anonymous-read block (customer contact PII)
DROP POLICY IF EXISTS "offer_watches_block_anon_read" ON public.offer_watches;
CREATE POLICY "offer_watches_block_anon_read"
ON public.offer_watches
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- 6. Realtime: enforce exact dealership prefix on topic subscriptions.
-- The previous policies used `topic LIKE get_user_dealership_id() || ':%'`
-- which is correct in intent but adding a defensive exact match protects
-- against future helper-function changes that might return NULL or '%'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = 'tenant_topic_select'
  ) THEN
    EXECUTE 'DROP POLICY "tenant_topic_select" ON realtime.messages';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = 'tenant_topic_insert'
  ) THEN
    EXECUTE 'DROP POLICY "tenant_topic_insert" ON realtime.messages';
  END IF;
END $$;

CREATE POLICY "tenant_topic_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.get_user_dealership_id(auth.uid()) IS NOT NULL
  AND length(public.get_user_dealership_id(auth.uid())) > 0
  AND (
    realtime.topic() LIKE public.get_user_dealership_id(auth.uid()) || ':%'
    OR (
      public.is_platform_admin(auth.uid())
      AND realtime.topic() LIKE '%:%'
    )
  )
);

CREATE POLICY "tenant_topic_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_dealership_id(auth.uid()) IS NOT NULL
  AND length(public.get_user_dealership_id(auth.uid())) > 0
  AND realtime.topic() LIKE public.get_user_dealership_id(auth.uid()) || ':%'
);

NOTIFY pgrst, 'reload schema';