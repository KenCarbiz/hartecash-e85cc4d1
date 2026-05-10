-- voice_call_log
DROP POLICY IF EXISTS "Staff can view call log"   ON public.voice_call_log;
DROP POLICY IF EXISTS "Service can insert calls"  ON public.voice_call_log;
DROP POLICY IF EXISTS "Service can update calls"  ON public.voice_call_log;
DROP POLICY IF EXISTS "Staff can insert call log" ON public.voice_call_log;
DROP POLICY IF EXISTS "Staff can update call log" ON public.voice_call_log;

CREATE POLICY "Staff can view call log"
  ON public.voice_call_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert call log"
  ON public.voice_call_log FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update call log"
  ON public.voice_call_log FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- voice_campaigns
DROP POLICY IF EXISTS "Staff can view campaigns"   ON public.voice_campaigns;
DROP POLICY IF EXISTS "Admin can manage campaigns" ON public.voice_campaigns;
CREATE POLICY "Staff can view campaigns"
  ON public.voice_campaigns FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin can manage campaigns"
  ON public.voice_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- voice_script_templates
DROP POLICY IF EXISTS "Anyone can read templates"  ON public.voice_script_templates;
DROP POLICY IF EXISTS "Admin can manage templates" ON public.voice_script_templates;
DROP POLICY IF EXISTS "Staff can read templates"   ON public.voice_script_templates;
CREATE POLICY "Staff can read templates"
  ON public.voice_script_templates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin can manage templates"
  ON public.voice_script_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- revaluation_log (only if the table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='revaluation_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Staff can view revaluation log" ON public.revaluation_log';
    EXECUTE 'DROP POLICY IF EXISTS "Service can insert revaluation" ON public.revaluation_log';
    EXECUTE 'DROP POLICY IF EXISTS "Staff can insert revaluation" ON public.revaluation_log';
    EXECUTE 'CREATE POLICY "Staff can view revaluation log" ON public.revaluation_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))';
    EXECUTE 'CREATE POLICY "Staff can insert revaluation" ON public.revaluation_log FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()))';
  END IF;
END $$;

-- dealer_subscriptions
DROP POLICY IF EXISTS "Staff can read subscriptions"   ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can manage subscriptions" ON public.dealer_subscriptions;
CREATE POLICY "Staff can read subscriptions"
  ON public.dealer_subscriptions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin can manage subscriptions"
  ON public.dealer_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- prospect_demos / prospect_demo_views (idempotent)
CREATE TABLE IF NOT EXISTS public.prospect_demos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token   text NOT NULL UNIQUE,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dealer_name   text,
  home_url      text,
  listing_url   text,
  vdp_url       text,
  home_screenshot    text,
  listing_screenshot text,
  vdp_screenshot     text,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  pitch_line    text,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospect_demos_share_token_idx ON public.prospect_demos(share_token);
CREATE INDEX IF NOT EXISTS prospect_demos_created_by_idx  ON public.prospect_demos(created_by);
CREATE INDEX IF NOT EXISTS prospect_demos_expires_at_idx  ON public.prospect_demos(expires_at);

CREATE TABLE IF NOT EXISTS public.prospect_demo_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id     uuid REFERENCES public.prospect_demos(id) ON DELETE CASCADE NOT NULL,
  visitor_hash text,
  user_agent   text,
  referrer     text,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospect_demo_views_demo_id_idx     ON public.prospect_demo_views(demo_id);
CREATE INDEX IF NOT EXISTS prospect_demo_views_occurred_at_idx ON public.prospect_demo_views(occurred_at);

ALTER TABLE public.prospect_demos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_demo_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can read prospect demos"   ON public.prospect_demos;
CREATE POLICY "Platform admins can read prospect demos"
ON public.prospect_demos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND dealership_id = 'default' AND role = 'admin'));

DROP POLICY IF EXISTS "Platform admins can insert prospect demos" ON public.prospect_demos;
CREATE POLICY "Platform admins can insert prospect demos"
ON public.prospect_demos FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND dealership_id = 'default' AND role = 'admin'));

DROP POLICY IF EXISTS "Platform admins can update prospect demos" ON public.prospect_demos;
CREATE POLICY "Platform admins can update prospect demos"
ON public.prospect_demos FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND dealership_id = 'default' AND role = 'admin'));

DROP POLICY IF EXISTS "Platform admins can delete prospect demos" ON public.prospect_demos;
CREATE POLICY "Platform admins can delete prospect demos"
ON public.prospect_demos FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND dealership_id = 'default' AND role = 'admin'));

DROP POLICY IF EXISTS "Anyone can log a demo view" ON public.prospect_demo_views;
CREATE POLICY "Anyone can log a demo view"
ON public.prospect_demo_views FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins can read demo views" ON public.prospect_demo_views;
CREATE POLICY "Platform admins can read demo views"
ON public.prospect_demo_views FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND dealership_id = 'default' AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.prospect_demos_set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospect_demos_updated_at ON public.prospect_demos;
CREATE TRIGGER prospect_demos_updated_at
BEFORE UPDATE ON public.prospect_demos
FOR EACH ROW EXECUTE FUNCTION public.prospect_demos_set_updated_at();

NOTIFY pgrst, 'reload schema';