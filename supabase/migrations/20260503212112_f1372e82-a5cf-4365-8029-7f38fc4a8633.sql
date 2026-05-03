-- Tier 1.2 — RLS heal
DROP POLICY IF EXISTS "Staff can read notification logs" ON public.notification_log;
CREATE POLICY "Staff can read notification logs"
  ON public.notification_log FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Staff can read subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can manage subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Dealers can read own subscription" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Platform admin can manage subscriptions" ON public.dealer_subscriptions;
CREATE POLICY "Dealers can read own subscription"
  ON public.dealer_subscriptions FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR dealership_id = public.get_user_dealership_id(auth.uid()));
CREATE POLICY "Platform admin can manage subscriptions"
  ON public.dealer_subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "pricing_model_select" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "pricing_model_insert" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "pricing_model_update" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can read pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can update pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can write pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Platform admin can write pricing model" ON public.platform_pricing_model;
CREATE POLICY "Anyone can read pricing model" ON public.platform_pricing_model FOR SELECT USING (true);
CREATE POLICY "Platform admin can write pricing model"
  ON public.platform_pricing_model FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- Tier 1.1 — is_platform_admin boolean
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;
UPDATE public.user_roles SET is_platform_admin = true
 WHERE role = 'admin'::app_role AND dealership_id = 'default' AND is_platform_admin = false;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::app_role
      AND (is_platform_admin = true OR dealership_id = 'default')
  );
$$;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_platform_admin_requires_admin_role;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_platform_admin_requires_admin_role
  CHECK (is_platform_admin = false OR role = 'admin'::app_role);

DROP INDEX IF EXISTS user_roles_one_platform_admin_per_user;
CREATE UNIQUE INDEX user_roles_one_platform_admin_per_user
  ON public.user_roles (user_id) WHERE is_platform_admin = true;

-- Tier 2.6 — Dealer groups foundation
CREATE TABLE IF NOT EXISTS public.dealer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  display_name text,
  parent_group_id uuid REFERENCES public.dealer_groups(id) ON DELETE SET NULL,
  primary_contact_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  billing_email text,
  master_msa_signed_at timestamptz,
  master_msa_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pilot','paused','terminated')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dealer_groups_no_self_parent CHECK (parent_group_id <> id)
);
CREATE INDEX IF NOT EXISTS dealer_groups_parent_idx ON public.dealer_groups (parent_group_id);
CREATE INDEX IF NOT EXISTS dealer_groups_status_idx ON public.dealer_groups (status) WHERE status <> 'terminated';

ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS dealer_group_id uuid REFERENCES public.dealer_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS dealer_accounts_dealer_group_id_idx ON public.dealer_accounts (dealer_group_id);

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS dealer_group_id uuid REFERENCES public.dealer_groups(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS user_roles_dealer_group_idx ON public.user_roles (dealer_group_id) WHERE dealer_group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.dealer_groups_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS dealer_groups_set_updated_at ON public.dealer_groups;
CREATE TRIGGER dealer_groups_set_updated_at BEFORE UPDATE ON public.dealer_groups
  FOR EACH ROW EXECUTE FUNCTION public.dealer_groups_set_updated_at();

CREATE OR REPLACE FUNCTION public.get_user_dealer_group_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT dealer_group_id FROM public.user_roles WHERE user_id = _user_id AND dealer_group_id IS NOT NULL LIMIT 1),
    (SELECT da.dealer_group_id FROM public.user_roles ur
       JOIN public.dealer_accounts da ON da.dealership_id = ur.dealership_id
      WHERE ur.user_id = _user_id AND da.dealer_group_id IS NOT NULL LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_dealer_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE ancestry AS (
    SELECT id, parent_group_id FROM public.dealer_groups WHERE id = _group_id
    UNION ALL
    SELECT g.id, g.parent_group_id FROM public.dealer_groups g
      JOIN ancestry a ON g.id = a.parent_group_id
  )
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
      JOIN ancestry a ON a.id = ur.dealer_group_id
     WHERE ur.user_id = _user_id AND ur.role = 'admin'::app_role
  );
$$;

ALTER TABLE public.dealer_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admin can manage dealer groups" ON public.dealer_groups;
CREATE POLICY "Platform admin can manage dealer groups" ON public.dealer_groups FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Group admins can read own group" ON public.dealer_groups;
CREATE POLICY "Group admins can read own group" ON public.dealer_groups FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_dealer_group_admin(auth.uid(), id)
    OR id = public.get_user_dealer_group_id(auth.uid())
  );

