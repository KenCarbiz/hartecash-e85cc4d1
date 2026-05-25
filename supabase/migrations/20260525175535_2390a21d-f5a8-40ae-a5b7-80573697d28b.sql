ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin';
ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS moderated_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'testimonials_status_check'
  ) THEN
    ALTER TABLE public.testimonials
      ADD CONSTRAINT testimonials_status_check
      CHECK (status IN ('pending', 'approved', 'denied'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'testimonials_source_check'
  ) THEN
    ALTER TABLE public.testimonials
      ADD CONSTRAINT testimonials_source_check
      CHECK (source IN ('token', 'public', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS testimonials_dealership_status_idx
  ON public.testimonials (dealership_id, status);

CREATE OR REPLACE FUNCTION public.scrub_anon_testimonial_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    NEW.is_active := false;
    NEW.status := 'pending';
    NEW.moderated_at := NULL;
    NEW.moderated_by := NULL;
    NEW.sort_order := COALESCE(NEW.sort_order, 99);
    IF NEW.source IS NULL OR NEW.source NOT IN ('token', 'public') THEN
      NEW.source := 'public';
    END IF;
    IF NEW.rating IS NULL OR NEW.rating < 1 THEN
      NEW.rating := 5;
    ELSIF NEW.rating > 5 THEN
      NEW.rating := 5;
    END IF;
    IF NEW.dealership_id IS NULL THEN
      NEW.dealership_id := 'default';
    ELSIF NEW.dealership_id <> 'default'
       AND NOT EXISTS (
         SELECT 1 FROM public.tenants t WHERE t.dealership_id = NEW.dealership_id
       ) THEN
      NEW.dealership_id := 'default';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrub_anon_testimonial_insert_trg ON public.testimonials;
CREATE TRIGGER scrub_anon_testimonial_insert_trg
BEFORE INSERT ON public.testimonials
FOR EACH ROW
EXECUTE FUNCTION public.scrub_anon_testimonial_insert();

NOTIFY pgrst, 'reload schema';