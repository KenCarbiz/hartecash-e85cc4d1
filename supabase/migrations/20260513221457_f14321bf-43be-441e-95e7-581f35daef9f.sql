
-- 1. dealer_accounts secret split
CREATE TABLE IF NOT EXISTS public.dealer_voice_secrets (
  dealership_id text PRIMARY KEY,
  voice_ai_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.dealer_voice_secrets (dealership_id, voice_ai_api_key)
SELECT dealership_id, voice_ai_api_key
FROM public.dealer_accounts
WHERE voice_ai_api_key IS NOT NULL AND voice_ai_api_key <> ''
ON CONFLICT (dealership_id) DO NOTHING;

ALTER TABLE public.dealer_voice_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own voice secrets" ON public.dealer_voice_secrets;
CREATE POLICY "Admins manage own voice secrets"
  ON public.dealer_voice_secrets FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role)
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role)
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Deny anon dealer voice secrets" ON public.dealer_voice_secrets;
CREATE POLICY "Deny anon dealer voice secrets"
  ON public.dealer_voice_secrets AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

ALTER TABLE public.dealer_accounts DROP COLUMN IF EXISTS voice_ai_api_key;

DROP POLICY IF EXISTS "Staff can read dealer accounts" ON public.dealer_accounts;
CREATE POLICY "Staff can read own tenant dealer accounts"
  ON public.dealer_accounts FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid())
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- 2. referrals deny anon SELECT
DROP POLICY IF EXISTS "Deny anon read referrals" ON public.referrals;
CREATE POLICY "Deny anon read referrals"
  ON public.referrals AS RESTRICTIVE FOR SELECT TO anon
  USING (false);

-- 3. opt_outs delete scoping
DROP POLICY IF EXISTS "Staff can delete opt-outs" ON public.opt_outs;
CREATE POLICY "Staff can delete own tenant opt-outs"
  ON public.opt_outs FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND submission_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id = opt_outs.submission_id
          AND s.dealership_id = public.get_user_dealership_id(auth.uid())
      )
    )
  );

-- 4. voice_campaigns admin scoping (uuid cast)
DROP POLICY IF EXISTS "Admin can manage campaigns" ON public.voice_campaigns;
CREATE POLICY "Admin can manage own tenant campaigns"
  ON public.voice_campaigns FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role)
        AND dealership_id = public.get_user_dealership_id(auth.uid())::uuid)
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role)
        AND dealership_id = public.get_user_dealership_id(auth.uid())::uuid)
  );

-- 5. promotions write scoping
DROP POLICY IF EXISTS "Staff can create promotions" ON public.promotions;
CREATE POLICY "Staff can create own tenant promotions"
  ON public.promotions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid())
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Staff can update promotions" ON public.promotions;
CREATE POLICY "Staff can update own tenant promotions"
  ON public.promotions FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid())
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid())
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Staff can delete promotions" ON public.promotions;
CREATE POLICY "Staff can delete own tenant promotions"
  ON public.promotions FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid())
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

NOTIFY pgrst, 'reload schema';
