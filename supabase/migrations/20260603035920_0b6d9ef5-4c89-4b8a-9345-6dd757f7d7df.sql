
-- 1. analytics_events: restrict NULL dealership_id reads to platform admins
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analytics_events' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.analytics_events', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins read own-tenant analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND dealership_id IS NOT NULL
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
);

-- 2. error_log: restrict NULL dealership_id reads to platform admins
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'error_log' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.error_log', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins read own-tenant error logs"
ON public.error_log
FOR SELECT
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND dealership_id IS NOT NULL
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
);

-- 3. conversation_events: require staff role
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_events' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversation_events', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Staff read own-dealership conversation events"
ON public.conversation_events
FOR SELECT
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';
