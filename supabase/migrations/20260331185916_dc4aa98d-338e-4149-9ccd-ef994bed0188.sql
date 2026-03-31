ALTER TABLE public.site_config
  ADD COLUMN photo_overlay_color text NOT NULL DEFAULT '#00FF88',
  ADD COLUMN photo_allow_color_change boolean NOT NULL DEFAULT true;