-- Tier 2.7 — store_location_id backfills
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS store_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS appointments_dealership_location_idx ON public.appointments (dealership_id, store_location_id);

UPDATE public.appointments a SET store_location_id = l.id
  FROM public.dealership_locations l
 WHERE a.store_location_id IS NULL AND a.store_location IS NOT NULL AND a.store_location <> ''
   AND l.dealership_id = a.dealership_id AND lower(l.name) = lower(a.store_location);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='follow_ups') THEN
    EXECUTE 'ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS store_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS follow_ups_dealership_location_idx ON public.follow_ups (dealership_id, store_location_id)';
    EXECUTE 'UPDATE public.follow_ups f SET store_location_id = s.store_location_id FROM public.submissions s
              WHERE f.store_location_id IS NULL AND f.submission_id IS NOT NULL AND f.submission_id = s.id AND s.store_location_id IS NOT NULL';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='consent_log') THEN
    EXECUTE 'ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS store_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS consent_log_dealership_location_idx ON public.consent_log (dealership_id, store_location_id)';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='consent_log' AND column_name='submission_id') THEN
      EXECUTE 'UPDATE public.consent_log c SET store_location_id = s.store_location_id FROM public.submissions s
                WHERE c.store_location_id IS NULL AND c.submission_id = s.id AND s.store_location_id IS NOT NULL';
    END IF;
  END IF;
END $$;

ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS store_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS notification_log_dealership_location_idx ON public.notification_log (dealership_id, store_location_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification_log' AND column_name='submission_id') THEN
    EXECUTE 'UPDATE public.notification_log n SET store_location_id = s.store_location_id FROM public.submissions s
              WHERE n.store_location_id IS NULL AND n.submission_id = s.id AND s.store_location_id IS NOT NULL';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='voice_call_log') THEN
    EXECUTE 'ALTER TABLE public.voice_call_log ADD COLUMN IF NOT EXISTS store_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS voice_call_log_dealership_location_idx ON public.voice_call_log (dealership_id, store_location_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='damage_reports') THEN
    EXECUTE 'ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS store_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS damage_reports_dealership_location_idx ON public.damage_reports (dealership_id, store_location_id)';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='damage_reports' AND column_name='submission_id') THEN
      EXECUTE 'UPDATE public.damage_reports d SET store_location_id = s.store_location_id FROM public.submissions s
                WHERE d.store_location_id IS NULL AND d.submission_id = s.id AND s.store_location_id IS NOT NULL';
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='voice_campaigns') THEN
    EXECUTE 'ALTER TABLE public.voice_campaigns ADD COLUMN IF NOT EXISTS store_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS voice_campaigns_dealership_location_idx ON public.voice_campaigns (dealership_id, store_location_id)';
  END IF;
END $$;

