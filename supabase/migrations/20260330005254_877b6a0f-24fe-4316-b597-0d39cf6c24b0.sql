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
  IF NEW.plan_tier NOT IN ('standard') THEN
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
$function$;