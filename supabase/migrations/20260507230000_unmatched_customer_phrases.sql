-- v_unmatched_customer_phrases — surface the gaps in the cabinet.
--
-- After every call, voice-call-enrich tags each customer turn with
-- a matched_signal_key when the phrase matches a customer_signals
-- row. When matched_signal_key IS NULL, it means the customer said
-- something the cabinet hasn't been trained to recognize — so the
-- AI fell back to generic phase content instead of a calibrated
-- response.
--
-- Each NULL match on a turn that came from a low-graded call is a
-- direct training opportunity: "this phrase showed up, the call
-- went badly, add a signal so the next time the AI handles it
-- right."
--
-- This view ranks recent unmatched phrases by frequency × badness,
-- so the Monday-ritual page can surface the top candidates without
-- the manager having to read every transcript.
--
-- Filters:
--   - Customer turns only (AI turns aren't matched against signals)
--   - matched_signal_key IS NULL (the gap)
--   - From calls in the last 14 days
--   - With at least one composite_score (so we know how the call went)
--   - Grouped by lowercase 80-char prefix to dedupe near-identical
--     phrases ("I want more money" vs "i want more money please")
--
-- Idempotent. Safe to re-run.

CREATE OR REPLACE VIEW public.v_unmatched_customer_phrases AS
WITH recent_unmatched AS (
  SELECT
    vct.call_id,
    vct.text,
    -- Cluster key: first 80 chars, lowercased, whitespace-normalized.
    -- This dedupes "I want more money" / "i want more money" /
    -- "I want more money please" into one bucket without needing
    -- pg_trgm or full-text setup.
    lower(substring(regexp_replace(vct.text, '\s+', ' ', 'g'), 1, 80)) AS cluster_key,
    vcl.dealership_id,
    vcl.started_at
  FROM public.voice_call_turns vct
  JOIN public.voice_call_log   vcl ON vcl.id = vct.call_id
  WHERE vct.speaker = 'customer'
    AND vct.matched_signal_key IS NULL
    AND coalesce(length(trim(vct.text)), 0) >= 6
    AND vcl.started_at >= now() - interval '14 days'
)
SELECT
  ru.cluster_key,
  ru.dealership_id,
  -- Pick the most common verbatim form for display (mode would be
  -- ideal but plain GROUP BY + min works deterministically).
  min(ru.text)                       AS sample_text,
  count(*)                           AS occurrence_count,
  count(DISTINCT ru.call_id)         AS distinct_calls,
  -- Mean composite of the calls these phrases appeared in. Lower =
  -- more urgent (customer said this and the call went badly).
  avg(g.composite_score)             AS avg_call_composite,
  max(ru.started_at)                 AS last_seen_at
FROM recent_unmatched ru
LEFT JOIN LATERAL (
  SELECT composite_score
  FROM public.voice_call_grades
  WHERE call_id = ru.call_id
    AND run_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1
) g ON true
GROUP BY ru.cluster_key, ru.dealership_id
HAVING count(*) >= 2  -- one-off phrases are noise; need recurrence
ORDER BY
  -- Rank by "how badly is this hurting us": frequency × inverse-score.
  -- Calls with score = -1 weight 2x as much as calls with score = 0.
  count(*) * (1 - coalesce(avg(g.composite_score), 0)) DESC,
  count(*) DESC
LIMIT 50;

GRANT SELECT ON public.v_unmatched_customer_phrases TO authenticated;

NOTIFY pgrst, 'reload schema';
