
-- Update save_mobile_inspection to accept brake depths
DROP FUNCTION IF EXISTS public.save_mobile_inspection(uuid, text, text, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.save_mobile_inspection(
  _submission_id uuid,
  _internal_notes text,
  _overall_condition text DEFAULT NULL,
  _tire_lf integer DEFAULT NULL,
  _tire_rf integer DEFAULT NULL,
  _tire_lr integer DEFAULT NULL,
  _tire_rr integer DEFAULT NULL,
  _brake_lf integer DEFAULT NULL,
  _brake_rf integer DEFAULT NULL,
  _brake_lr integer DEFAULT NULL,
  _brake_rr integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _config inspection_config%ROWTYPE;
  _mode text;
  _avg_depth numeric;
  _adjustment numeric := 0;
  _tires integer[];
  _t integer;
BEGIN
  UPDATE public.submissions
  SET 
    internal_notes = _internal_notes,
    overall_condition = COALESCE(_overall_condition, overall_condition),
    tire_lf = COALESCE(_tire_lf, tire_lf),
    tire_rf = COALESCE(_tire_rf, tire_rf),
    tire_lr = COALESCE(_tire_lr, tire_lr),
    tire_rr = COALESCE(_tire_rr, tire_rr),
    brake_lf = COALESCE(_brake_lf, brake_lf),
    brake_rf = COALESCE(_brake_rf, brake_rf),
    brake_lr = COALESCE(_brake_lr, brake_lr),
    brake_rr = COALESCE(_brake_rr, brake_rr)
  WHERE id = _submission_id;

  SELECT * INTO _config FROM public.inspection_config WHERE dealership_id = 'default' LIMIT 1;
  _mode := COALESCE(_config.tire_adjustment_mode, 'whole');
  
  IF _config.enable_tire_adjustments AND _tire_lf IS NOT NULL AND _tire_rf IS NOT NULL AND _tire_lr IS NOT NULL AND _tire_rr IS NOT NULL THEN
    IF _mode = 'per_tire' THEN
      _tires := ARRAY[_tire_lf, _tire_rf, _tire_lr, _tire_rr];
      _adjustment := 0;
      FOREACH _t IN ARRAY _tires LOOP
        IF _t >= _config.tire_credit_threshold THEN
          _adjustment := _adjustment + (_t - _config.tire_credit_threshold) * _config.tire_credit_per_32;
        ELSIF _t <= _config.tire_deduct_threshold THEN
          _adjustment := _adjustment - (_config.tire_deduct_threshold - _t) * _config.tire_deduct_per_32;
        END IF;
      END LOOP;
    ELSE
      _avg_depth := (_tire_lf + _tire_rf + _tire_lr + _tire_rr)::numeric / 4.0;
      IF _avg_depth >= _config.tire_credit_threshold THEN
        _adjustment := (_avg_depth - _config.tire_credit_threshold) * _config.tire_credit_per_32 * 4;
      ELSIF _avg_depth <= _config.tire_deduct_threshold THEN
        _adjustment := -1 * (_config.tire_deduct_threshold - _avg_depth) * _config.tire_deduct_per_32 * 4;
      END IF;
    END IF;
    
    _avg_depth := (_tire_lf + _tire_rf + _tire_lr + _tire_rr)::numeric / 4.0;
    UPDATE public.submissions SET tire_adjustment = _adjustment WHERE id = _submission_id;
    
    RETURN json_build_object('adjustment', _adjustment, 'avg_depth', _avg_depth);
  END IF;

  RETURN json_build_object('adjustment', 0, 'avg_depth', 0);
END;
$$;

-- Recreate portal function with brake columns
DROP FUNCTION IF EXISTS public.get_submission_portal(text);

CREATE FUNCTION public.get_submission_portal(_token text)
RETURNS TABLE(
  id uuid, vehicle_year text, vehicle_make text, vehicle_model text,
  name text, email text, phone text, mileage text, exterior_color text,
  overall_condition text, progress_status text, offered_price numeric,
  acv_value numeric, photos_uploaded boolean, docs_uploaded boolean,
  created_at timestamptz, loan_status text, token text, vin text, zip text,
  estimated_offer_low numeric, estimated_offer_high numeric,
  bb_tradein_avg numeric, appointment_set boolean,
  brake_lf integer, brake_rf integer, brake_lr integer, brake_rr integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name, s.email, s.phone,
         s.mileage, s.exterior_color, s.overall_condition, s.progress_status,
         s.offered_price, s.acv_value, s.photos_uploaded, s.docs_uploaded, s.created_at,
         s.loan_status, s.token, s.vin, s.zip,
         s.estimated_offer_low, s.estimated_offer_high, s.bb_tradein_avg,
         s.appointment_set,
         s.brake_lf, s.brake_rf, s.brake_lr, s.brake_rr
  FROM submissions s
  WHERE s.token = _token;
$$;