-- Billing 1
ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS dealer_subscriptions_stripe_subscription_id_uniq
  ON public.dealer_subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dealer_subscriptions_stripe_customer_idx
  ON public.dealer_subscriptions (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    EXECUTE 'ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_customer_id text';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_customer_id_uniq ON public.tenants (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  livemode boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  summary text
);
CREATE INDEX IF NOT EXISTS stripe_events_received_at_idx ON public.stripe_events (received_at DESC);
CREATE INDEX IF NOT EXISTS stripe_events_type_idx ON public.stripe_events (type);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admin can read stripe events" ON public.stripe_events;
CREATE POLICY "Platform admin can read stripe events" ON public.stripe_events FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Tier 2.10 rooftop_activations
CREATE TABLE IF NOT EXISTS public.rooftop_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_group_id uuid NOT NULL REFERENCES public.dealer_groups(id) ON DELETE CASCADE,
  dealership_id text NOT NULL,
  location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pilot' CHECK (status IN ('pilot','active','deactivated','terminated')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  pilot_ends_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  deactivated_at timestamptz,
  deactivation_reason text,
  stripe_subscription_id text,
  activated_by_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rooftop_activations_one_active_per_tuple
  ON public.rooftop_activations (dealer_group_id, dealership_id, COALESCE(location_id::text, ''))
  WHERE status IN ('pilot','active');
CREATE INDEX IF NOT EXISTS rooftop_activations_dealer_group_idx ON public.rooftop_activations (dealer_group_id);
CREATE INDEX IF NOT EXISTS rooftop_activations_dealership_idx ON public.rooftop_activations (dealership_id);
CREATE INDEX IF NOT EXISTS rooftop_activations_status_idx ON public.rooftop_activations (status) WHERE status IN ('pilot','active');
CREATE UNIQUE INDEX IF NOT EXISTS rooftop_activations_stripe_subscription_uniq
  ON public.rooftop_activations (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rooftop_activations_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS rooftop_activations_set_updated_at ON public.rooftop_activations;
CREATE TRIGGER rooftop_activations_set_updated_at BEFORE UPDATE ON public.rooftop_activations
  FOR EACH ROW EXECUTE FUNCTION public.rooftop_activations_set_updated_at();

ALTER TABLE public.dealer_subscriptions ADD COLUMN IF NOT EXISTS rooftop_activation_id uuid REFERENCES public.rooftop_activations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS dealer_subscriptions_rooftop_activation_idx ON public.dealer_subscriptions (rooftop_activation_id) WHERE rooftop_activation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.activation_in_pilot(_activation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.rooftop_activations WHERE id = _activation_id AND status='pilot' AND pilot_ends_at > now()); $$;

CREATE OR REPLACE FUNCTION public.expire_pilots()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE c integer; BEGIN
  UPDATE public.rooftop_activations SET status='active', updated_at=now()
   WHERE status='pilot' AND pilot_ends_at <= now();
  GET DIAGNOSTICS c = ROW_COUNT; RETURN c;
END; $$;

ALTER TABLE public.rooftop_activations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admin can manage activations" ON public.rooftop_activations;
CREATE POLICY "Platform admin can manage activations" ON public.rooftop_activations FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Group admins read own group activations" ON public.rooftop_activations;
CREATE POLICY "Group admins read own group activations" ON public.rooftop_activations FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_dealer_group_admin(auth.uid(), dealer_group_id)
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

-- Tier 3 provenance + data_egress_log
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['submissions','appointments','follow_ups','consent_log','damage_reports','voice_call_log','notification_log']) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS imported_from_dms text, ADD COLUMN IF NOT EXISTS imported_at timestamptz, ADD COLUMN IF NOT EXISTS legacy_id text;', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (imported_from_dms, imported_at) WHERE imported_from_dms IS NOT NULL;', t || '_provenance_idx', t);
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.data_egress_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  exported_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  exported_by_email text,
  export_kind text NOT NULL DEFAULT 'csv' CHECK (export_kind IN ('csv','json','archive','api')),
  table_names text[] NOT NULL DEFAULT '{}',
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  download_url text,
  expires_at timestamptz,
  file_bytes bigint,
  file_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed','expired')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_egress_log_dealership_idx ON public.data_egress_log (dealership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS data_egress_log_status_idx ON public.data_egress_log (status) WHERE status IN ('pending','ready');

CREATE OR REPLACE FUNCTION public.data_egress_log_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS data_egress_log_set_updated_at ON public.data_egress_log;
CREATE TRIGGER data_egress_log_set_updated_at BEFORE UPDATE ON public.data_egress_log
  FOR EACH ROW EXECUTE FUNCTION public.data_egress_log_set_updated_at();

ALTER TABLE public.data_egress_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admin can read all egress logs" ON public.data_egress_log;
CREATE POLICY "Platform admin can read all egress logs" ON public.data_egress_log FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Group admin can read group egress logs" ON public.data_egress_log;
CREATE POLICY "Group admin can read group egress logs" ON public.data_egress_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.dealer_accounts da
             WHERE da.dealership_id = data_egress_log.dealership_id
               AND da.dealer_group_id IS NOT NULL
               AND public.is_dealer_group_admin(auth.uid(), da.dealer_group_id))
  );
DROP POLICY IF EXISTS "Dealer admin can read own egress logs" ON public.data_egress_log;
CREATE POLICY "Dealer admin can read own egress logs" ON public.data_egress_log FOR SELECT TO authenticated
  USING (dealership_id = public.get_user_dealership_id(auth.uid()));

