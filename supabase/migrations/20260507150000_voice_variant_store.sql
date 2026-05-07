-- Voice variant store — Phase A of the rockstar-training pipeline.
--
-- The four training-cabinet tables (voice_agent_persona,
-- conversation_phases, customer_signals, industry_intel) currently
-- have ONE row per (dealership, key). That's fine for hand-edited
-- prompts but it can't represent "we have three competing variants
-- for the 'too_low' objection signal and we want the bandit to pick
-- the best one." This migration adds variant tracking without
-- breaking the existing one-row-per-key model — a row whose
-- variant_id is unset behaves exactly as before (single-arm), and
-- additional rows with the same key + different variant_id form a
-- variant set the compile RPC samples across.
--
-- The six new columns mirror across all four cabinet tables so the
-- compile RPC and the bandit code can treat them uniformly:
--
--   variant_id           — uuid; null on legacy single-arm rows
--   parent_variant_id    — lineage; the variant this was branched from
--   win_count            — Beta(1+wins, 1+losses) Thompson α
--   loss_count           — Beta β
--   last_promoted_at     — when this variant was last picked as champion
--   retired_at           — null = active. Set by auto-retire on gating
--                          dimension fail or sustained <40% win-rate.
--   created_from_call_id — voice_call_log.id that surfaced this variant
--                          (so a manager can listen to the call that
--                          inspired the change)
--
-- Plus a join table voice_call_variants_used so every call records
-- exactly which variants compiled into its prompt — this is the key
-- that makes per-variant attribution possible. Without it the bandit
-- can see "this call won" but not "which of the 12 active variants
-- contributed."
--
-- Idempotent. Safe to re-run. Per CLAUDE.md, must be applied via
-- Lovable Push — won't auto-apply on merge.

-- ── 1. Variant columns on the four cabinet tables ──────────────────

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

-- Backfill variant_id for existing rows that came in pre-migration
-- (DEFAULT only fires on INSERT). Otherwise the compile RPC can't
-- distinguish them from each other.
UPDATE public.voice_agent_persona  SET variant_id = gen_random_uuid() WHERE variant_id IS NULL;
UPDATE public.conversation_phases  SET variant_id = gen_random_uuid() WHERE variant_id IS NULL;
UPDATE public.customer_signals     SET variant_id = gen_random_uuid() WHERE variant_id IS NULL;
UPDATE public.industry_intel       SET variant_id = gen_random_uuid() WHERE variant_id IS NULL;

-- Index active-variant lookups for the compile RPC's hot path.
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

-- ── 2. voice_call_variants_used — the attribution join ─────────────
--
-- Recorded by the compile_voice_agent_prompt RPC at call-start: one
-- row per variant that contributed to the compiled prompt. When the
-- call later resolves with a win/loss outcome, we increment win_count
-- or loss_count on every row in this table for that call.

CREATE TABLE IF NOT EXISTS public.voice_call_variants_used (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL REFERENCES public.voice_call_log(id) ON DELETE CASCADE,
  source_table    text NOT NULL CHECK (source_table IN (
                    'voice_agent_persona', 'conversation_phases',
                    'customer_signals',    'industry_intel'
                  )),
  variant_id      uuid NOT NULL,
  slot_key        text NOT NULL,             -- "phase:opening_offer_followup",
                                             -- "signal:too_low",
                                             -- "intel:industry/days_to_acquisition"
  thompson_draw   numeric,                   -- the Beta sample that picked this variant
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_call_variants_used_call_idx
  ON public.voice_call_variants_used (call_id);
CREATE INDEX IF NOT EXISTS voice_call_variants_used_variant_idx
  ON public.voice_call_variants_used (source_table, variant_id);

ALTER TABLE public.voice_call_variants_used ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access voice_call_variants_used"
  ON public.voice_call_variants_used;
CREATE POLICY "Service role full access voice_call_variants_used"
  ON public.voice_call_variants_used FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read voice_call_variants_used"
  ON public.voice_call_variants_used;
CREATE POLICY "Staff read voice_call_variants_used"
  ON public.voice_call_variants_used FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ── 3. apply_voice_call_outcome RPC ────────────────────────────────
--
-- Called by the call grader (LLM-as-judge) when a call resolves.
-- Walks voice_call_variants_used for the call_id and applies the
-- composite outcome to every contributing variant.
--
-- _outcome_score conventions (composite, not single metric):
--    +1.0   appointment set AND kept, or offer accepted
--    +0.3   appointment set, no-show
--   -0.5   warm-transfer needed (AI couldn't handle)
--   -1.0   customer NPS <= 2
--   -2.0   gating-dimension fail (TCPA, hallucination, ACV out-of-band)
--
-- Auto-retires variants on _retire_gating_failures = true.

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
  -- Convert composite score to win/loss bucket. Fractional partial-
  -- credit cases (no-show) count as small wins; gating fails count
  -- as multi-loss to crush the variant fast.
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
      SET win_count  = win_count  + win_delta,
          loss_count = loss_count + loss_delta,
          retired_at = CASE WHEN should_retire THEN now() ELSE retired_at END
      WHERE variant_id = rec.variant_id;
    ELSIF rec.source_table = 'conversation_phases' THEN
      UPDATE public.conversation_phases
      SET win_count  = win_count  + win_delta,
          loss_count = loss_count + loss_delta,
          retired_at = CASE WHEN should_retire THEN now() ELSE retired_at END
      WHERE variant_id = rec.variant_id;
    ELSIF rec.source_table = 'customer_signals' THEN
      UPDATE public.customer_signals
      SET win_count  = win_count  + win_delta,
          loss_count = loss_count + loss_delta,
          retired_at = CASE WHEN should_retire THEN now() ELSE retired_at END
      WHERE variant_id = rec.variant_id;
    ELSIF rec.source_table = 'industry_intel' THEN
      UPDATE public.industry_intel
      SET win_count  = win_count  + win_delta,
          loss_count = loss_count + loss_delta,
          retired_at = CASE WHEN should_retire THEN now() ELSE retired_at END
      WHERE variant_id = rec.variant_id;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_voice_call_outcome(uuid, numeric, boolean)
  TO service_role;

-- ── 4. decay_voice_variant_counts RPC ──────────────────────────────
--
-- Nightly cron job. Multiplies win/loss counts by 0.97 so stale
-- variants drift back toward exploration — without decay, an early
-- winner with 50 wins / 5 losses would dominate forever even if its
-- real performance has degraded since it last ran.

CREATE OR REPLACE FUNCTION public.decay_voice_variant_counts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.voice_agent_persona
  SET win_count  = floor(win_count  * 0.97)::int,
      loss_count = floor(loss_count * 0.97)::int
  WHERE win_count > 0 OR loss_count > 0;

  UPDATE public.conversation_phases
  SET win_count  = floor(win_count  * 0.97)::int,
      loss_count = floor(loss_count * 0.97)::int
  WHERE win_count > 0 OR loss_count > 0;

  UPDATE public.customer_signals
  SET win_count  = floor(win_count  * 0.97)::int,
      loss_count = floor(loss_count * 0.97)::int
  WHERE win_count > 0 OR loss_count > 0;

  UPDATE public.industry_intel
  SET win_count  = floor(win_count  * 0.97)::int,
      loss_count = floor(loss_count * 0.97)::int
  WHERE win_count > 0 OR loss_count > 0;
$$;

GRANT EXECUTE ON FUNCTION public.decay_voice_variant_counts() TO service_role;

NOTIFY pgrst, 'reload schema';
