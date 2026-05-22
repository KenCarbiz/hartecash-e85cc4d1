-- Phase 1 portal wire-up — extend get_submission_portal RPC.
--
-- The new customer portal at /my-submission/:token reads the same
-- columns the legacy portal does, plus a handful that already exist
-- on submissions but aren't currently returned by the RPC:
--
--   * dealership_id                       — already on submissions, used by
--                                           increment_portal_view; the new
--                                           portal needs it to join dealer
--                                           settings client-side without a
--                                           second roundtrip
--   * state                               — customer's state of residence,
--                                           drives the locale-specific
--                                           disclosure copy (e.g. California
--                                           SB 766 3-day right to cancel)
--   * inspection_started_notified_at      — drives the activity feed timeline
--                                           and the "inspector arrived" pill
--                                           in the Dashboard / Activity pages
--   * check_ready_at                      — drives the "payment ready" event
--                                           in Activity and the Payment stage
--                                           pill on the Dashboard
--   * offer_locked_at                     — drives the offer-expiry countdown
--                                           (locked_at + price_guarantee_days)
--                                           that the new OffersPage renders
--                                           live; today the customer portal
--                                           re-fetches it via a separate
--                                           submissions select
--   * portal_view_count                   — drives the "Returning visit"
--                                           greeting variant and is used by
--                                           the Activity page
--
-- The RPC is SECURITY DEFINER with an explicit token + token_expires_at
-- check, matching the existing signature. No new schema, no RLS change.
-- Idempotent via CREATE OR REPLACE FUNCTION (Postgres allows changing
-- the return type of a function only via DROP FUNCTION first, so we
-- DROP then CREATE — both guarded with IF EXISTS).
--
-- After this lands the new portal can ship 7+ pages on real data with
-- no further DB changes. The Documents and Messages pages still need
-- their own tables (Phase 2) and Payments/Pickup/Analytics need
-- additional schema for full fidelity (Phase 3).
--
-- Per CLAUDE.md: this migration does NOT auto-apply on merge. Run via
-- Lovable Push or `supabase db push` or SQL Editor after merging.

DROP FUNCTION IF EXISTS public.get_submission_portal(text);

CREATE FUNCTION public.get_submission_portal(_token text)
RETURNS TABLE(
  id uuid,
  vehicle_year text,
  vehicle_make text,
  vehicle_model text,
  name text,
  email text,
  phone text,
  mileage text,
  exterior_color text,
  overall_condition text,
  progress_status text,
  offered_price numeric,
  acv_value numeric,
  photos_uploaded boolean,
  docs_uploaded boolean,
  created_at timestamp with time zone,
  loan_status text,
  token text,
  vin text,
  zip text,
  estimated_offer_low numeric,
  estimated_offer_high numeric,
  bb_tradein_avg numeric,
  appointment_set boolean,
  brake_lf integer, brake_rf integer, brake_lr integer, brake_rr integer,
  tire_lf integer, tire_rf integer, tire_lr integer, tire_rr integer,
  -- ── new fields for the Phase 1 portal wire-up ──
  dealership_id text,
  state text,
  inspection_started_notified_at timestamp with time zone,
  check_ready_at timestamp with time zone,
  offer_locked_at timestamp with time zone,
  portal_view_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.id, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name, s.email, s.phone,
    s.mileage, s.exterior_color, s.overall_condition, s.progress_status,
    s.offered_price, s.acv_value, s.photos_uploaded, s.docs_uploaded, s.created_at,
    s.loan_status, s.token, s.vin, s.zip,
    s.estimated_offer_low, s.estimated_offer_high, s.bb_tradein_avg,
    s.appointment_set,
    s.brake_lf, s.brake_rf, s.brake_lr, s.brake_rr,
    s.tire_lf, s.tire_rf, s.tire_lr, s.tire_rr,
    s.dealership_id,
    s.state,
    s.inspection_started_notified_at,
    s.check_ready_at,
    s.offer_locked_at,
    s.portal_view_count
  FROM submissions s
  WHERE s.token = _token
    AND (s.token_expires_at IS NULL OR s.token_expires_at > now());
$$;

GRANT EXECUTE ON FUNCTION public.get_submission_portal(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
