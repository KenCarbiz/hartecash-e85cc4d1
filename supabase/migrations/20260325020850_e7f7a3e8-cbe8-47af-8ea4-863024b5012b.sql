CREATE TABLE public.changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  items text[] NOT NULL DEFAULT '{}',
  icon text NOT NULL DEFAULT 'Sparkles',
  tag text NOT NULL DEFAULT 'feature',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active changelog entries"
  ON public.changelog_entries FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Staff can read all changelog entries"
  ON public.changelog_entries FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Admins can manage changelog entries"
  ON public.changelog_entries FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));