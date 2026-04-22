-- Drop and re-add foreign keys with ON DELETE CASCADE
ALTER TABLE public.activity_log DROP CONSTRAINT activity_log_submission_id_fkey;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_submission_id_fkey 
  FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;

ALTER TABLE public.appointments DROP CONSTRAINT appointments_submission_token_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_submission_token_fkey 
  FOREIGN KEY (submission_token) REFERENCES public.submissions(token) ON DELETE CASCADE;