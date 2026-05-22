-- Phase 1 portal wire-up — get_submission_activity RPC.
--
-- The new portal's ActivityPage today reads a hand-curated MOCK
-- array. This RPC returns a customer-safe timeline by unioning what
-- already exists in the schema:
--
--   * submissions lifecycle stamps (created_at, offer_locked_at,
--     inspection_started_notified_at, check_ready_at)
--   * appointments (booking and reschedule events)
--   * a whitelisted slice of activity_log (today RLS-gated to staff
--     only; this SECURITY DEFINER RPC re-exposes only the actions
--     that are safe to show a customer about their own submission)
--
-- Why an RPC and not a view: activity_log's RLS policy only grants
-- read to staff (auth.uid()-based). A view inherits the underlying
-- table's RLS. SECURITY DEFINER + an explicit token check is the
-- right pattern for a token-scoped customer read of staff-owned data.
--
-- Whitelist of activity_log actions surfaced to the customer:
--   - photos_uploaded
--   - docs_uploaded
--   - offer_accepted
--   - inspection_started
--   - check_ready
-- Any other action stays private (notes, internal status changes,
-- price adjustments before lock, etc.).
--
-- Per CLAUDE.md: this migration does NOT auto-apply on merge. Run via
-- Lovable Push or `supabase db push` or SQL Editor after merging.

DROP FUNCTION IF EXISTS public.get_submission_activity(text);

CREATE FUNCTION public.get_submission_activity(_token text)
RETURNS TABLE(
  id text,
  event_type text,         -- 'submission' | 'offer' | 'pickup' | 'inspection' | 'payment' | 'photos' | 'docs' | 'system'
  title text,
  body text,
  occurred_at timestamp with time zone,
  nav_target text          -- optional sub-page key the row links to ('vehicles', 'offers', 'pickup', 'documents', 'payments', NULL)
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT *
    FROM submissions
    WHERE token = _token
      AND (token_expires_at IS NULL OR token_expires_at > now())
    LIMIT 1
  )
  -- Submission created
  SELECT
    'sub-' || s.id::text,
    'submission',
    'Vehicle submitted',
    concat('You submitted your ',
      coalesce(s.vehicle_year, ''), ' ',
      coalesce(s.vehicle_make, ''), ' ',
      coalesce(s.vehicle_model, '')),
    s.created_at,
    'vehicles'::text
  FROM s

  UNION ALL
  -- Firm offer issued (only when an offer is actually locked)
  SELECT
    'offer-' || s.id::text,
    'offer',
    'Firm offer issued',
    concat('Your firm offer: $',
      to_char(coalesce(s.offered_price, 0)::numeric, 'FM999,999,999')),
    s.offer_locked_at,
    'offers'::text
  FROM s
  WHERE s.offered_price IS NOT NULL AND s.offer_locked_at IS NOT NULL

  UNION ALL
  -- Inspection started (dealer-side stamped when inspector clocks in)
  SELECT
    'insp-' || s.id::text,
    'inspection',
    'Inspection started',
    'The dealer began inspecting your vehicle.',
    s.inspection_started_notified_at,
    NULL::text
  FROM s
  WHERE s.inspection_started_notified_at IS NOT NULL

  UNION ALL
  -- Check ready (dealer-side stamped when payout cleared internal review)
  SELECT
    'check-' || s.id::text,
    'payment',
    'Payment ready',
    'Your payout has been cut and is ready for delivery.',
    s.check_ready_at,
    'payments'::text
  FROM s
  WHERE s.check_ready_at IS NOT NULL

  UNION ALL
  -- Appointments (booking + confirmation lifecycle)
  SELECT
    'appt-' || a.id::text,
    'pickup',
    'Pickup appointment scheduled',
    concat('Scheduled for ',
      coalesce(a.preferred_date::text, ''),
      coalesce(' ' || a.preferred_time::text, '')),
    a.created_at,
    'pickup'::text
  FROM s
  JOIN appointments a ON a.submission_token = s.token

  UNION ALL
  -- Whitelisted activity_log entries
  SELECT
    'al-' || al.id::text,
    CASE al.action
      WHEN 'photos_uploaded'    THEN 'photos'
      WHEN 'docs_uploaded'      THEN 'docs'
      WHEN 'offer_accepted'     THEN 'offer'
      WHEN 'inspection_started' THEN 'inspection'
      WHEN 'check_ready'        THEN 'payment'
      ELSE 'system'
    END,
    CASE al.action
      WHEN 'photos_uploaded'    THEN 'Photos uploaded'
      WHEN 'docs_uploaded'      THEN 'Documents uploaded'
      WHEN 'offer_accepted'     THEN 'Offer accepted'
      WHEN 'inspection_started' THEN 'Inspection started'
      WHEN 'check_ready'        THEN 'Payment ready'
      ELSE al.action
    END,
    coalesce(al.new_value, ''),
    al.created_at,
    CASE al.action
      WHEN 'photos_uploaded' THEN 'documents'
      WHEN 'docs_uploaded'   THEN 'documents'
      WHEN 'offer_accepted'  THEN 'offers'
      WHEN 'check_ready'     THEN 'payments'
      ELSE NULL
    END::text
  FROM s
  JOIN activity_log al ON al.submission_id = s.id
  WHERE al.action IN (
    'photos_uploaded',
    'docs_uploaded',
    'offer_accepted',
    'inspection_started',
    'check_ready'
  )

  ORDER BY 5 DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_submission_activity(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
