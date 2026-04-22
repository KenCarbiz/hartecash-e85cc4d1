
ALTER TABLE public.submissions
ADD COLUMN appointment_date date,
ADD COLUMN appointment_set boolean NOT NULL DEFAULT false;
