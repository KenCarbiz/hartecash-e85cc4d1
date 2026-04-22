
-- Create helper function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Referrals table
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id text NOT NULL DEFAULT 'default',
  referral_code text NOT NULL UNIQUE,
  referrer_token text,
  referrer_name text,
  referrer_email text,
  referrer_phone text,
  referred_submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  referred_name text,
  status text NOT NULL DEFAULT 'pending',
  reward_type text DEFAULT 'check',
  reward_amount numeric DEFAULT 0,
  converted_at timestamptz,
  rewarded_at timestamptz,
  referred_by_staff text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add referral_code to submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS referral_code text;

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff can read own tenant referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

CREATE POLICY "Platform admins can manage all referrals"
  ON public.referrals FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Staff can create referrals"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

CREATE POLICY "Staff can update own tenant referrals"
  ON public.referrals FOR UPDATE TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

CREATE POLICY "Anyone can read referral by code"
  ON public.referrals FOR SELECT TO anon
  USING (true);

-- Indexes
CREATE INDEX idx_referrals_code ON public.referrals (referral_code);
CREATE INDEX idx_referrals_referrer_token ON public.referrals (referrer_token);
CREATE INDEX idx_referrals_dealership ON public.referrals (dealership_id);
CREATE INDEX idx_submissions_referral_code ON public.submissions (referral_code);

-- Auto-update trigger
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
