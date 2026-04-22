
-- Step 1: Add column
ALTER TABLE public.submissions ADD COLUMN inspection_pin text 
  DEFAULT lpad(floor(random() * 10000)::text, 4, '0');

-- Step 2: Backfill
UPDATE public.submissions SET inspection_pin = lpad(floor(random() * 10000)::text, 4, '0');

-- Step 3: Drop old function
DROP FUNCTION IF EXISTS public.get_inspection_data(uuid);

-- Step 4: Recreate with PIN
CREATE FUNCTION public.get_inspection_data(_submission_id uuid)
RETURNS TABLE(vehicle_year text, vehicle_make text, vehicle_model text, vin text, mileage text, exterior_color text, overall_condition text, ai_condition_score text, ai_damage_summary text, inspection_pin text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.vehicle_year, s.vehicle_make, s.vehicle_model, s.vin, s.mileage,
    s.exterior_color, s.overall_condition, s.ai_condition_score, s.ai_damage_summary,
    s.inspection_pin
  FROM public.submissions s
  WHERE s.id = _submission_id;
$$;

-- Step 5: PIN verification RPC
CREATE FUNCTION public.verify_inspection_pin(_submission_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions
    WHERE id = _submission_id AND inspection_pin = _pin
  );
$$;
