
CREATE OR REPLACE FUNCTION public.enforce_submission_update_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _display_name text;
  _role text;
  _first_name text;
  _last_initial text;
  _title text;
  _appraiser_label text;
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

    -- Get display name and email
    SELECT p.display_name, p.email INTO _display_name, _email
    FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1;

    -- Get role title
    SELECT CASE ur.role
      WHEN 'admin' THEN 'Admin'
      WHEN 'used_car_manager' THEN 'Used Car Manager'
      WHEN 'gsm_gm' THEN 'GSM/GM'
      ELSE ur.role::text
    END INTO _title
    FROM user_roles ur WHERE ur.user_id = auth.uid()
    ORDER BY CASE ur.role
      WHEN 'admin' THEN 1
      WHEN 'gsm_gm' THEN 2
      WHEN 'used_car_manager' THEN 3
      ELSE 4
    END
    LIMIT 1;

    -- Parse first name and last initial from display_name (or fall back to email)
    _display_name := COALESCE(NULLIF(TRIM(_display_name), ''), _email, auth.uid()::text);

    -- Extract first name (first word)
    _first_name := split_part(_display_name, ' ', 1);
    -- Extract last initial (first letter of second word, if exists)
    IF split_part(_display_name, ' ', 2) <> '' THEN
      _last_initial := LEFT(split_part(_display_name, ' ', 2), 1) || '.';
    ELSE
      _last_initial := '';
    END IF;

    -- Build label: "John S. — Used Car Manager"
    _appraiser_label := TRIM(_first_name || ' ' || _last_initial);
    IF _title IS NOT NULL AND _title <> '' THEN
      _appraiser_label := _appraiser_label || ' — ' || _title;
    END IF;

    NEW.appraised_by := _appraiser_label;
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
