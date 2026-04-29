-- Communication channel toggles per dealership and per location.
--
-- Lets a dealership admin (or platform admin) turn customer-facing
-- communication channels on/off without touching automated outbound
-- (drips, scheduled SMS, follow-up sequences). Two scopes:
--
--   1. tenant_channels    — group-level: applies to every store in the
--                           tenant unless overridden.
--   2. location_channels  — per-store override. NULL `enabled` =
--                           inherit from the tenant level.
--
-- Effective state for a (dealership_id, location_id, channel) tuple:
--   COALESCE(location_channels.enabled, tenant_channels.enabled, true)
--
-- v1 channels: two_way_sms, two_way_email, ai_phone_calls,
-- click_to_dial. Add new channels here AND in `channelKeys` in the
-- TS client to keep them visible in the Channels admin page.

CREATE TABLE IF NOT EXISTS public.tenant_channels (
  dealership_id text NOT NULL DEFAULT 'default',
  channel text NOT NULL CHECK (channel IN (
    'two_way_sms',
    'two_way_email',
    'ai_phone_calls',
    'click_to_dial'
  )),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (dealership_id, channel)
);

COMMENT ON TABLE public.tenant_channels IS
  'Group-level on/off toggle per communication channel per dealership. Defaults to true (enabled) for backwards compatibility.';

CREATE TABLE IF NOT EXISTS public.location_channels (
  location_id uuid NOT NULL REFERENCES public.dealership_locations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN (
    'two_way_sms',
    'two_way_email',
    'ai_phone_calls',
    'click_to_dial'
  )),
  enabled boolean,                 -- nullable: NULL means inherit
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (location_id, channel)
);

COMMENT ON TABLE public.location_channels IS
  'Per-location override for a communication channel. enabled=true → on, enabled=false → off, NULL → inherit from tenant_channels.';

CREATE INDEX IF NOT EXISTS location_channels_location_idx
  ON public.location_channels (location_id);

ALTER TABLE public.tenant_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_channels ENABLE ROW LEVEL SECURITY;

-- Tenant_channels: scoped read+write to the dealership's own admins or platform admins.
CREATE POLICY "Staff read own-tenant channels"
  ON public.tenant_channels FOR SELECT TO authenticated
  USING (
    dealership_id = public.get_user_dealership_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admin manage own-tenant channels"
  ON public.tenant_channels FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      dealership_id = public.get_user_dealership_id(auth.uid())
      OR public.get_user_dealership_id(auth.uid()) = 'default'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      dealership_id = public.get_user_dealership_id(auth.uid())
      OR public.get_user_dealership_id(auth.uid()) = 'default'
    )
  );

CREATE POLICY "Service role full tenant channels"
  ON public.tenant_channels FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Location_channels: same gating, walked through the location's tenant.
CREATE POLICY "Staff read own-tenant location channels"
  ON public.location_channels FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dealership_locations dl
      WHERE dl.id = location_channels.location_id
        AND (
          dl.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

CREATE POLICY "Admin manage own-tenant location channels"
  ON public.location_channels FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.dealership_locations dl
      WHERE dl.id = location_channels.location_id
        AND (
          dl.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.get_user_dealership_id(auth.uid()) = 'default'
        )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.dealership_locations dl
      WHERE dl.id = location_channels.location_id
        AND (
          dl.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.get_user_dealership_id(auth.uid()) = 'default'
        )
    )
  );

CREATE POLICY "Service role full location channels"
  ON public.location_channels FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Effective-state helper ─────────────────────────────────────────
-- Returns the merged channel state for a tenant + optional location.
-- Used by edge functions and the admin Channels page.
CREATE OR REPLACE FUNCTION public.channel_enabled(
  _dealership_id text,
  _location_id uuid,
  _channel text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.location_channels
       WHERE location_id = _location_id AND channel = _channel
       LIMIT 1),
    (SELECT enabled FROM public.tenant_channels
       WHERE dealership_id = _dealership_id AND channel = _channel
       LIMIT 1),
    true
  );
$$;

COMMENT ON FUNCTION public.channel_enabled(text, uuid, text) IS
  'Resolves the effective on/off state for a channel: per-location override → tenant default → true.';

-- ── Seed defaults: every existing tenant gets all channels enabled ─
INSERT INTO public.tenant_channels (dealership_id, channel, enabled)
SELECT DISTINCT t.dealership_id, c.channel, true
FROM (
  SELECT dealership_id FROM public.tenants
  UNION
  SELECT dealership_id FROM public.dealer_accounts
) t
CROSS JOIN (
  VALUES ('two_way_sms'), ('two_way_email'), ('ai_phone_calls'), ('click_to_dial')
) AS c(channel)
WHERE t.dealership_id IS NOT NULL
ON CONFLICT (dealership_id, channel) DO NOTHING;
