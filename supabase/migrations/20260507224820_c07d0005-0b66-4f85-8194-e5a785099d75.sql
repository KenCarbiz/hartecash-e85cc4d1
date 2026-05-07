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