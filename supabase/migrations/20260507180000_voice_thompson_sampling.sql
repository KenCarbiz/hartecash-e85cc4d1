-- Replace compile_voice_agent_prompt with a variant-aware version
-- that samples across active variants per slot using a Thompson-style
-- approximation, and (when given a call_id) records every chosen
-- variant into voice_call_variants_used so apply_voice_call_outcome
-- can reward/punish them post-call.
--
-- Why Thompson sampling at compile-time:
--   The cabinet is now multi-armed per slot — e.g. signal "too_low"
--   can have 3 active variants competing. We need to pick one PER
--   CALL and learn from that call's outcome. Compile-time draw with
--   Beta(1+wins, 1+losses) gives natural exploration when counts are
--   small and convergence to the winner as counts grow.
--
-- PostgreSQL has no native beta sampler, so we approximate:
--   draw = posterior_mean + uniform_noise * posterior_std_proxy
--        = (1+wins)/(2+wins+losses)
--        + random() * sqrt(1.0 / (3+wins+losses))
-- This is technically UCB-shaped but behaves like Thompson for our
-- counts (early exploration via the random() dominating, late
-- exploitation as the std-proxy shrinks). Good enough — and we get
-- the upside that it's a single-pass SQL expression, no PL/Python.
--
-- Slot definition:
--   persona slot = (dealership, persona_name)
--   phase slot   = (dealership, phase_key) within the call_type filter
--   signal slot  = (dealership, signal_key)
--   intel slot   = (dealership, scope, topic)
-- Tenant rows shadow defaults at slot resolution time, then variants
-- compete within the chosen slot owner.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION public.compile_voice_agent_prompt(
  _dealership_id text DEFAULT 'default',
  _submission_id uuid DEFAULT NULL,
  _call_type     text DEFAULT 'offered_to_accepted',
  _call_id       uuid DEFAULT NULL
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
  _draw     numeric;
BEGIN
  -- ── Persona — Thompson-approx draw across active variants ────────
  -- Tenant variants beat default variants; among same-tenant variants
  -- the highest draw score wins. CASE in ORDER BY hard-prefers tenant.
  SELECT * INTO _persona
  FROM voice_agent_persona
  WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
    AND is_active = true
    AND retired_at IS NULL
  ORDER BY
    CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END,
    ((1 + win_count)::numeric / (2 + win_count + loss_count))
      + random() * sqrt(1.0 / (3 + win_count + loss_count)) DESC,
    sort_order
  LIMIT 1;

  IF _persona.id IS NULL THEN
    RETURN E'No voice agent persona configured.';
  END IF;

  IF _call_id IS NOT NULL THEN
    INSERT INTO voice_call_variants_used (call_id, source_table, variant_id, slot_key, thompson_draw)
    VALUES (_call_id, 'voice_agent_persona', _persona.variant_id,
            'persona:' || _persona.persona_name, NULL);
    UPDATE voice_agent_persona SET last_promoted_at = now() WHERE variant_id = _persona.variant_id;
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

  -- ── MEMORY HOOK — surfaced before phases (rockstar mechanic) ─────
  IF _submission_id IS NOT NULL THEN
    SELECT customer_memory INTO _memory
    FROM submissions
    WHERE id = _submission_id;

    IF _memory IS NOT NULL AND jsonb_array_length(_memory) > 0 THEN
      _mem_top := _memory -> 0;
      _block := _block || E'═══ MEMORY HOOK (mandatory) ═══\n';
      _block := _block || E'You spoke with this customer before. They told you:\n';
      _block := _block || E'  "' || (_mem_top ->> 'fact') || E'"\n\n';
      _block := _block || E'Reference this BRIEFLY within the first 20 seconds of the call ';
      _block := _block || E'(after your greeting, before any business). One sentence. ';
      _block := _block || E'Do NOT make it the centerpiece — just acknowledge it.\n\n';

      -- When we have a call_id, stamp it on voice_call_log.memory_hook_offered
      -- so the post-call grader can score whether it was actually used.
      IF _call_id IS NOT NULL THEN
        UPDATE voice_call_log
        SET memory_hook_offered = (_mem_top ->> 'fact')
        WHERE id = _call_id;
      END IF;
    END IF;
  END IF;

  -- ── Conversation phases — one variant per phase_key ───────────────
  -- DISTINCT ON picks the top-draw row per phase_key, after tenant
  -- preference. Each chosen variant is recorded against the call.
  _block := _block || E'═══ CONVERSATION PHASES ═══\n';
  FOR _r IN
    SELECT DISTINCT ON (phase_key) *
    FROM (
      SELECT
        cp.*,
        ((1 + cp.win_count)::numeric / (2 + cp.win_count + cp.loss_count))
          + random() * sqrt(1.0 / (3 + cp.win_count + cp.loss_count)) AS _draw_score,
        CASE WHEN cp.dealership_id = _dealership_id THEN 0 ELSE 1 END AS _tenant_pref
      FROM conversation_phases cp
      WHERE (cp.dealership_id = _dealership_id OR cp.dealership_id = 'default')
        AND cp.call_type = _call_type
        AND cp.is_active = true
        AND cp.retired_at IS NULL
    ) ranked
    ORDER BY phase_key, _tenant_pref, _draw_score DESC, sort_order
  LOOP
    _block := _block || E'\n[' || _r.phase_position || ' · ' || _r.phase_key || ']\n';
    _block := _block || _r.content || E'\n';
    IF _r.use_when IS NOT NULL THEN
      _block := _block || '  USE WHEN: ' || _r.use_when || E'\n';
    END IF;

    IF _call_id IS NOT NULL THEN
      INSERT INTO voice_call_variants_used (call_id, source_table, variant_id, slot_key, thompson_draw)
      VALUES (_call_id, 'conversation_phases', _r.variant_id,
              'phase:' || _r.phase_key, _r._draw_score);
      UPDATE conversation_phases SET last_promoted_at = now() WHERE variant_id = _r.variant_id;
    END IF;
  END LOOP;
  _block := _block || E'\n';

  -- ── Customer signals — one variant per signal_key ─────────────────
  _block := _block || E'═══ CUSTOMER SIGNALS ═══\nMatch the customer''s words to one of these states and use the recommended response.\n';
  FOR _r IN
    SELECT DISTINCT ON (signal_key) *
    FROM (
      SELECT
        cs.*,
        ((1 + cs.win_count)::numeric / (2 + cs.win_count + cs.loss_count))
          + random() * sqrt(1.0 / (3 + cs.win_count + cs.loss_count)) AS _draw_score,
        CASE WHEN cs.dealership_id = _dealership_id THEN 0 ELSE 1 END AS _tenant_pref
      FROM customer_signals cs
      WHERE (cs.dealership_id = _dealership_id OR cs.dealership_id = 'default')
        AND cs.is_active = true
        AND cs.retired_at IS NULL
    ) ranked
    ORDER BY signal_key, _tenant_pref, _draw_score DESC, sort_order
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

    IF _call_id IS NOT NULL THEN
      INSERT INTO voice_call_variants_used (call_id, source_table, variant_id, slot_key, thompson_draw)
      VALUES (_call_id, 'customer_signals', _r.variant_id,
              'signal:' || _r.signal_key, _r._draw_score);
      UPDATE customer_signals SET last_promoted_at = now() WHERE variant_id = _r.variant_id;
    END IF;
  END LOOP;
  _block := _block || E'\n';

  -- ── Industry intel — one variant per (scope, topic) ───────────────
  _block := _block || E'═══ CITABLE FACTS ═══\nUse these when the customer challenges a claim. Quote the number, do not paraphrase. Competitor entries fire ONLY when the customer names the competitor first.\n';
  FOR _r IN
    SELECT DISTINCT ON (scope, topic) *
    FROM (
      SELECT
        ii.*,
        ((1 + ii.win_count)::numeric / (2 + ii.win_count + ii.loss_count))
          + random() * sqrt(1.0 / (3 + ii.win_count + ii.loss_count)) AS _draw_score,
        CASE WHEN ii.dealership_id = _dealership_id THEN 0 ELSE 1 END AS _tenant_pref
      FROM industry_intel ii
      WHERE (ii.dealership_id = _dealership_id OR ii.dealership_id = 'default')
        AND ii.is_active = true
        AND ii.retired_at IS NULL
    ) ranked
    ORDER BY scope, topic, _tenant_pref, _draw_score DESC, sort_order
  LOOP
    _block := _block || E'\n[' || _r.scope || ' · ' || _r.topic || E']\n';
    _block := _block || '  ' || _r.short_claim || E'\n';
    IF _r.citable_number IS NOT NULL THEN
      _block := _block || '  Number: ' || _r.citable_number || E'\n';
    END IF;
    IF _r.use_when IS NOT NULL THEN
      _block := _block || '  Use when: ' || _r.use_when || E'\n';
    END IF;

    IF _call_id IS NOT NULL THEN
      INSERT INTO voice_call_variants_used (call_id, source_table, variant_id, slot_key, thompson_draw)
      VALUES (_call_id, 'industry_intel', _r.variant_id,
              'intel:' || _r.scope || '/' || _r.topic, _r._draw_score);
      UPDATE industry_intel SET last_promoted_at = now() WHERE variant_id = _r.variant_id;
    END IF;
  END LOOP;
  _block := _block || E'\n';

  -- ── Objection playbook — single-arm (not yet variant-tracked) ─────
  _block := _block || E'═══ OBJECTION PLAYBOOK ═══\nCompiled from objection_playbook. Match customer phrases to the right card.\n';
  FOR _r IN
    SELECT label, customer_signals, voice_ai_snippet
    FROM objection_playbook
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND is_active = true
      AND voice_ai_snippet IS NOT NULL
    ORDER BY
      CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END,
      sort_order
  LOOP
    _block := _block || E'\n— If they say something like '
      || array_to_string(_r.customer_signals[1:3], ', ')
      || ' (objection: ' || _r.label || E')\n  Say: '
      || _r.voice_ai_snippet || E'\n';
  END LOOP;
  _block := _block || E'\n';

  -- ── Live submission context ───────────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text, uuid)
  TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
