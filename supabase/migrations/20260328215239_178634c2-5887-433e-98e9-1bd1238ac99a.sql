
-- Add per-tire vs whole adjustment mode
ALTER TABLE public.inspection_config
  ADD COLUMN IF NOT EXISTS tire_adjustment_mode text NOT NULL DEFAULT 'whole';
-- 'whole' = one flat amount based on avg depth, 'per_tire' = calculated per individual tire

-- Update RPC to support per-tire mode
CREATE OR REPLACE FUNCTION public.save_mobile_inspection(
  _submission_id uuid,
  _internal_notes text,
  _overall_condition text DEFAULT NULL,
  _tire_lf integer DEFAULT NULL,
  _tire_rf integer DEFAULT NULL,
  _tire_lr integer DEFAULT NULL,
  _tire_rr integer DEFAULT NULL
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
  _tire_adj numeric;
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
    tire_rr = COALESCE(_tire_rr, tire_rr)
  WHERE id = _submission_id;

  SELECT * INTO _config FROM public.inspection_config WHERE dealership_id = 'default' LIMIT 1;
  _mode := COALESCE(_config.tire_adjustment_mode, 'whole');
  
  IF _config.enable_tire_adjustments AND _tire_lf IS NOT NULL AND _tire_rf IS NOT NULL AND _tire_lr IS NOT NULL AND _tire_rr IS NOT NULL THEN
    
    IF _mode = 'per_tire' THEN
      -- Calculate adjustment for each tire individually
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
      -- 'whole' mode: use average depth, apply as a flat set of 4
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
