ALTER TABLE public.voice_agent_persona
  ADD COLUMN IF NOT EXISTS variant_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS parent_variant_id uuid,
  ADD COLUMN IF NOT EXISTS win_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loss_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_from_call_id uuid;

ALTER TABLE public.conversation_phases
  ADD COLUMN IF NOT EXISTS variant_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS parent_variant_id uuid,
  ADD COLUMN IF NOT EXISTS win_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loss_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_from_call_id uuid;

ALTER TABLE public.customer_signals
  ADD COLUMN IF NOT EXISTS variant_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS parent_variant_id uuid,
  ADD COLUMN IF NOT EXISTS win_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loss_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_from_call_id uuid;

ALTER TABLE public.industry_intel
  ADD COLUMN IF NOT EXISTS variant_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS parent_variant_id uuid,
  ADD COLUMN IF NOT EXISTS win_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loss_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_from_call_id uuid;

UPDATE public.voice_agent_persona  SET variant_id = gen_random_uuid() WHERE variant_id IS NULL;
UPDATE public.conversation_phases  SET variant_id = gen_random_uuid() WHERE variant_id IS NULL;
UPDATE public.customer_signals     SET variant_id = gen_random_uuid() WHERE variant_id IS NULL;
UPDATE public.industry_intel       SET variant_id = gen_random_uuid() WHERE variant_id IS NULL;

CREATE INDEX IF NOT EXISTS voice_agent_persona_active_variants_idx
  ON public.voice_agent_persona (dealership_id, persona_name)
  WHERE retired_at IS NULL;
CREATE INDEX IF NOT EXISTS conversation_phases_active_variants_idx
  ON public.conversation_phases (dealership_id, phase_key)
  WHERE retired_at IS NULL;
CREATE INDEX IF NOT EXISTS customer_signals_active_variants_idx
  ON public.customer_signals (dealership_id, signal_key)
  WHERE retired_at IS NULL;
CREATE INDEX IF NOT EXISTS industry_intel_active_variants_idx
  ON public.industry_intel (dealership_id, scope, topic)
  WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS public.voice_call_variants_used (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL REFERENCES public.voice_call_log(id) ON DELETE CASCADE,
  source_table    text NOT NULL CHECK (source_table IN (
                    'voice_agent_persona', 'conversation_phases',
                    'customer_signals',    'industry_intel'
                  )),
  variant_id      uuid NOT NULL,
  slot_key        text NOT NULL,
  thompson_draw   numeric,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_call_variants_used_call_idx
  ON public.voice_call_variants_used (call_id);
CREATE INDEX IF NOT EXISTS voice_call_variants_used_variant_idx
  ON public.voice_call_variants_used (source_table, variant_id);

ALTER TABLE public.voice_call_variants_used ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access voice_call_variants_used" ON public.voice_call_variants_used;
CREATE POLICY "Service role full access voice_call_variants_used"
  ON public.voice_call_variants_used FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read voice_call_variants_used" ON public.voice_call_variants_used;
CREATE POLICY "Staff read voice_call_variants_used"
  ON public.voice_call_variants_used FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_voice_call_outcome(
  _call_id uuid,
  _outcome_score numeric,
  _retire_gating_failures boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  win_delta int;
  loss_delta int;
  should_retire boolean;
BEGIN
  IF _outcome_score > 0 THEN
    win_delta  := GREATEST(1, ceil(_outcome_score)::int);
    loss_delta := 0;
  ELSE
    win_delta  := 0;
    loss_delta := GREATEST(1, ceil(abs(_outcome_score))::int);
  END IF;

  should_retire := _retire_gating_failures AND _outcome_score <= -2.0;

  FOR rec IN
    SELECT source_table, variant_id
    FROM public.voice_call_variants_used
    WHERE call_id = _call_id
  LOOP
    IF rec.source_table = 'voice_agent_persona' THEN
      UPDATE public.voice_agent_persona
      SET win_count = win_count + win_delta, loss_count = loss_count + loss_delta,
          retired_at = CASE WHEN should_retire THEN now() ELSE retired_at END
      WHERE variant_id = rec.variant_id;
    ELSIF rec.source_table = 'conversation_phases' THEN
      UPDATE public.conversation_phases
      SET win_count = win_count + win_delta, loss_count = loss_count + loss_delta,
          retired_at = CASE WHEN should_retire THEN now() ELSE retired_at END
      WHERE variant_id = rec.variant_id;
    ELSIF rec.source_table = 'customer_signals' THEN
      UPDATE public.customer_signals
      SET win_count = win_count + win_delta, loss_count = loss_count + loss_delta,
          retired_at = CASE WHEN should_retire THEN now() ELSE retired_at END
      WHERE variant_id = rec.variant_id;
    ELSIF rec.source_table = 'industry_intel' THEN
      UPDATE public.industry_intel
      SET win_count = win_count + win_delta, loss_count = loss_count + loss_delta,
          retired_at = CASE WHEN should_retire THEN now() ELSE retired_at END
      WHERE variant_id = rec.variant_id;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_voice_call_outcome(uuid, numeric, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.decay_voice_variant_counts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.voice_agent_persona
  SET win_count = floor(win_count * 0.97)::int, loss_count = floor(loss_count * 0.97)::int
  WHERE win_count > 0 OR loss_count > 0;
  UPDATE public.conversation_phases
  SET win_count = floor(win_count * 0.97)::int, loss_count = floor(loss_count * 0.97)::int
  WHERE win_count > 0 OR loss_count > 0;
  UPDATE public.customer_signals
  SET win_count = floor(win_count * 0.97)::int, loss_count = floor(loss_count * 0.97)::int
  WHERE win_count > 0 OR loss_count > 0;
  UPDATE public.industry_intel
  SET win_count = floor(win_count * 0.97)::int, loss_count = floor(loss_count * 0.97)::int
  WHERE win_count > 0 OR loss_count > 0;
$$;

GRANT EXECUTE ON FUNCTION public.decay_voice_variant_counts() TO service_role;

NOTIFY pgrst, 'reload schema';