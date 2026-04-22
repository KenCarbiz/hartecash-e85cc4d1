
-- RPC function to get limited inspection data without auth
-- Uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.get_inspection_data(_submission_id uuid)
RETURNS TABLE (
  vehicle_year text,
  vehicle_make text,
  vehicle_model text,
  vin text,
  mileage text,
  exterior_color text,
  overall_condition text,
  ai_condition_score text,
  ai_damage_summary text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.vehicle_year,
    s.vehicle_make,
    s.vehicle_model,
    s.vin,
    s.mileage,
    s.exterior_color,
    s.overall_condition,
    s.ai_condition_score,
    s.ai_damage_summary
  FROM public.submissions s
  WHERE s.id = _submission_id;
$$;

-- RPC function to get damage items for inspection without auth
CREATE OR REPLACE FUNCTION public.get_inspection_damage(_submission_id uuid)
RETURNS TABLE (
  damage_items json
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.damage_items::json
  FROM public.damage_reports d
  WHERE d.submission_id = _submission_id;
$$;

-- RPC function to save inspection from mobile (no auth required)
CREATE OR REPLACE FUNCTION public.save_mobile_inspection(
  _submission_id uuid,
  _internal_notes text,
  _overall_condition text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.submissions
  SET 
    internal_notes = _internal_notes,
    overall_condition = COALESCE(_overall_condition, overall_condition)
  WHERE id = _submission_id;
END;
$$;
