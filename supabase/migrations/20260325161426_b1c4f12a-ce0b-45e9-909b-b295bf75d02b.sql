
-- Add individual section overrides per staff member
-- This allows granting specific sections without needing a permission group
ALTER TABLE public.staff_permission_assignments
  ADD COLUMN IF NOT EXISTS individual_sections text[] NOT NULL DEFAULT '{}';

-- Allow the column to be used standalone (without a permission group)
ALTER TABLE public.staff_permission_assignments
  ALTER COLUMN permission_group_id DROP NOT NULL;

-- Drop the unique constraint on (user_id, permission_group_id) and replace
-- We need to allow one row per user for individual sections
ALTER TABLE public.staff_permission_assignments
  DROP CONSTRAINT IF EXISTS staff_permission_assignments_user_id_permission_group_id_key;

-- Add a unique constraint that allows one individual-sections row per user
CREATE UNIQUE INDEX IF NOT EXISTS staff_perm_user_individual_idx
  ON public.staff_permission_assignments (user_id)
  WHERE permission_group_id IS NULL;