-- Tier 3.13 rooftop_detach_log + detach_rooftop()
CREATE TABLE IF NOT EXISTS public.rooftop_detach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  from_dealer_group_id uuid REFERENCES public.dealer_groups(id) ON DELETE SET NULL,
  to_dealer_group_id uuid REFERENCES public.dealer_groups(id) ON DELETE SET NULL,
  performed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_email text,
  reason text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooftop_detach_log_dealership_idx ON public.rooftop_detach_log (dealership_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS rooftop_detach_log_from_group_idx ON public.rooftop_detach_log (from_dealer_group_id, performed_at DESC) WHERE from_dealer_group_id IS NOT NULL;

ALTER TABLE public.rooftop_detach_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admin can manage detach log" ON public.rooftop_detach_log;
CREATE POLICY "Platform admin can manage detach log" ON public.rooftop_detach_log FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Group admin can read group detach history" ON public.rooftop_detach_log;
CREATE POLICY "Group admin can read group detach history" ON public.rooftop_detach_log FOR SELECT TO authenticated
  USING (
    (from_dealer_group_id IS NOT NULL AND public.is_dealer_group_admin(auth.uid(), from_dealer_group_id))
    OR (to_dealer_group_id IS NOT NULL AND public.is_dealer_group_admin(auth.uid(), to_dealer_group_id))
  );

CREATE OR REPLACE FUNCTION public.detach_rooftop(
  _dealership_id text, _to_dealer_group_id uuid, _reason text,
  _performed_by_user_id uuid DEFAULT NULL, _performed_by_email text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE caller_id uuid; is_admin boolean; current_group uuid; log_id uuid; active_count integer;
BEGIN
  caller_id := COALESCE(_performed_by_user_id, auth.uid());
  SELECT public.is_platform_admin(caller_id) INTO is_admin;
  IF NOT is_admin THEN RAISE EXCEPTION 'detach_rooftop requires platform-admin privileges'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN RAISE EXCEPTION 'reason must be at least 10 characters'; END IF;
  SELECT dealer_group_id INTO current_group FROM public.dealer_accounts WHERE dealership_id = _dealership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dealership % not found', _dealership_id; END IF;
  IF current_group IS NOT DISTINCT FROM _to_dealer_group_id THEN
    RAISE EXCEPTION 'rooftop is already in the target group (or both are NULL)'; END IF;
  WITH snap AS (
    SELECT jsonb_agg(jsonb_build_object('id', id, 'status', status, 'pilot_ends_at', pilot_ends_at, 'stripe_subscription_id', stripe_subscription_id)) AS j
    FROM public.rooftop_activations
    WHERE dealership_id = _dealership_id AND dealer_group_id IS NOT DISTINCT FROM current_group AND status IN ('pilot','active')
  )
  INSERT INTO public.rooftop_detach_log (dealership_id, from_dealer_group_id, to_dealer_group_id, performed_by_user_id, performed_by_email, reason, snapshot)
  SELECT _dealership_id, current_group, _to_dealer_group_id, caller_id, _performed_by_email, _reason, COALESCE((SELECT j FROM snap), '[]'::jsonb)
  RETURNING id INTO log_id;
  UPDATE public.dealer_accounts SET dealer_group_id = _to_dealer_group_id, updated_at = now() WHERE dealership_id = _dealership_id;
  UPDATE public.rooftop_activations SET status='terminated', deactivation_reason = COALESCE(deactivation_reason, _reason),
    deactivated_at = COALESCE(deactivated_at, now()), updated_at = now()
   WHERE dealership_id = _dealership_id AND dealer_group_id IS NOT DISTINCT FROM current_group AND status IN ('pilot','active');
  GET DIAGNOSTICS active_count = ROW_COUNT;
  PERFORM pg_notify('pgrst', 'reload schema');
  RETURN log_id;
END; $$;
REVOKE ALL ON FUNCTION public.detach_rooftop FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detach_rooftop TO authenticated;

-- Tier 3.15 state F&I
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS licensed_states text[];

CREATE OR REPLACE FUNCTION public.licensed_states_valid(_states text[])
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$
  SELECT _states IS NULL
      OR array_length(_states, 1) IS NULL
      OR NOT EXISTS (SELECT 1 FROM unnest(_states) AS s WHERE s !~ '^[A-Z]{2}$');
$$;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_licensed_states_format;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_licensed_states_format
  CHECK (public.licensed_states_valid(licensed_states));

CREATE INDEX IF NOT EXISTS user_roles_licensed_states_gin
  ON public.user_roles USING GIN (licensed_states) WHERE licensed_states IS NOT NULL;

CREATE OR REPLACE FUNCTION public.role_requires_state_license(_role text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT _role IN ('fi_manager','finance_manager','closer','gsm_gm','gm'); $$;

CREATE OR REPLACE FUNCTION public.can_act_in_state(_user_id uuid, _state text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH role_row AS (
    SELECT role::text AS role, licensed_states FROM public.user_roles WHERE user_id = _user_id LIMIT 1
  )
  SELECT public.is_platform_admin(_user_id)
      OR NOT EXISTS (SELECT 1 FROM role_row)
      OR (SELECT NOT public.role_requires_state_license(role) FROM role_row)
      OR (SELECT licensed_states IS NULL OR cardinality(licensed_states) = 0 FROM role_row)
      OR (SELECT _state = ANY(licensed_states) FROM role_row);
$$;

-- Cron schedule for expire_pilots
DO $$ BEGIN
  BEGIN PERFORM cron.unschedule('expire_rooftop_pilots'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
SELECT cron.schedule('expire_rooftop_pilots', '5 * * * *', $$ SELECT public.expire_pilots(); $$);

-- Tier 3.15 wiring: submissions
DROP POLICY IF EXISTS "Admins can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can update submissions in licensed states" ON public.submissions;
CREATE POLICY "Staff can update submissions in licensed states" ON public.submissions FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.can_act_in_state(auth.uid(), COALESCE(state, ''))))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.can_act_in_state(auth.uid(), COALESCE(state, ''))));

-- appointments policy
DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update appointments in licensed states" ON public.appointments;
CREATE POLICY "Staff can update appointments in licensed states" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR (public.is_staff(auth.uid()) AND public.can_act_in_state(auth.uid(),
    COALESCE((SELECT state FROM public.dealership_locations WHERE id = appointments.store_location_id), ''))))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR (public.is_staff(auth.uid()) AND public.can_act_in_state(auth.uid(),
    COALESCE((SELECT state FROM public.dealership_locations WHERE id = appointments.store_location_id), ''))));

