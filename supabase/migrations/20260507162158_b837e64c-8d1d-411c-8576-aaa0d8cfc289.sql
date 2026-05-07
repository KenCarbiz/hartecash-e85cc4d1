ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS inspection_completed_at timestamptz;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS acv_status text NOT NULL DEFAULT 'preliminary',
  ADD COLUMN IF NOT EXISTS acv_set_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_acv_status_check') THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_acv_status_check
      CHECK (acv_status IN ('preliminary', 'final'));
  END IF;
END $$;

UPDATE public.submissions SET acv_status = 'final'
 WHERE acv_value IS NOT NULL AND inspection_completed_at IS NOT NULL AND acv_status <> 'final';

UPDATE public.submissions SET acv_status = 'preliminary'
 WHERE (acv_value IS NULL OR inspection_completed_at IS NULL) AND acv_status <> 'preliminary';

UPDATE public.submissions SET acv_set_at = created_at
 WHERE acv_value IS NOT NULL AND acv_set_at IS NULL;

CREATE OR REPLACE FUNCTION public.promote_acv_on_inspection()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.acv_value IS DISTINCT FROM OLD.acv_value AND NEW.acv_value IS NOT NULL THEN
    NEW.acv_set_at := now();
    IF NEW.inspection_completed_at IS NULL THEN
      NEW.acv_status := 'preliminary';
    END IF;
  END IF;
  IF NEW.inspection_completed_at IS NOT NULL
     AND OLD.inspection_completed_at IS NULL
     AND NEW.acv_value IS NOT NULL THEN
    NEW.acv_status := 'final';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_acv_on_inspection ON public.submissions;
CREATE TRIGGER trg_promote_acv_on_inspection
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.promote_acv_on_inspection();

CREATE OR REPLACE FUNCTION public.enforce_submission_update_roles()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _display_name text; _email text; _first_name text; _last_initial text;
  _title text; _appraiser_label text;
BEGIN
  IF current_setting('app.accept_offer_bypass', true) = 'true' THEN RETURN NEW; END IF;

  IF NEW.offered_price IS DISTINCT FROM OLD.offered_price THEN
    IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'used_car_manager'::app_role)
            OR has_role(auth.uid(), 'gsm_gm'::app_role) OR has_role(auth.uid(), 'gm'::app_role)) THEN
      RAISE EXCEPTION 'Only sales / used-car / general managers can update the offered price';
    END IF;
  END IF;

  IF NEW.acv_value IS DISTINCT FROM OLD.acv_value THEN
    IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'used_car_manager'::app_role)
            OR has_role(auth.uid(), 'gsm_gm'::app_role) OR has_role(auth.uid(), 'gm'::app_role)) THEN
      RAISE EXCEPTION 'Only sales / used-car / general managers can enter the appraisal value';
    END IF;

    NEW.appraised_by_user_id := auth.uid();
    SELECT p.display_name, p.email INTO _display_name, _email FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1;
    SELECT CASE ur.role
      WHEN 'admin' THEN 'Admin' WHEN 'used_car_manager' THEN 'Used Car Manager'
      WHEN 'gsm_gm' THEN 'GSM/GM' WHEN 'gm' THEN 'GM' ELSE ur.role::text END INTO _title
    FROM user_roles ur WHERE ur.user_id = auth.uid()
    ORDER BY CASE ur.role WHEN 'admin' THEN 1 WHEN 'gsm_gm' THEN 2 WHEN 'gm' THEN 3
                          WHEN 'used_car_manager' THEN 4 ELSE 5 END LIMIT 1;

    _display_name := COALESCE(NULLIF(TRIM(_display_name), ''), _email, auth.uid()::text);
    _first_name := split_part(_display_name, ' ', 1);
    IF split_part(_display_name, ' ', 2) <> '' THEN
      _last_initial := LEFT(split_part(_display_name, ' ', 2), 1) || '.';
    ELSE _last_initial := ''; END IF;

    _appraiser_label := TRIM(_first_name || ' ' || _last_initial);
    IF _title IS NOT NULL AND _title <> '' THEN
      _appraiser_label := _appraiser_label || ' — ' || _title;
    END IF;
    NEW.appraised_by := _appraiser_label;
  END IF;

  IF NEW.progress_status IS DISTINCT FROM OLD.progress_status AND
     NEW.progress_status IN ('manager_approval', 'price_agreed', 'purchase_complete') THEN
    IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gsm_gm'::app_role)
            OR has_role(auth.uid(), 'gm'::app_role)) THEN
      RAISE EXCEPTION 'Only general managers or admin can set this status';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';