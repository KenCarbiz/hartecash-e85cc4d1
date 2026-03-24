CREATE TABLE public.vehicle_image_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  vehicle_year text NOT NULL,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_style text,
  exterior_color text NOT NULL DEFAULT 'white',
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Public read so edge function (service role) and anon can check cache
ALTER TABLE public.vehicle_image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vehicle image cache"
  ON public.vehicle_image_cache FOR SELECT
  TO public USING (true);

CREATE POLICY "Service role can insert vehicle image cache"
  ON public.vehicle_image_cache FOR INSERT
  TO public WITH CHECK (true);

CREATE INDEX idx_vehicle_image_cache_key ON public.vehicle_image_cache (cache_key);