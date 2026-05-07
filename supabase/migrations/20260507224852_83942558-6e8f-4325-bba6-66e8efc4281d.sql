-- customer_signals
ALTER TABLE public.customer_signals
  ADD COLUMN IF NOT EXISTS variant_label text NOT NULL DEFAULT 'default';

DO $$
DECLARE _conname text;
BEGIN
  SELECT conname INTO _conname
  FROM pg_constraint
  WHERE conrelid = 'public.customer_signals'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%(dealership_id, signal_key)%'
    AND pg_get_constraintdef(oid) NOT LIKE '%variant_label%';
  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.customer_signals DROP CONSTRAINT %I', _conname);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.customer_signals'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(dealership_id, signal_key, variant_label)%'
  ) THEN
    ALTER TABLE public.customer_signals
      ADD CONSTRAINT customer_signals_dealer_key_variant_unique
      UNIQUE (dealership_id, signal_key, variant_label);
  END IF;
END $$;

-- industry_intel
ALTER TABLE public.industry_intel
  ADD COLUMN IF NOT EXISTS variant_label text NOT NULL DEFAULT 'default';

DO $$
DECLARE _conname text;
BEGIN
  SELECT conname INTO _conname
  FROM pg_constraint
  WHERE conrelid = 'public.industry_intel'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%(dealership_id, scope, topic)%'
    AND pg_get_constraintdef(oid) NOT LIKE '%variant_label%';
  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.industry_intel DROP CONSTRAINT %I', _conname);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.industry_intel'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(dealership_id, scope, topic, variant_label)%'
  ) THEN
    ALTER TABLE public.industry_intel
      ADD CONSTRAINT industry_intel_dealer_topic_variant_unique
      UNIQUE (dealership_id, scope, topic, variant_label);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';