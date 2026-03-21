ALTER TABLE public.dealership_locations
  ADD COLUMN address text DEFAULT '',
  ADD COLUMN show_in_footer boolean NOT NULL DEFAULT true,
  ADD COLUMN show_in_scheduling boolean NOT NULL DEFAULT true;