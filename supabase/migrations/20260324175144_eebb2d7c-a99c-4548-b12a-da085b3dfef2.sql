-- Allow admins to delete cached images
CREATE POLICY "Admins can delete vehicle image cache"
  ON public.vehicle_image_cache FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage all operations
CREATE POLICY "Admins can manage vehicle image cache"
  ON public.vehicle_image_cache FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));