
CREATE TABLE public.dealer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default' UNIQUE,
  
  -- Architecture
  architecture text NOT NULL DEFAULT 'single_store',
  -- CHECK via trigger below
  
  -- BDC Model
  bdc_model text NOT NULL DEFAULT 'single_bdc',
  
  -- Billing
  start_date date,
  billing_date integer, -- day of month 1-31
  plan_tier text NOT NULL DEFAULT 'standard',
  plan_cost numeric NOT NULL DEFAULT 0,
  
  -- Meta
  special_instructions text NOT NULL DEFAULT '',
  onboarding_status text NOT NULL DEFAULT 'pending',
  onboarded_by text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_dealer_account()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.architecture NOT IN ('single_store', 'multi_location', 'dealer_group') THEN
    RAISE EXCEPTION 'Invalid architecture: %', NEW.architecture;
  END IF;
  IF NEW.bdc_model NOT IN ('single_bdc', 'multi_bdc', 'ai_bdc') THEN
    RAISE EXCEPTION 'Invalid bdc_model: %', NEW.bdc_model;
  END IF;
  IF NEW.plan_tier NOT IN ('starter', 'standard', 'premium', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid plan_tier: %', NEW.plan_tier;
  END IF;
  IF NEW.onboarding_status NOT IN ('pending', 'active', 'paused', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid onboarding_status: %', NEW.onboarding_status;
  END IF;
  IF NEW.billing_date IS NOT NULL AND (NEW.billing_date < 1 OR NEW.billing_date > 31) THEN
    RAISE EXCEPTION 'billing_date must be between 1 and 31';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_dealer_account_trigger
  BEFORE INSERT OR UPDATE ON public.dealer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.validate_dealer_account();

-- RLS
ALTER TABLE public.dealer_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dealer accounts"
  ON public.dealer_accounts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read dealer accounts"
  ON public.dealer_accounts FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));
