
-- Add max_locations column
ALTER TABLE public.dealer_accounts
ADD COLUMN IF NOT EXISTS max_locations integer NOT NULL DEFAULT 2;

-- Update the validation trigger to accept new plan tiers
CREATE OR REPLACE FUNCTION public.validate_dealer_account()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.architecture NOT IN ('single_store', 'multi_location', 'dealer_group') THEN
    RAISE EXCEPTION 'Invalid architecture: %', NEW.architecture;
  END IF;
  IF NEW.bdc_model NOT IN ('no_bdc', 'single_bdc', 'multi_bdc', 'ai_bdc') THEN
    RAISE EXCEPTION 'Invalid bdc_model: %', NEW.bdc_model;
  END IF;
  IF NEW.plan_tier NOT IN ('standard', 'multi_store', 'group', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid plan_tier: %', NEW.plan_tier;
  END IF;
  IF NEW.onboarding_status NOT IN ('pending', 'active', 'paused', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid onboarding_status: %', NEW.onboarding_status;
  END IF;
  IF NEW.billing_date IS NOT NULL AND (NEW.billing_date < 1 OR NEW.billing_date > 31) THEN
    RAISE EXCEPTION 'billing_date must be between 1 and 31';
  END IF;

  -- Auto-set plan_cost and max_locations based on tier
  IF NEW.plan_tier = 'standard' THEN
    NEW.plan_cost := 1995;
    NEW.max_locations := 2;
  ELSIF NEW.plan_tier = 'multi_store' THEN
    NEW.plan_cost := 2995;
    NEW.max_locations := 5;
  ELSIF NEW.plan_tier = 'group' THEN
    NEW.plan_cost := 3995;
    NEW.max_locations := 10;
  ELSIF NEW.plan_tier = 'enterprise' THEN
    -- Enterprise keeps whatever custom cost was set
    IF NEW.plan_cost < 3995 THEN
      NEW.plan_cost := 3995;
    END IF;
    NEW.max_locations := 999;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Update existing standard accounts to have correct cost
UPDATE public.dealer_accounts SET plan_cost = 1995 WHERE plan_tier = 'standard' AND plan_cost = 0;
