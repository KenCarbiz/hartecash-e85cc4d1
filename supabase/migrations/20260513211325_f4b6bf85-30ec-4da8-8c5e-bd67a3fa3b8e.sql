-- Tenant-scoped Realtime channel authorization
-- Closes: any authenticated user could previously subscribe to another
-- tenant's submission updates by guessing the channel topic name.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_topic_select" ON realtime.messages;
CREATE POLICY "tenant_topic_select"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Platform-wide topic (pricing model) is intentionally global
    realtime.topic() = 'platform_pricing_model'
    -- Platform admins can listen anywhere
    OR public.is_platform_admin(auth.uid())
    -- Tenant-scoped topics must be prefixed with the caller's dealership_id
    OR realtime.topic() LIKE (public.get_user_dealership_id(auth.uid()) || ':%')
  );

-- Allow signed-in users to publish broadcasts/presence on the same
-- tenant-scoped topics. Without an INSERT policy, broadcast/presence
-- writes from staff would be blocked silently.
DROP POLICY IF EXISTS "tenant_topic_insert" ON realtime.messages;
CREATE POLICY "tenant_topic_insert"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() = 'platform_pricing_model'
    OR public.is_platform_admin(auth.uid())
    OR realtime.topic() LIKE (public.get_user_dealership_id(auth.uid()) || ':%')
  );

NOTIFY pgrst, 'reload schema';