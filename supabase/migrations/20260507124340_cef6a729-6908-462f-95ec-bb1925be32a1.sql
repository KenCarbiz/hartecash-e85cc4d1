-- Apply 3 pending migrations: lead_assignments, appraised_by_user_id, appraisal_started_at
-- (dealership_users table doesn't exist in this project; using get_user_dealership_id instead)

-- ============ 20260507030000_lead_assignments ============
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS assigned_salesperson_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_bdc_rep_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at             timestamptz;

CREATE INDEX IF NOT EXISTS submissions_assigned_salesperson_idx
  ON public.submissions (assigned_salesperson_id, assigned_at DESC)
  WHERE assigned_salesperson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS submissions_assigned_bdc_rep_idx
  ON public.submissions (assigned_bdc_rep_id, assigned_at DESC)
  WHERE assigned_bdc_rep_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_submission_user(
  _submission_id uuid,
  _role          text,
  _user_id       uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _dealership_id text;
  _caller_dealer text;
  _prev_user     uuid;
  _column        text;
BEGIN
  IF _role NOT IN ('salesperson','bdc_rep') THEN
    RAISE EXCEPTION 'assign_submission_user: invalid role %', _role;
  END IF;

  SELECT dealership_id INTO _dealership_id
  FROM submissions WHERE id = _submission_id;
  IF _dealership_id IS NULL THEN
    RAISE EXCEPTION 'submission % not found', _submission_id;
  END IF;

  _caller_dealer := get_user_dealership_id(auth.uid());
  IF _caller_dealer IS DISTINCT FROM _dealership_id
     AND NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'caller is not in this dealership';
  END IF;

  IF _role = 'salesperson' THEN
    SELECT assigned_salesperson_id INTO _prev_user FROM submissions WHERE id = _submission_id;
    UPDATE submissions
       SET assigned_salesperson_id = _user_id, assigned_at = now()
     WHERE id = _submission_id;
    _column := 'assigned_salesperson_id';
  ELSE
    SELECT assigned_bdc_rep_id INTO _prev_user FROM submissions WHERE id = _submission_id;
    UPDATE submissions
       SET assigned_bdc_rep_id = _user_id, assigned_at = now()
     WHERE id = _submission_id;
    _column := 'assigned_bdc_rep_id';
  END IF;

  INSERT INTO activity_log (submission_id, action, old_value, new_value, performed_by, created_at)
  VALUES (
    _submission_id,
    CASE WHEN _user_id IS NULL THEN 'assignment_cleared:' || _column
         ELSE 'assignment_changed:' || _column END,
    COALESCE(_prev_user::text, ''),
    COALESCE(_user_id::text,   ''),
    auth.uid()::text,
    now()
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_submission_user(uuid, text, uuid) TO authenticated;

-- ============ 20260507040000_appraised_by_user_id ============
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS appraised_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS submissions_appraised_by_user_idx
  ON public.submissions (appraised_by_user_id)
  WHERE appraised_by_user_id IS NOT NULL;

UPDATE public.submissions s
SET appraised_by_user_id = p.user_id
FROM public.profiles p
WHERE s.appraised_by_user_id IS NULL
  AND s.appraised_by IS NOT NULL
  AND s.appraised_by ~ '@'
  AND lower(s.appraised_by) = lower(p.email);

UPDATE public.submissions s
SET appraised_by_user_id = s.appraised_by::uuid
WHERE s.appraised_by_user_id IS NULL
  AND s.appraised_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = s.appraised_by::uuid);

CREATE OR REPLACE FUNCTION public.enforce_submission_update_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _display_name    text;
  _email           text;
  _first_name      text;
  _last_initial    text;
  _title           text;
  _appraiser_label text;
BEGIN
  IF current_setting('app.accept_offer_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.offered_price IS DISTINCT FROM OLD.offered_price THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'used_car_manager'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only managers can update the offered price';
    END IF;
  END IF;

  IF NEW.acv_value IS DISTINCT FROM OLD.acv_value THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'used_car_manager'::app_role) OR
      has_role(auth.uid(), 'gsm_gm'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only managers can enter the appraisal value';
    END IF;

    NEW.appraised_by_user_id := auth.uid();

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

-- ============ 20260507050000_appraisal_started_at ============
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS appraisal_started_at timestamptz;

CREATE INDEX IF NOT EXISTS submissions_appraisal_started_idx
  ON public.submissions (appraisal_started_at DESC)
  WHERE appraisal_started_at IS NOT NULL AND acv_value IS NULL;

NOTIFY pgrst, 'reload schema';