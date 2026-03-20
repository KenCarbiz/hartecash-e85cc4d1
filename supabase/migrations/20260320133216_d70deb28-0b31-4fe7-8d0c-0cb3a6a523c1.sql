
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS review_requested boolean NOT NULL DEFAULT false;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;

ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS review_request_subject text NOT NULL DEFAULT 'We''d Love Your Feedback!';
ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS review_request_message text NOT NULL DEFAULT 'Thank you for choosing us! We hope you had a great experience selling your vehicle. Would you take a moment to share your feedback? Your review helps other car owners make the right choice.';
