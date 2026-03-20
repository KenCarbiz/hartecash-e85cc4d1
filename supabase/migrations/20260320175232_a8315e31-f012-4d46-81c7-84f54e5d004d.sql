
CREATE POLICY "Anyone can delete own opt-out by token" ON public.opt_outs
  FOR DELETE TO public USING (true);
