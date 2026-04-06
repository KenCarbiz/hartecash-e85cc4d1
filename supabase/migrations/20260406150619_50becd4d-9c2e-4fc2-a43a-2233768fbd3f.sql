
-- 1. Add location_id to user_roles (nullable = all locations for that dealership)
ALTER TABLE public.user_roles
ADD COLUMN location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL DEFAULT NULL;

-- 2. Create a function to check if a staff member can view a submission
CREATE OR REPLACE FUNCTION public.can_view_submission(_user_id uuid, _submission_dealership_id text, _submission_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Platform super-admin can see everything
    is_platform_admin(_user_id)
    OR (
      -- Must be staff
      is_staff(_user_id)
      AND (
        -- Dealership admin sees all stores in their dealership
        (
          has_role(_user_id, 'admin'::app_role)
          AND get_user_dealership_id(_user_id) = _submission_dealership_id
        )
        OR (
          -- Non-admin staff: must match dealership AND location
          get_user_dealership_id(_user_id) = _submission_dealership_id
          AND (
            -- Staff has no location restriction (location_id IS NULL = all locations)
            EXISTS (
              SELECT 1 FROM user_roles
              WHERE user_id = _user_id
              AND dealership_id = _submission_dealership_id
              AND location_id IS NULL
            )
            OR
            -- Staff location matches submission location
            EXISTS (
              SELECT 1 FROM user_roles
              WHERE user_id = _user_id
              AND dealership_id = _submission_dealership_id
              AND location_id = _submission_location_id
            )
          )
        )
      )
    );
$$;

-- 3. Drop old submission SELECT policies
DROP POLICY IF EXISTS "Staff can read all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can read own tenant submissions" ON public.submissions;

-- 4. Create new location-scoped SELECT policy
CREATE POLICY "Staff can read scoped submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (
  can_view_submission(auth.uid(), dealership_id, store_location_id)
);

-- 5. Update the UPDATE policy to also be location-scoped
DROP POLICY IF EXISTS "Staff can update own tenant submissions" ON public.submissions;

CREATE POLICY "Staff can update scoped submissions"
ON public.submissions
FOR UPDATE
TO authenticated
USING (
  can_view_submission(auth.uid(), dealership_id, store_location_id)
);

-- 6. Update delete policy to allow dealership admins + platform admins
DROP POLICY IF EXISTS "Only admins can delete submissions" ON public.submissions;

CREATE POLICY "Admins can delete submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
);
