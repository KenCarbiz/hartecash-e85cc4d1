
-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_token TEXT REFERENCES submissions(token),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  vehicle_info TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Anyone can create appointments (public form)
CREATE POLICY "Anyone can create appointments"
ON public.appointments FOR INSERT
WITH CHECK (true);

-- Staff can read all appointments
CREATE POLICY "Staff can read appointments"
ON public.appointments FOR SELECT
USING (is_staff(auth.uid()));

-- Staff can update appointments
CREATE POLICY "Staff can update appointments"
ON public.appointments FOR UPDATE
USING (is_staff(auth.uid()));

-- Staff can delete appointments
CREATE POLICY "Staff can delete appointments"
ON public.appointments FOR DELETE
USING (is_staff(auth.uid()));
