
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS bb_msrp numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_class_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_drivetrain text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_transmission text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_fuel_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_engine text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_mileage_adj numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_regional_adj numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_base_whole_avg numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_retail_avg numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bb_add_deducts jsonb DEFAULT NULL;

ALTER TABLE public.offer_settings
ADD COLUMN IF NOT EXISTS regional_adjustment_pct numeric NOT NULL DEFAULT 0;
