-- Remove permissive public-role write policies on dealer_subscriptions.
-- Trial creation/update must be performed by authenticated platform admins
-- or service-role edge functions, not anonymous web visitors.
DROP POLICY IF EXISTS "dealer_subscriptions_insert" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "dealer_subscriptions_update" ON public.dealer_subscriptions;