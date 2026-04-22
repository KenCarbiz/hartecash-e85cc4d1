
CREATE TABLE public.opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  channel text NOT NULL DEFAULT 'all',
  token text NOT NULL,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, channel),
  UNIQUE (phone, channel)
);

ALTER TABLE public.opt_outs ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (for unsubscribe links)
CREATE POLICY "Anyone can opt out" ON public.opt_outs
  FOR INSERT TO public WITH CHECK (true);

-- Staff can read opt-outs
CREATE POLICY "Staff can read opt-outs" ON public.opt_outs
  FOR SELECT TO public USING (is_staff(auth.uid()));

-- Service role can read (for edge functions)
CREATE POLICY "Service role can read opt-outs" ON public.opt_outs
  FOR SELECT TO anon USING (true);
