-- offer_watches: customers subscribing to market-value change alerts
-- for their vehicle. Backs the OfferWatch component in the customer
-- portal. Previously the component inserted into a missing table and
-- silently swallowed the error; this migration creates the real table.

CREATE TABLE IF NOT EXISTS public.offer_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  email text NOT NULL,
  phone text,
  vehicle text,
  current_offer numeric(10, 2),
  is_active boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  notification_count int NOT NULL DEFAULT 0,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS offer_watches_token_email_idx
  ON public.offer_watches (token, email);

CREATE INDEX IF NOT EXISTS offer_watches_email_active_idx
  ON public.offer_watches (email)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS offer_watches_unsubscribe_token_idx
  ON public.offer_watches (unsubscribe_token);

ALTER TABLE public.offer_watches ENABLE ROW LEVEL SECURITY;

-- Anyone can insert — customer portal is unauthenticated and uses the
-- submission token for identification. Keeps the flow friction-free.
DROP POLICY IF EXISTS "offer_watches_insert_anyone" ON public.offer_watches;
CREATE POLICY "offer_watches_insert_anyone"
  ON public.offer_watches
  FOR INSERT
  WITH CHECK (true);

-- Only staff can read the list (for BDC follow-ups and analytics).
DROP POLICY IF EXISTS "offer_watches_staff_read" ON public.offer_watches;
CREATE POLICY "offer_watches_staff_read"
  ON public.offer_watches
  FOR SELECT
  USING (is_staff(auth.uid()));

-- Anonymous reads are explicitly denied (defense in depth).
DROP POLICY IF EXISTS "offer_watches_deny_anon_read" ON public.offer_watches;
CREATE POLICY "offer_watches_deny_anon_read"
  ON public.offer_watches
  AS RESTRICTIVE
  FOR SELECT
  TO anon
  USING (false);

-- Unsubscribe flow uses the unsubscribe_token as the rotating credential
-- and is served by a server-side edge function, so no direct UPDATE/DELETE
-- from the anon role is required.
