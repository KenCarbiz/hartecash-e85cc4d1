
DROP FUNCTION IF EXISTS public.save_mobile_inspection(uuid, text, text, integer, integer, integer, integer, integer, integer, integer, integer);

CREATE FUNCTION public.save_mobile_inspection(_submission_id uuid, _internal_notes text, _overall_condition text DEFAULT NULL::text, _tire_lf integer DEFAULT NULL::integer, _tire_rf integer DEFAULT NULL::integer, _tire_lr integer DEFAULT NULL::integer, _tire_rr integer DEFAULT NULL::integer, _brake_lf integer DEFAULT NULL::integer, _brake_rf integer DEFAULT NULL::integer, _brake_lr integer DEFAULT NULL::integer, _brake_rr integer DEFAULT NULL::integer, _inspector_grade text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    brake_rr = COALESCE(_brake_rr, brake_rr),
    inspector_grade = COALESCE(_inspector_grade, inspector_grade)
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
$function$;
