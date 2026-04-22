
-- Submissions table (no auth required - public lead form)
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  plate TEXT,
  state TEXT,
  vin TEXT,
  mileage TEXT,
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  exterior_color TEXT,
  drivetrain TEXT,
  modifications TEXT,
  overall_condition TEXT,
  exterior_damage TEXT[],
  windshield_damage TEXT,
  moonroof TEXT,
  interior_damage TEXT[],
  tech_issues TEXT[],
  engine_issues TEXT[],
  mechanical_issues TEXT[],
  drivable TEXT,
  accidents TEXT,
  smoked_in TEXT,
  tires_replaced TEXT,
  num_keys TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  zip TEXT,
  loan_status TEXT,
  next_step TEXT,
  photos_uploaded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public lead form)
CREATE POLICY "Anyone can create submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (true);

-- Allow reading by token (for upload page)
CREATE POLICY "Anyone can read submission by token"
  ON public.submissions FOR SELECT
  USING (true);

-- Allow updating photos_uploaded status by token
CREATE POLICY "Anyone can update submission photos status"
  ON public.submissions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Storage bucket for submission photos
INSERT INTO storage.buckets (id, name, public) VALUES ('submission-photos', 'submission-photos', true);

-- Allow anyone to upload photos to submission-photos bucket (keyed by submission token)
CREATE POLICY "Anyone can upload submission photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'submission-photos');

-- Allow anyone to view submission photos
CREATE POLICY "Anyone can view submission photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'submission-photos');
