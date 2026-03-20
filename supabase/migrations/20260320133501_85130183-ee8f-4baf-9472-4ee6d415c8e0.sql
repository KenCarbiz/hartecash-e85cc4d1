
CREATE POLICY "Anyone can submit a review"
  ON public.testimonials FOR INSERT
  TO public
  WITH CHECK (is_active = false);
