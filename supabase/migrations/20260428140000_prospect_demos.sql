-- Prospect Demo storage — saves a snapshot of a screenshot demo so the
-- Autocurb sales rep can text/email a public link to a prospect dealer.
-- The prospect clicks the link, sees a read-only preview of THEIR site
-- with our embed assets layered on, and (we hope) calls back.
--
-- Public read by share token; authenticated platform-admins write.
-- Tracks open events so reps know when a prospect viewed the demo.

CREATE TABLE public.prospect_demos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Public-facing shareable token (URL-safe, hard-to-guess). Reps share
  -- /demo/<share_token> with prospects; the public route reads by this.
  share_token   text NOT NULL UNIQUE,
  -- Who built the demo (the Autocurb rep). Used to credit opens.
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Free text — the dealer's display name as the rep typed it.
  dealer_name   text,
  -- Source URLs the rep entered.
  home_url      text,
  listing_url   text,
  vdp_url       text,
  -- Microlink screenshot URLs (these are public CDN links from microlink).
  home_screenshot    text,
  listing_screenshot text,
  vdp_screenshot     text,
  -- Embed config snapshot at moment-of-share. Shape mirrors the
  -- Prospect Demo form (button color, copy, sticky text, etc.) plus the
  -- list of active asset overlays. Stored as jsonb so we can extend
  -- without schema migrations.
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Optional one-line pitch from the LLM analysis.
  pitch_line    text,
  -- Soft-expiry (default 30 days). Rep can extend by re-saving.
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prospect_demos_share_token_idx ON public.prospect_demos(share_token);
CREATE INDEX prospect_demos_created_by_idx  ON public.prospect_demos(created_by);
CREATE INDEX prospect_demos_expires_at_idx  ON public.prospect_demos(expires_at);

-- Track every public view of a shared demo URL. Lets the rep see "this
-- prospect opened the demo at 4:13pm on Friday" — strong signal to call.
CREATE TABLE public.prospect_demo_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id     uuid REFERENCES public.prospect_demos(id) ON DELETE CASCADE NOT NULL,
  -- Hashed IP + UA so we can dedupe quickly without storing PII.
  visitor_hash text,
  -- Truncated UA string for "this was a desktop / mobile" surface.
  user_agent   text,
  -- Referrer if set (often null since most clicks come from email/SMS).
  referrer     text,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prospect_demo_views_demo_id_idx     ON public.prospect_demo_views(demo_id);
CREATE INDEX prospect_demo_views_occurred_at_idx ON public.prospect_demo_views(occurred_at);

-- ── Row Level Security ─────────────────────────────────────────────

ALTER TABLE public.prospect_demos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_demo_views ENABLE ROW LEVEL SECURITY;

-- prospect_demos:
--   - Public (anon) cannot SELECT directly. Demo viewing happens through
--     the get-prospect-demo edge function which uses the service role
--     and authenticates by share_token. This avoids exposing the full
--     row schema (incl. created_by) to anonymous viewers.
--   - Platform admins (Autocurb staff) can do anything. Other tenants
--     have no access — the Prospect Demo tool is internal.

CREATE POLICY "Platform admins can read prospect demos"
ON public.prospect_demos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND dealership_id = 'default'
      AND role = 'admin'
  )
);

CREATE POLICY "Platform admins can insert prospect demos"
ON public.prospect_demos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND dealership_id = 'default'
      AND role = 'admin'
  )
);

CREATE POLICY "Platform admins can update prospect demos"
ON public.prospect_demos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND dealership_id = 'default'
      AND role = 'admin'
  )
);

CREATE POLICY "Platform admins can delete prospect demos"
ON public.prospect_demos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND dealership_id = 'default'
      AND role = 'admin'
  )
);

-- prospect_demo_views:
--   - Anonymous can INSERT (the public demo page logs its own view).
--     The edge function hashes IP and inserts via service-role anyway,
--     but allowing direct anon inserts is a fallback for SSR/SPA.
--   - Platform admins can read all views.

CREATE POLICY "Anyone can log a demo view"
ON public.prospect_demo_views
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Platform admins can read demo views"
ON public.prospect_demo_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND dealership_id = 'default'
      AND role = 'admin'
  )
);

-- updated_at trigger so we know when a demo was last re-saved.
CREATE OR REPLACE FUNCTION public.prospect_demos_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER prospect_demos_updated_at
BEFORE UPDATE ON public.prospect_demos
FOR EACH ROW EXECUTE FUNCTION public.prospect_demos_set_updated_at();
