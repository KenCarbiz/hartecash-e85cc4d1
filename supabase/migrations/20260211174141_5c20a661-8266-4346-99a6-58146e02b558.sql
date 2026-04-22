
-- Add progress_status column to track deal pipeline stages
ALTER TABLE public.submissions 
ADD COLUMN progress_status text NOT NULL DEFAULT 'new';

-- Add offered_price for tracking the agreed price
ALTER TABLE public.submissions
ADD COLUMN offered_price numeric NULL;

-- Add notes for internal team notes
ALTER TABLE public.submissions
ADD COLUMN internal_notes text NULL;

-- Add who last updated the status
ALTER TABLE public.submissions
ADD COLUMN status_updated_by text NULL;

-- Add when status was last updated
ALTER TABLE public.submissions
ADD COLUMN status_updated_at timestamp with time zone NULL;
