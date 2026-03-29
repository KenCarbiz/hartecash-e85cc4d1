
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS brake_lf integer,
  ADD COLUMN IF NOT EXISTS brake_rf integer,
  ADD COLUMN IF NOT EXISTS brake_lr integer,
  ADD COLUMN IF NOT EXISTS brake_rr integer;
