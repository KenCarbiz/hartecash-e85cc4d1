-- 1. Add store_location_id to submissions
ALTER TABLE public.submissions
  ADD COLUMN store_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL;

-- 2. Add ZIP code column to dealership_locations for proximity matching
ALTER TABLE public.dealership_locations
  ADD COLUMN zip_codes text[] NOT NULL DEFAULT '{}';

-- 3. Fix security: drop anon read on follow_ups
DROP POLICY "Service role can read follow-ups" ON public.follow_ups;

-- 4. Fix security: drop anon INSERT on follow_ups  
DROP POLICY "Service role can insert follow-ups" ON public.follow_ups;

-- 5. Fix security: drop anon read on opt_outs (staff policy already covers it)
-- Note: The "Staff can read opt-outs" policy already exists for authenticated staff
-- Edge functions use service_role key which bypasses RLS
DROP POLICY IF EXISTS "Service role can read opt-outs" ON public.opt_outs;