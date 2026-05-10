-- This migration originally re-issued the prospect_demos / prospect_demo_views
-- schema that was already created by 20260428140000_prospect_demos.sql. As
-- written it would fail on `CREATE TABLE` whenever the prior migration had
-- already been applied — and per CLAUDE.md every migration must be
-- idempotent. Rewriting with IF NOT EXISTS / DROP POLICY IF EXISTS guards so
-- it is safe to re-apply or apply out of order with the earlier file.

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
