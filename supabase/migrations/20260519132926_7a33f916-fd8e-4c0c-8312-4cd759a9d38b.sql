
-- ============================================================
-- SMS opt-out audit + missed-STOP detection
-- Idempotent: safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sms_opt_out_audit()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_today bigint;
  v_7d bigint;
  v_30d bigint;
  v_missed bigint;
BEGIN
  -- Staff-only
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'sales')
    OR public.has_role(auth.uid(), 'bdc')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_total FROM public.sms_opt_outs;
  SELECT count(*) INTO v_today FROM public.sms_opt_outs
    WHERE opted_out_at >= date_trunc('day', now());
  SELECT count(*) INTO v_7d FROM public.sms_opt_outs
    WHERE opted_out_at >= now() - interval '7 days';
  SELECT count(*) INTO v_30d FROM public.sms_opt_outs
    WHERE opted_out_at >= now() - interval '30 days';

  -- Missed = inbound STOP-ish message in last 30d with no opt-out
  -- row created for that phone at-or-after the inbound timestamp.
  SELECT count(*) INTO v_missed
  FROM public.sms_inbound_log i
  WHERE i.created_at >= now() - interval '30 days'
    AND (
      lower(btrim(i.body)) IN
        ('stop','stopall','unsubscribe','cancel','end','quit','remove','leave','no more')
      OR i.body ~* '\bstop\s+(text|call|message|sms|emailing|contacting)'
      OR i.body ~* '\b(remove|take)\s+me\s+(off|from)'
      OR i.body ~* '\bdo\s+not\s+(text|call|message|contact|email)'
      OR i.body ~* '\bdon''?t\s+(text|call|message|contact|email)'
      OR i.body ~* '\bopt\s*-?\s*out'
      OR i.body ~* '\bunsubscribe\s+me'
      OR i.body ~* '\bquit\s+(texting|calling|messaging)'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.sms_opt_outs o
      WHERE o.phone = i.from_phone
        AND o.opted_out_at >= i.created_at - interval '1 minute'
    );

  RETURN jsonb_build_object(
    'total', v_total,
    'today', v_today,
    'last_7_days', v_7d,
    'last_30_days', v_30d,
    'missed_count', v_missed,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sms_opt_out_audit() TO authenticated;

-- Returns the missed-STOP rows themselves for the admin panel.
CREATE OR REPLACE FUNCTION public.sms_opt_out_missed_alerts(p_days int DEFAULT 30)
RETURNS TABLE (
  inbound_id uuid,
  from_phone text,
  to_phone text,
  body text,
  submission_id uuid,
  dealership_id text,
  received_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'sales')
    OR public.has_role(auth.uid(), 'bdc')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.from_phone,
    i.to_phone,
    i.body,
    i.submission_id,
    i.dealership_id::text,
    i.created_at
  FROM public.sms_inbound_log i
  WHERE i.created_at >= now() - (p_days || ' days')::interval
    AND (
      lower(btrim(i.body)) IN
        ('stop','stopall','unsubscribe','cancel','end','quit','remove','leave','no more')
      OR i.body ~* '\bstop\s+(text|call|message|sms|emailing|contacting)'
      OR i.body ~* '\b(remove|take)\s+me\s+(off|from)'
      OR i.body ~* '\bdo\s+not\s+(text|call|message|contact|email)'
      OR i.body ~* '\bdon''?t\s+(text|call|message|contact|email)'
      OR i.body ~* '\bopt\s*-?\s*out'
      OR i.body ~* '\bunsubscribe\s+me'
      OR i.body ~* '\bquit\s+(texting|calling|messaging)'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.sms_opt_outs o
      WHERE o.phone = i.from_phone
        AND o.opted_out_at >= i.created_at - interval '1 minute'
    )
  ORDER BY i.created_at DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sms_opt_out_missed_alerts(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
