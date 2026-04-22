
-- Add approval fields to pricing_models
ALTER TABLE public.pricing_models
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add approver role config to dealer_accounts
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS offer_logic_approver_role text NOT NULL DEFAULT 'gsm_gm';

-- Create a trigger to prevent activating unapproved models
CREATE OR REPLACE FUNCTION public.enforce_pricing_model_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _approver_role text;
BEGIN
  -- If trying to activate a model that isn't approved, block it
  IF NEW.is_active = true AND OLD.is_active = false AND NEW.approval_status != 'approved' THEN
    RAISE EXCEPTION 'Cannot activate a pricing model that has not been approved. Current status: %', NEW.approval_status;
  END IF;

  -- If changing approval_status to 'approved', verify the user has the right role
  IF NEW.approval_status = 'approved' AND OLD.approval_status != 'approved' THEN
    SELECT offer_logic_approver_role INTO _approver_role
    FROM dealer_accounts
    WHERE dealership_id = NEW.dealership_id
    LIMIT 1;

    _approver_role := COALESCE(_approver_role, 'gsm_gm');

    IF NOT (
      is_platform_admin(auth.uid())
      OR has_role(auth.uid(), _approver_role::app_role)
    ) THEN
      RAISE EXCEPTION 'Only % or platform admins can approve pricing models', _approver_role;
    END IF;

    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;

  -- If changing approval_status to 'rejected', same authority check
  IF NEW.approval_status = 'rejected' AND OLD.approval_status != 'rejected' THEN
    SELECT offer_logic_approver_role INTO _approver_role
    FROM dealer_accounts
    WHERE dealership_id = NEW.dealership_id
    LIMIT 1;

    _approver_role := COALESCE(_approver_role, 'gsm_gm');

    IF NOT (
      is_platform_admin(auth.uid())
      OR has_role(auth.uid(), _approver_role::app_role)
    ) THEN
      RAISE EXCEPTION 'Only % or platform admins can reject pricing models', _approver_role;
    END IF;
  END IF;

  -- If submitting for approval, record who submitted
  IF NEW.approval_status = 'pending' AND OLD.approval_status != 'pending' THEN
    NEW.submitted_by := auth.uid();
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_pricing_model_approval_trigger ON public.pricing_models;
CREATE TRIGGER enforce_pricing_model_approval_trigger
  BEFORE UPDATE ON public.pricing_models
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pricing_model_approval();
