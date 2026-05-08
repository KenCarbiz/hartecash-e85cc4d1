ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS acv_status text NOT NULL DEFAULT 'preliminary',
  ADD COLUMN IF NOT EXISTS acv_set_at timestamptz;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_acv_status_chk;
ALTER TABLE public.submissions
  ADD  CONSTRAINT submissions_acv_status_chk
  CHECK (acv_status IN ('preliminary','final'));

UPDATE public.submissions
SET acv_status = CASE
  WHEN acv_value IS NOT NULL AND inspection_completed_at IS NOT NULL THEN 'final'
  ELSE 'preliminary'
END
WHERE acv_status IS DISTINCT FROM CASE
  WHEN acv_value IS NOT NULL AND inspection_completed_at IS NOT NULL THEN 'final'
  ELSE 'preliminary'
END;

CREATE OR REPLACE FUNCTION public.promote_acv_on_inspection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.inspection_completed_at IS NOT NULL
     AND (OLD.inspection_completed_at IS NULL OR OLD.inspection_completed_at IS DISTINCT FROM NEW.inspection_completed_at)
     AND NEW.acv_value IS NOT NULL
     AND NEW.acv_status = 'preliminary' THEN
    NEW.acv_status := 'final';
  END IF;

  IF NEW.acv_value IS DISTINCT FROM OLD.acv_value
     AND NEW.acv_value IS NOT NULL THEN
    NEW.acv_set_at := now();
    IF NEW.inspection_completed_at IS NULL THEN
      NEW.acv_status := 'preliminary';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS submissions_promote_acv ON public.submissions;
CREATE TRIGGER submissions_promote_acv
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_acv_on_inspection();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'gm'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'gm';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';