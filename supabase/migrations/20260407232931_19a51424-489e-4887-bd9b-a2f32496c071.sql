ALTER TABLE public.inspection_config
ADD COLUMN tire_brake_input_mode text NOT NULL DEFAULT 'measurement';

COMMENT ON COLUMN public.inspection_config.tire_brake_input_mode IS 'measurement = depth gauges, pass_fail = simple toggle';
