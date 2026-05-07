ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS customer_memory jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.submissions.customer_memory IS
  'Append-only array of personal details the voice AI extracted from prior calls. The next call''s compiled prompt surfaces the most recent item with a "reference in first 20 seconds" mandate. This is the rockstar-rep "long-memory specificity" mechanic.';

ALTER TABLE public.voice_call_log
  ADD COLUMN IF NOT EXISTS memory_hook_offered text,
  ADD COLUMN IF NOT EXISTS memory_hook_used boolean,
  ADD COLUMN IF NOT EXISTS memory_hook_used_within_20s boolean;

CREATE OR REPLACE FUNCTION public.add_customer_memory_item(
  _submission_id   uuid,
  _fact            text,
  _kind            text DEFAULT 'general',
  _source_call_id  uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item jsonb;
  _existing jsonb;
BEGIN
  IF _fact IS NULL OR length(trim(_fact)) = 0 THEN
    RETURN;
  END IF;

  IF _kind IN ('offer','vehicle','price','payoff','vin','mileage') THEN
    RAISE EXCEPTION 'add_customer_memory_item: kind=% is not a personal-detail kind', _kind;
  END IF;

  _item := jsonb_build_object(
    'fact', trim(_fact),
    'kind', _kind,
    'source_call_id', _source_call_id,
    'captured_at', to_jsonb(now())
  );

  SELECT customer_memory INTO _existing FROM submissions WHERE id = _submission_id;
  IF _existing IS NULL THEN
    _existing := '[]'::jsonb;
  END IF;

  UPDATE submissions
  SET customer_memory = jsonb_build_array(_item) || (
    SELECT COALESCE(jsonb_agg(value ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT value, ord
      FROM jsonb_array_elements(_existing) WITH ORDINALITY AS t(value, ord)
      ORDER BY ord
      LIMIT 11
    ) sub
  )
  WHERE id = _submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_customer_memory_item(uuid, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.compile_voice_agent_prompt(
  _dealership_id text DEFAULT 'default',
  _submission_id uuid DEFAULT NULL,
  _call_type     text DEFAULT 'offered_to_accepted'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _persona  record;
  _block    text := '';
  _r        record;
  _sub      record;
  _memory   jsonb;
  _mem_top  jsonb;
BEGIN
  SELECT * INTO _persona
  FROM voice_agent_persona
  WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
    AND is_active = true
    AND retired_at IS NULL
  ORDER BY CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END, sort_order
  LIMIT 1;

  IF _persona.id IS NULL THEN
    RETURN E'No voice agent persona configured.';
  END IF;

  _block := _block || E'═══ PERSONA ═══\nYou are: ' || _persona.persona_name || E'\n\n';
  _block := _block || E'VOICE RULES:\n' || _persona.voice_rules || E'\n\n';
  _block := _block || E'MISSION:\n' || _persona.mission_block || E'\n\n';
  _block := _block || E'SUCCESS LOOKS LIKE:\n' || _persona.success_criteria || E'\n\n';
  IF _persona.greeting_style IS NOT NULL THEN
    _block := _block || E'GREETING STYLE:\n' || _persona.greeting_style || E'\n\n';
  END IF;
  IF _persona.signoff_style IS NOT NULL THEN
    _block := _block || E'SIGN-OFF STYLE:\n' || _persona.signoff_style || E'\n\n';
  END IF;
  _block := _block || E'AI DISCLOSURE (when asked):\n' || COALESCE(_persona.ai_disclosure_line, '') || E'\n\n';
  _block := _block || E'HARD CONSTRAINTS:\n';
  FOR i IN 1..COALESCE(array_length(_persona.hard_constraints, 1), 0) LOOP
    _block := _block || '- ' || _persona.hard_constraints[i] || E'\n';
  END LOOP;
  _block := _block || E'\n';

  IF _submission_id IS NOT NULL THEN
    SELECT customer_memory INTO _memory FROM submissions WHERE id = _submission_id;
    IF _memory IS NOT NULL AND jsonb_array_length(_memory) > 0 THEN
      _mem_top := _memory -> 0;
      _block := _block || E'═══ MEMORY HOOK (mandatory) ═══\n';
      _block := _block || E'You spoke with this customer before. They told you:\n';
      _block := _block || E'  "' || (_mem_top ->> 'fact') || E'"\n\n';
      _block := _block || E'Reference this BRIEFLY within the first 20 seconds of the call ';
      _block := _block || E'(after your greeting, before any business). One sentence. ';
      _block := _block || E'Do NOT make it the centerpiece — just acknowledge it. ';
      _block := _block || E'Examples of what this looks like:\n';
      _block := _block || E'  - "Hey, before we get into the car — last time you mentioned [thing]. How''s that going?"\n';
      _block := _block || E'  - "Quick check-in before we dive in — you''d told me [thing]. Still on track?"\n\n';
      _block := _block || E'This single move is what separates a forgettable call from one ';
      _block := _block || E'where the customer feels heard. Skip it and the customer hears a script. ';
      _block := _block || E'Use it and they hear a person who listened.\n\n';
    END IF;
  END IF;

  _block := _block || E'═══ CONVERSATION PHASES ═══\n';
  FOR _r IN
    SELECT * FROM conversation_phases
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND call_type = _call_type
      AND is_active = true
      AND retired_at IS NULL
    ORDER BY CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END, sort_order
  LOOP
    _block := _block || E'\n[' || _r.phase_position || ' · ' || _r.phase_key || ']\n';
    _block := _block || _r.content || E'\n';
    IF _r.use_when IS NOT NULL THEN
      _block := _block || '  USE WHEN: ' || _r.use_when || E'\n';
    END IF;
  END LOOP;
  _block := _block || E'\n';

  _block := _block || E'═══ CUSTOMER SIGNALS ═══\nMatch the customer''s words to one of these states and use the recommended response.\n';
  FOR _r IN
    SELECT * FROM customer_signals
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND is_active = true
      AND retired_at IS NULL
    ORDER BY CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END, sort_order
  LOOP
    _block := _block || E'\n— Signal: ' || _r.signal_key || ' (state: ' || _r.customer_state || E')\n';
    _block := _block || '  If they say: ' || array_to_string(_r.signal_phrases, ', ') || E'\n';
    _block := _block || '  Posture: ' || _r.recommended_posture || E'\n';
    IF array_length(_r.response_variants, 1) > 0 THEN
      _block := _block || '  Say something like: ' || _r.response_variants[1] || E'\n';
    END IF;
    IF array_length(_r.do_not_say, 1) > 0 THEN
      _block := _block || '  Do NOT say: ' || array_to_string(_r.do_not_say, ' / ') || E'\n';
    END IF;
    IF _r.hand_off_to_human THEN
      _block := _block || E'  → HAND OFF TO HUMAN immediately.\n';
    END IF;
  END LOOP;
  _block := _block || E'\n';

  _block := _block || E'═══ CITABLE FACTS ═══\nUse these when the customer challenges a claim. Quote the number, do not paraphrase. Competitor entries fire ONLY when the customer names the competitor first.\n';
  FOR _r IN
    SELECT * FROM industry_intel
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND is_active = true
      AND retired_at IS NULL
    ORDER BY CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END, scope, sort_order
  LOOP
    _block := _block || E'\n[' || _r.scope || ' · ' || _r.topic || E']\n';
    _block := _block || '  ' || _r.short_claim || E'\n';
    IF _r.citable_number IS NOT NULL THEN
      _block := _block || '  Number: ' || _r.citable_number || E'\n';
    END IF;
    IF _r.use_when IS NOT NULL THEN
      _block := _block || '  Use when: ' || _r.use_when || E'\n';
    END IF;
  END LOOP;
  _block := _block || E'\n';

  _block := _block || E'═══ OBJECTION PLAYBOOK ═══\nCompiled from objection_playbook. Match customer phrases to the right card.\n';
  FOR _r IN
    SELECT label, customer_signals, voice_ai_snippet
    FROM objection_playbook
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND is_active = true
      AND voice_ai_snippet IS NOT NULL
    ORDER BY CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END, sort_order
  LOOP
    _block := _block || E'\n— If they say something like '
      || array_to_string(_r.customer_signals[1:3], ', ')
      || ' (objection: ' || _r.label || E')\n  Say: '
      || _r.voice_ai_snippet || E'\n';
  END LOOP;
  _block := _block || E'\n';

  IF _submission_id IS NOT NULL THEN
    SELECT s.id, s.name, s.vehicle_year, s.vehicle_make, s.vehicle_model,
           s.offered_price, s.acv_value, s.acv_status,
           s.declined_reason, s.competitor_mentioned,
           s.customer_walk_away_number, s.loan_status,
           s.last_outreach_at
      INTO _sub
    FROM submissions s
    WHERE s.id = _submission_id;
    IF _sub.id IS NOT NULL THEN
      _block := _block || E'═══ THIS CUSTOMER ═══\n';
      _block := _block || 'Name: ' || COALESCE(_sub.name, 'Unknown') || E'\n';
      _block := _block || 'Vehicle: ' || COALESCE(_sub.vehicle_year, '') || ' '
                       || COALESCE(_sub.vehicle_make, '') || ' '
                       || COALESCE(_sub.vehicle_model, '') || E'\n';
      IF _sub.offered_price IS NOT NULL THEN
        _block := _block || 'Current offer: $' || _sub.offered_price::text || E'\n';
      END IF;
      IF _sub.acv_value IS NOT NULL THEN
        _block := _block || 'ACV ceiling: $' || _sub.acv_value::text
          || ' (' || COALESCE(_sub.acv_status, 'preliminary') || E')\n';
      END IF;
      IF _sub.declined_reason IS NOT NULL THEN
        _block := _block || 'Prior decline reason: ' || _sub.declined_reason || E'\n';
      END IF;
      IF _sub.competitor_mentioned IS NOT NULL THEN
        _block := _block || 'Competitor mentioned: ' || _sub.competitor_mentioned || E'\n';
      END IF;
      IF _sub.customer_walk_away_number IS NOT NULL THEN
        _block := _block || 'Customer''s stated walk-away: $' || _sub.customer_walk_away_number::text || E'\n';
      END IF;
      IF _sub.loan_status IS NOT NULL THEN
        _block := _block || 'Loan status: ' || _sub.loan_status || E'\n';
      END IF;
    END IF;
  END IF;

  RETURN _block;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text)
  TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';