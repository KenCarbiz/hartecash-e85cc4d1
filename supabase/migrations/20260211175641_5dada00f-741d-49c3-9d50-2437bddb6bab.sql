
-- Step 1: Add new roles to the enum only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_bdc';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'used_car_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gsm_gm';