-- group custom_domain
ALTER TABLE public.dealer_groups ADD COLUMN IF NOT EXISTS custom_domain text;
CREATE UNIQUE INDEX IF NOT EXISTS dealer_groups_custom_domain_uniq
  ON public.dealer_groups (custom_domain) WHERE custom_domain IS NOT NULL;

-- merge_rooftop()
CREATE OR REPLACE FUNCTION public.merge_rooftop(
  _dealership_id text, _to_dealer_group_id uuid, _reason text,
  _create_pilot boolean DEFAULT true,
  _performed_by_user_id uuid DEFAULT NULL, _performed_by_email text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE caller_id uuid; is_admin boolean; current_group uuid; log_id uuid;
BEGIN
  caller_id := COALESCE(_performed_by_user_id, auth.uid());
  SELECT public.is_platform_admin(caller_id) INTO is_admin;
  IF NOT is_admin THEN RAISE EXCEPTION 'merge_rooftop requires platform-admin privileges'; END IF;
  IF _to_dealer_group_id IS NULL THEN RAISE EXCEPTION 'merge_rooftop requires a destination group'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN RAISE EXCEPTION 'reason must be at least 10 characters'; END IF;
  SELECT dealer_group_id INTO current_group FROM public.dealer_accounts WHERE dealership_id = _dealership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dealership % not found', _dealership_id; END IF;
  IF current_group IS NOT DISTINCT FROM _to_dealer_group_id THEN RAISE EXCEPTION 'rooftop is already in the target group'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dealer_groups WHERE id = _to_dealer_group_id AND status <> 'terminated') THEN
    RAISE EXCEPTION 'destination group % not found or terminated', _to_dealer_group_id; END IF;
  INSERT INTO public.rooftop_detach_log (dealership_id, from_dealer_group_id, to_dealer_group_id, performed_by_user_id, performed_by_email, reason, snapshot)
  VALUES (_dealership_id, current_group, _to_dealer_group_id, caller_id, _performed_by_email, _reason, jsonb_build_object('kind','merge','create_pilot',_create_pilot))
  RETURNING id INTO log_id;
  UPDATE public.dealer_accounts SET dealer_group_id = _to_dealer_group_id, updated_at = now() WHERE dealership_id = _dealership_id;
  UPDATE public.rooftop_activations SET status='terminated', deactivation_reason = COALESCE(deactivation_reason, _reason),
    deactivated_at = COALESCE(deactivated_at, now()), updated_at = now()
   WHERE dealership_id = _dealership_id AND dealer_group_id IS NOT DISTINCT FROM current_group AND status IN ('pilot','active');
  IF _create_pilot THEN
    INSERT INTO public.rooftop_activations (dealer_group_id, dealership_id, status, activated_at, pilot_ends_at, activated_by_user_id, notes)
    VALUES (_to_dealer_group_id, _dealership_id, 'pilot', now(), now() + interval '30 days', caller_id, 'Pilot created via merge_rooftop. ' || _reason);
  END IF;
  PERFORM pg_notify('pgrst', 'reload schema');
  RETURN log_id;
END; $$;
REVOKE ALL ON FUNCTION public.merge_rooftop FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_rooftop TO authenticated;

NOTIFY pgrst, 'reload schema';