-- Add new_car_manager to the app_role enum
--
-- Every place in the TS code already knows about 4 roles: sales_bdc,
-- used_car_manager, gsm_gm, and admin. We also have the "Appraiser"
-- credential as an additive boolean on user_roles. The missing piece
-- is a dedicated "new_car_manager" role — a common dealer title that
-- doesn't fit cleanly into any of the existing three manager tiers.
--
-- Approach: mirror used_car_manager's permissions for new_car_manager
-- in the application layer. This migration just adds the enum value
-- so user_roles.role can store it. The TS-side permission checks
-- (canSetPrice, isManager, ROLE_LABELS, etc.) are updated in the same
-- commit to treat new_car_manager identically to used_car_manager.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'new_car_manager';
