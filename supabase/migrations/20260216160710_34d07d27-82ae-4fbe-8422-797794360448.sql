
-- Add column to track who entered the final appraisal
ALTER TABLE public.submissions ADD COLUMN appraised_by text;

-- Replace the trigger function to also enforce ACV restrictions and auto-record appraiser
CREATE OR REPLACE FUNCTION public.enforce_submission_update_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
BEGIN
  -- If offered_price is being changed, require manager+ role
  IF NEW.offered_price IS DISTINCT FROM OLD.offered_price THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'used_car_manager'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only managers can update the offered price';
    END IF;
  END IF;

  -- If acv_value is being changed, require manager+ role and record appraiser
  IF NEW.acv_value IS DISTINCT FROM OLD.acv_value THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'used_car_manager'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only managers can enter the appraisal value';
    END IF;
    -- Auto-record who entered the appraisal
    SELECT email INTO _email FROM profiles WHERE user_id = auth.uid() LIMIT 1;
    NEW.appraised_by := COALESCE(_email, auth.uid()::text);
  END IF;

  -- If progress_status is being changed to approval/purchase statuses, require GSM/GM or admin
  IF NEW.progress_status IS DISTINCT FROM OLD.progress_status AND
     NEW.progress_status IN ('manager_approval', 'price_agreed', 'purchase_complete') THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only GSM/GM or admin can set this status';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
