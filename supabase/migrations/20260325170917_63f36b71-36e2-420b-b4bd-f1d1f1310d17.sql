
ALTER TABLE public.site_config 
  ADD COLUMN cta_offer_color text NOT NULL DEFAULT '',
  ADD COLUMN cta_accept_color text NOT NULL DEFAULT '';
