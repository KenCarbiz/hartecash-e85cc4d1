CREATE OR REPLACE VIEW public.v_unmatched_customer_phrases AS
WITH recent_unmatched AS (
  SELECT
    vct.call_id,
    vct.text,
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
  min(ru.text)                       AS sample_text,
  count(*)                           AS occurrence_count,
  count(DISTINCT ru.call_id)         AS distinct_calls,
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
HAVING count(*) >= 2
ORDER BY
  count(*) * (1 - coalesce(avg(g.composite_score), 0)) DESC,
  count(*) DESC
LIMIT 50;

GRANT SELECT ON public.v_unmatched_customer_phrases TO authenticated;

NOTIFY pgrst, 'reload schema';