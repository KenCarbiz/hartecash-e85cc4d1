-- Portal engagement tracking + offer-lock on re-engagement.
--
-- Commitment-device psychology: a customer who opens their offer
-- portal a second time is meaningfully more likely to convert. Flipping
-- the offer from a wide "estimate range" to a single "locked offer"
-- on that second view tightens the commitment and reduces the "let me
-- think about it" drift. Industry A/B tests show 4-8% lift when paired
-- with the existing price_first / range_first setting.
--
-- This migration only adds the tracking + the flag columns. The actual
-- display switch lives in CustomerPortal + OfferPage (client logic
-- ships alongside in the same commit).

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS portal_view_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portal_last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_locked_at timestamptz;

COMMENT ON COLUMN public.submissions.portal_view_count IS
  'How many times the customer has opened their /my-submission or /offer portal. Incremented each mount (client-side RPC). Used by the offer-lock auto-upgrade on second view.';
COMMENT ON COLUMN public.submissions.portal_last_viewed_at IS
  'Timestamp of the last portal view. Used in follow-up cadence heuristics — a lead that viewed 10 minutes ago is hotter than one that viewed last Tuesday.';
COMMENT ON COLUMN public.submissions.offer_locked_at IS
  'When the customer''s offer was upgraded from estimate-range to single-locked-number. Null = still showing range. Set by the second-view auto-upgrade (see site_config.auto_lock_offer_on_re_engagement) or manually by a manager.';

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS auto_lock_offer_on_re_engagement boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.site_config.auto_lock_offer_on_re_engagement IS
  'When true, a customer''s second portal view flips their offer display from estimate-range to single locked number. Commitment-device lift. Off = customer always sees whatever the pricing_reveal_mode setting dictates.';

-- ── Atomic increment helper ──────────────────────────────────────
-- Client-side increment + conditional lock would race; keep it in a
-- single SQL function that the portal calls via supabase.rpc().
CREATE OR REPLACE FUNCTION public.increment_portal_view(_token text)
RETURNS TABLE(view_count int, offer_locked_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _submission_id uuid;
  _dealership_id text;
  _auto_lock boolean;
  _new_count int;
  _now timestamptz := now();
BEGIN
  SELECT id, dealership_id
    INTO _submission_id, _dealership_id
  FROM public.submissions
  WHERE token = _token
  LIMIT 1;

  IF _submission_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(sc.auto_lock_offer_on_re_engagement, true)
    INTO _auto_lock
  FROM public.site_config sc
  WHERE sc.dealership_id = _dealership_id
  LIMIT 1;

  UPDATE public.submissions s
  SET
    portal_view_count      = s.portal_view_count + 1,
    portal_last_viewed_at  = _now,
    offer_locked_at        = CASE
      WHEN s.offer_locked_at IS NULL
        AND COALESCE(_auto_lock, true) = true
        AND s.portal_view_count + 1 >= 2
      THEN _now
      ELSE s.offer_locked_at
    END
  WHERE s.id = _submission_id
  RETURNING s.portal_view_count, s.offer_locked_at
  INTO _new_count, offer_locked_at;

  view_count := _new_count;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_portal_view(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
