-- Above-ACV offer approval workflow.
CREATE TABLE IF NOT EXISTS public.offer_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id text NOT NULL,
  current_offer numeric,
  requested_offer numeric NOT NULL,
  acv_value_at_request numeric,
  delta numeric GENERATED ALWAYS AS (requested_offer - COALESCE(current_offer, 0)) STORED,
  acv_breach numeric GENERATED ALWAYS AS (requested_offer - COALESCE(acv_value_at_request, 0)) STORED,
  reason text NOT NULL DEFAULT 'other',
  reason_notes text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_role text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_notes text,
  applied_at timestamptz
);

ALTER TABLE public.offer_approval_requests
  DROP CONSTRAINT IF EXISTS offer_approval_requests_status_chk;
ALTER TABLE public.offer_approval_requests
  ADD  CONSTRAINT offer_approval_requests_status_chk
  CHECK (status IN ('pending','approved','denied','auto_approved','withdrawn'));

ALTER TABLE public.offer_approval_requests
  DROP CONSTRAINT IF EXISTS offer_approval_requests_reason_chk;
ALTER TABLE public.offer_approval_requests
  ADD  CONSTRAINT offer_approval_requests_reason_chk
  CHECK (reason IN ('customer_pushback','competitor_match','market_movement','goodwill','other'));

ALTER TABLE public.offer_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own tenant offer approvals" ON public.offer_approval_requests;
CREATE POLICY "Staff read own tenant offer approvals"
  ON public.offer_approval_requests FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR dealership_id = get_user_dealership_id(auth.uid())
  );

DROP POLICY IF EXISTS "Staff insert own tenant offer approvals" ON public.offer_approval_requests;
CREATE POLICY "Staff insert own tenant offer approvals"
  ON public.offer_approval_requests FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR dealership_id = get_user_dealership_id(auth.uid())
  );

CREATE INDEX IF NOT EXISTS offer_approval_pending_idx
  ON public.offer_approval_requests (dealership_id, status, requested_at DESC)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.request_offer_increase(
  _submission_id    uuid,
  _requested_offer  numeric,
  _reason           text DEFAULT 'other',
  _reason_notes     text DEFAULT NULL,
  _requested_by_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sub               record;
  _is_manager        boolean;
  _request_id        uuid;
  _auto_approved     boolean := false;
  _result            jsonb;
BEGIN
  SELECT id, dealership_id, offered_price, acv_value, name
    INTO _sub
  FROM submissions
  WHERE id = _submission_id;
  IF _sub.id IS NULL THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  IF _requested_offer IS NULL OR _requested_offer <= 0 THEN
    RAISE EXCEPTION 'invalid_requested_offer';
  END IF;

  _is_manager :=
       has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gsm_gm'::app_role)
    OR has_role(auth.uid(), 'gm'::app_role)
    OR has_role(auth.uid(), 'used_car_manager'::app_role);

  INSERT INTO offer_approval_requests
    (submission_id, dealership_id, current_offer, requested_offer,
     acv_value_at_request, reason, reason_notes,
     requested_by, requested_by_role, status,
     decided_by, decided_at, applied_at)
  VALUES
    (_submission_id, _sub.dealership_id, _sub.offered_price, _requested_offer,
     _sub.acv_value, _reason, _reason_notes,
     auth.uid(),
     COALESCE(_requested_by_role, CASE WHEN _is_manager THEN 'manager' ELSE 'staff' END),
     CASE WHEN _is_manager THEN 'auto_approved' ELSE 'pending' END,
     CASE WHEN _is_manager THEN auth.uid() ELSE NULL END,
     CASE WHEN _is_manager THEN now() ELSE NULL END,
     CASE WHEN _is_manager THEN now() ELSE NULL END)
  RETURNING id INTO _request_id;

  IF _is_manager THEN
    PERFORM set_config('app.accept_offer_bypass', 'true', true);
    UPDATE submissions
      SET offered_price = _requested_offer
      WHERE id = _submission_id;
    PERFORM set_config('app.accept_offer_bypass', 'false', true);
    _auto_approved := true;
  END IF;

  INSERT INTO activity_log
    (submission_id, action, old_value, new_value, performed_by, created_at)
  VALUES
    (_submission_id,
     CASE WHEN _is_manager THEN 'offer_increase_auto_approved' ELSE 'offer_increase_requested' END,
     COALESCE(_sub.offered_price::text, ''),
     _requested_offer::text,
     auth.uid()::text,
     now());

  _result := jsonb_build_object(
    'ok', true,
    'request_id', _request_id,
    'status', CASE WHEN _is_manager THEN 'auto_approved' ELSE 'pending' END,
    'auto_approved', _auto_approved
  );
  RETURN _result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_offer_increase(uuid, numeric, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_offer_request(
  _request_id      uuid,
  _decision        text,
  _decision_notes  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _req   record;
  _is_manager boolean;
BEGIN
  IF _decision NOT IN ('approved','denied') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  SELECT * INTO _req FROM offer_approval_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF _req.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'request_already_decided';
  END IF;

  _is_manager :=
       has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gsm_gm'::app_role)
    OR has_role(auth.uid(), 'gm'::app_role)
    OR has_role(auth.uid(), 'used_car_manager'::app_role);
  IF NOT _is_manager THEN
    RAISE EXCEPTION 'only_managers_can_decide';
  END IF;

  IF _decision = 'approved' THEN
    PERFORM set_config('app.accept_offer_bypass', 'true', true);
    UPDATE submissions
      SET offered_price = _req.requested_offer
      WHERE id = _req.submission_id;
    PERFORM set_config('app.accept_offer_bypass', 'false', true);
  END IF;

  UPDATE offer_approval_requests
  SET status = _decision,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_notes = _decision_notes,
      applied_at = CASE WHEN _decision = 'approved' THEN now() ELSE NULL END
  WHERE id = _request_id;

  INSERT INTO activity_log
    (submission_id, action, old_value, new_value, performed_by, created_at)
  VALUES
    (_req.submission_id,
     'offer_increase_' || _decision,
     COALESCE(_req.current_offer::text, ''),
     _req.requested_offer::text,
     auth.uid()::text,
     now());

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', _request_id,
    'status', _decision,
    'applied', _decision = 'approved'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.decide_offer_request(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';