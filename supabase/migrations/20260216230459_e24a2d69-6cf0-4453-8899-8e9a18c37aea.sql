
ALTER TABLE public.submissions ADD COLUMN lead_source text NOT NULL DEFAULT 'inventory';

COMMENT ON COLUMN public.submissions.lead_source IS 'Source of the lead: inventory (hartecash.com) or service (hartecars.com/service)';
