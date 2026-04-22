-- PWA web-push subscriptions.
--
-- Each staff member can have multiple subscriptions (one per device +
-- browser — iPhone Safari + desktop Chrome + iPad home-screen PWA are
-- three distinct endpoints). When we send a push we iterate all active
-- subscriptions for the target user_id.
--
-- Each row maps one push endpoint to its decryption keys (p256dh and
-- auth). The endpoint URL is vendor-specific (fcm.googleapis.com for
-- Chrome, web.push.apple.com for Safari, etc.) — the web-push library
-- handles the protocol per vendor.
--
-- Stale endpoints (device deleted, app uninstalled, user revoked
-- permission) return 410 Gone from the vendor — the send function
-- flags those as stale so subsequent sends skip them. After 7 days
-- stale we clean up.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dealership_id text NOT NULL DEFAULT 'default',
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  -- Human label so staff can distinguish "iPhone 15" from "Office
  -- Chrome" when managing their subscriptions.
  device_label text,
  -- UA string for debugging — handy when a subscription silently
  -- stops delivering and we need to know what kind of client it was.
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.push_subscriptions IS
  'Web-push subscriptions (one per user+device+browser). Sends fan out across every active row for the target user.';

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS push_subscriptions_dealership_idx
  ON public.push_subscriptions (dealership_id, user_id)
  WHERE is_active = true;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Staff can manage only their own subscriptions.
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role sends — can read all to iterate recipients.
CREATE POLICY "Service role can read all push subscriptions"
  ON public.push_subscriptions
  FOR SELECT TO service_role
  USING (true);

NOTIFY pgrst, 'reload schema';
