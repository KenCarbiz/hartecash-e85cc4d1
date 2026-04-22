
ALTER TABLE public.submissions
ADD COLUMN appraisal_finalized boolean NOT NULL DEFAULT false,
ADD COLUMN appraisal_finalized_at timestamp with time zone,
ADD COLUMN appraisal_finalized_by text;
