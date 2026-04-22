
-- Allow dealership admins to manage their own tenants
CREATE POLICY "Dealership admins can manage own tenants"
  ON public.tenants
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  );
