-- Restore the UNIQUE(dealership_id) constraint on dealer_subscriptions.
--
-- Heal migration 20260415140000 altered that column from uuid to text.
-- PostgreSQL rebuilds the column when the type changes and silently
-- drops the inline UNIQUE constraint declared at table-create time.
-- That's why Billing & Plan autosave now fails with:
--   there is no unique or exclusion constraint matching the ON CONFLICT
--
-- Re-adding the constraint restores the path the picker's upsert uses
-- (onConflict: "dealership_id"). De-dup first so the ADD CONSTRAINT
-- can't fail on pre-existing duplicate rows.

-- 1. De-duplicate rows keyed by dealership_id, keeping the most
-- recently updated one. Safe on small tables (dealer_subscriptions
-- has one row per tenant by design).
DELETE FROM public.dealer_subscriptions a
      USING public.dealer_subscriptions b
 WHERE a.dealership_id = b.dealership_id
   AND a.updated_at    < b.updated_at;

-- 2. Add the unique constraint if it's missing. Check by catalog
-- lookup instead of CREATE UNIQUE INDEX IF NOT EXISTS so we end up
-- with a named CONSTRAINT (which onConflict can target reliably).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'dealer_subscriptions'
       AND c.contype = 'u'
       AND EXISTS (
         SELECT 1
           FROM unnest(c.conkey) AS k
           JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
          WHERE a.attname = 'dealership_id'
       )
  ) THEN
    ALTER TABLE public.dealer_subscriptions
      ADD CONSTRAINT dealer_subscriptions_dealership_id_key UNIQUE (dealership_id);
  END IF;
END $$;

-- 3. Force PostgREST to reload its schema cache so the unique
-- constraint is visible to ON CONFLICT on the next upsert.
NOTIFY pgrst, 'reload schema';
