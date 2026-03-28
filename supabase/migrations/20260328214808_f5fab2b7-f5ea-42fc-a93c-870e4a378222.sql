
-- Add tire tread depth readings and tire adjustment to submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS tire_lf integer,
  ADD COLUMN IF NOT EXISTS tire_rf integer,
  ADD COLUMN IF NOT EXISTS tire_lr integer,
  ADD COLUMN IF NOT EXISTS tire_rr integer,
  ADD COLUMN IF NOT EXISTS tire_adjustment numeric DEFAULT 0;

-- Add tire credit/deduction policy settings to inspection_config
ALTER TABLE public.inspection_config
  ADD COLUMN IF NOT EXISTS enable_tire_adjustments boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tire_credit_threshold integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS tire_deduct_threshold integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS tire_credit_per_32 numeric NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS tire_deduct_per_32 numeric NOT NULL DEFAULT 50;

-- Update the save_mobile_inspection RPC to handle tire data
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
  _avg_depth numeric;
  _adjustment numeric := 0;
  _result json;
BEGIN
  -- Save basic inspection data
  UPDATE public.submissions
  SET 
    internal_notes = _internal_notes,
    overall_condition = COALESCE(_overall_condition, overall_condition),
    tire_lf = COALESCE(_tire_lf, tire_lf),
    tire_rf = COALESCE(_tire_rf, tire_rf),
    tire_lr = COALESCE(_tire_lr, tire_lr),
    tire_rr = COALESCE(_tire_rr, tire_rr)
  WHERE id = _submission_id;

  -- Calculate tire adjustment if enabled
  SELECT * INTO _config FROM public.inspection_config WHERE dealership_id = 'default' LIMIT 1;
  
  IF _config.enable_tire_adjustments AND _tire_lf IS NOT NULL AND _tire_rf IS NOT NULL AND _tire_lr IS NOT NULL AND _tire_rr IS NOT NULL THEN
    _avg_depth := (_tire_lf + _tire_rf + _tire_lr + _tire_rr)::numeric / 4.0;
    
    IF _avg_depth >= _config.tire_credit_threshold THEN
      -- Credit: each /32 above threshold × credit rate × 4 tires
      _adjustment := (_avg_depth - _config.tire_credit_threshold) * _config.tire_credit_per_32 * 4;
    ELSIF _avg_depth <= _config.tire_deduct_threshold THEN
      -- Deduction: each /32 below threshold × deduct rate × 4 tires
      _adjustment := -1 * (_config.tire_deduct_threshold - _avg_depth) * _config.tire_deduct_per_32 * 4;
    END IF;
    
    UPDATE public.submissions SET tire_adjustment = _adjustment WHERE id = _submission_id;
  END IF;

  SELECT json_build_object('adjustment', _adjustment, 'avg_depth', COALESCE(_avg_depth, 0)) INTO _result;
  RETURN _result;
END;
$$;
