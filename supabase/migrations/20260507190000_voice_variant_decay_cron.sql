-- Nightly variant-count decay schedule.
--
-- The variant store accumulates win/loss counts forever — without
-- decay, an early winner with 50 wins / 5 losses would dominate
-- compile-time selection forever even after its real performance
-- has degraded (cabinet drift, customer-segment shift, stale
-- evidence). Decay re-introduces exploration by shrinking both
-- counts toward zero on a slow schedule.
--
-- decay_voice_variant_counts() (defined in 20260507150000) does:
--   UPDATE voice_agent_persona / conversation_phases /
--          customer_signals / industry_intel
--   SET win_count  = floor(win_count  * 0.97)
--       loss_count = floor(loss_count * 0.97)
--   WHERE win_count > 0 OR loss_count > 0;
--
-- Schedule: 04:15 UTC nightly (off-peak, after most US calls done).
-- 0.97 daily ≈ 0.81 over a week, ≈ 0.39 over a month — old wins
-- still favor exploit but new evidence catches up in days, not
-- months.
--
-- Idempotent: unschedule-if-exists before re-scheduling.

SELECT cron.unschedule('decay_voice_variant_counts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'decay_voice_variant_counts'
);

SELECT cron.schedule(
  'decay_voice_variant_counts',
  '15 4 * * *',
  $$ SELECT public.decay_voice_variant_counts() $$
);

NOTIFY pgrst, 'reload schema';
