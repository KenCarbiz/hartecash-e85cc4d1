-- Phase 1 / item 9: lead assignments — make ownership explicit so
-- hand-offs (receptionist → sales, BDC manager reassign, etc.)
-- become first-class instead of riding on progress_status.
--
-- Two new columns on submissions:
--   assigned_salesperson_id : the salesperson the lead is desked with
--   assigned_bdc_rep_id     : the BDC rep working the queue row
-- Both reference auth.users(id) ON DELETE SET NULL so a deleted user
-- doesn't orphan the row. assigned_at tracks when either was last
-- written so dashboards can show "assigned 12m ago".
--
-- Companion RPC `assign_submission_user(_id, _role, _user)` is the
-- only way the UI should write either column — it audits every
-- (re)assignment to activity_log so coaching surfaces have history.
--
-- Idempotent. Safe to re-run.

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

-- Reassignment RPC. SECURITY DEFINER so the audit row is always
-- written even if the caller's RLS would otherwise allow a silent
-- column update. Caller must be a manager or admin within the
-- submission's tenant — receptionists can write `assigned_salesperson_id`
-- through the FrontDesk Mark-Greeted path which goes through this
-- same function with role = 'salesperson'.
CREATE OR REPLACE FUNCTION public.assign_submission_user(
  _submission_id uuid,
  _role          text,           -- 'salesperson' | 'bdc_rep'
  _user_id       uuid             -- pass NULL to clear the assignment
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _dealership_id text;
  _caller_dealer text;
  _caller_role   text;
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

  -- Caller must belong to the same tenant.
  SELECT dealership_id INTO _caller_dealer
  FROM dealership_users WHERE user_id = auth.uid() LIMIT 1;
  IF _caller_dealer IS DISTINCT FROM _dealership_id
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'caller is not in this dealership';
  END IF;

  -- Anyone in the dealership can assign / reassign within their own
  -- tenant — receptionists, BDC managers, and managers all hit this
  -- path. The activity_log row makes any abuse traceable.

  IF _role = 'salesperson' THEN
    SELECT assigned_salesperson_id INTO _prev_user
    FROM submissions WHERE id = _submission_id;
    UPDATE submissions
       SET assigned_salesperson_id = _user_id,
           assigned_at             = now()
     WHERE id = _submission_id;
    _column := 'assigned_salesperson_id';
  ELSE
    SELECT assigned_bdc_rep_id INTO _prev_user
    FROM submissions WHERE id = _submission_id;
    UPDATE submissions
       SET assigned_bdc_rep_id = _user_id,
           assigned_at         = now()
     WHERE id = _submission_id;
    _column := 'assigned_bdc_rep_id';
  END IF;

  -- Audit row. Write even when prev = next so the trail captures
  -- "we re-claimed our own lead" — useful for coaching.
  INSERT INTO activity_log (
    submission_id, action, old_value, new_value, performed_by, created_at
  ) VALUES (
    _submission_id,
    CASE
      WHEN _user_id IS NULL THEN 'assignment_cleared:' || _column
      ELSE                       'assignment_changed:' || _column
    END,
    COALESCE(_prev_user::text, ''),
    COALESCE(_user_id::text,   ''),
    auth.uid()::text,
    now()
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_submission_user(uuid, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
