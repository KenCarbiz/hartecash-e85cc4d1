-- Update accept_offer to set a bypass flag for the trigger
CREATE OR REPLACE FUNCTION public.accept_offer(_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM submissions WHERE token = _token) THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  
  -- Set bypass flag so the role-check trigger allows this update
  PERFORM set_config('app.accept_offer_bypass', 'true', true);
  
  -- Set offered_price to estimated_offer_high if not already set by staff
  UPDATE submissions 
  SET progress_status = 'contacted',
      status_updated_at = now(),
      offered_price = COALESCE(offered_price, estimated_offer_high)
  WHERE token = _token 
    AND progress_status IN ('new', 'offer_made');
    
  -- Clear bypass flag
  PERFORM set_config('app.accept_offer_bypass', '', true);
END;
$$;

-- Update the trigger to respect the bypass flag
CREATE OR REPLACE FUNCTION public.enforce_submission_update_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _email text;
  _display_name text;
  _role text;
  _first_name text;
  _last_initial text;
  _title text;
  _appraiser_label text;
BEGIN
  -- Check for accept_offer bypass flag
  IF current_setting('app.accept_offer_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

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

    SELECT p.display_name, p.email INTO _display_name, _email
    FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1;

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

    _display_name := COALESCE(NULLIF(TRIM(_display_name), ''), _email, auth.uid()::text);
    _first_name := split_part(_display_name, ' ', 1);
    IF split_part(_display_name, ' ', 2) <> '' THEN
      _last_initial := LEFT(split_part(_display_name, ' ', 2), 1) || '.';
    ELSE
      _last_initial := '';
    END IF;

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
$$;