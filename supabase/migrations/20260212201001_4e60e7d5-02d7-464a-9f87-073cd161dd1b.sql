-- Use a trigger to enforce role-based access on sensitive submission fields

-- First, restrict DELETE to admin only
DROP POLICY IF EXISTS "Admins can delete submissions" ON public.submissions;

CREATE POLICY "Only admins can delete submissions"
ON public.submissions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger function to enforce role-based update restrictions
CREATE OR REPLACE FUNCTION public.enforce_submission_update_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Attach the trigger
CREATE TRIGGER enforce_submission_roles_trigger
BEFORE UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_submission_update_roles();
