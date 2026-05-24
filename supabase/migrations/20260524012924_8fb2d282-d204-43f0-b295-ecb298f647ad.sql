-- Tighten anon INSERT policies on customer-facing tables to prevent
-- arbitrary third-party PII / notification spam abuse.

-- ── appointments ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;

CREATE POLICY "Anon can create appointments with valid token"
  ON public.appointments
  FOR INSERT
  TO anon
  WITH CHECK (
    submission_token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.token = appointments.submission_token
    )
  );

CREATE POLICY "Staff can create appointments"
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (
      is_staff(auth.uid())
      AND dealership_id = get_user_dealership_id(auth.uid())
    )
  );

-- ── offer_watches ──────────────────────────────────────────────
DROP POLICY IF EXISTS "offer_watches_insert_anyone" ON public.offer_watches;

CREATE POLICY "offer_watches_insert_with_valid_token"
  ON public.offer_watches
  FOR INSERT
  WITH CHECK (
    token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.token = offer_watches.token
    )
  );

-- ── watched_vehicles ───────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can insert watched vehicle" ON public.watched_vehicles;

CREATE POLICY "watched_vehicles_insert_with_valid_submission"
  ON public.watched_vehicles
  FOR INSERT
  WITH CHECK (
    submission_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = watched_vehicles.submission_id
    )
  );

NOTIFY pgrst, 'reload schema';
