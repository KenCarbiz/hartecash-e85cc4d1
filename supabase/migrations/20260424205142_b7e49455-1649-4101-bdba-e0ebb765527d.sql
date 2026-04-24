ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ui_scale              integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS text_scale            integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS top_bar_style         text    DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS top_bar_bg            text    DEFAULT '#00407f',
  ADD COLUMN IF NOT EXISTS top_bar_bg_2          text    DEFAULT '#005bb5',
  ADD COLUMN IF NOT EXISTS top_bar_text          text    DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS top_bar_height        integer DEFAULT 64,
  ADD COLUMN IF NOT EXISTS top_bar_shimmer       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS top_bar_shimmer_style text    DEFAULT 'sheen',
  ADD COLUMN IF NOT EXISTS top_bar_shimmer_speed numeric DEFAULT 3.2,
  ADD COLUMN IF NOT EXISTS file_layout           text    DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS customer_file_accent  text    DEFAULT '#003b80',
  ADD COLUMN IF NOT EXISTS customer_file_accent_2 text   DEFAULT '#005bb5';