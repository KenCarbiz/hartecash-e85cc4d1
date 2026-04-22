
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  bonus_amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_on_widget BOOLEAN NOT NULL DEFAULT true,
  show_on_portal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view promotions"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can create promotions"
  ON public.promotions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update promotions"
  ON public.promotions FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete promotions"
  ON public.promotions FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Public read for active promos (needed for customer-facing displays)
CREATE POLICY "Anyone can view active promotions"
  ON public.promotions FOR SELECT
  TO anon
  USING (is_active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
