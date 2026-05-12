CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  INSERT INTO public.pending_admin_requests (user_id, email, status)
  SELECT NEW.id, NEW.email, 'pending'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.pending_admin_requests par
    WHERE par.user_id = NEW.id
      AND par.status = 'pending'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.id
  );

  RETURN NEW;
END;
$$;

INSERT INTO public.pending_admin_requests (user_id, email, status)
SELECT p.user_id, p.email, 'pending'
FROM public.profiles p
WHERE p.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.pending_admin_requests par
    WHERE par.user_id = p.user_id
      AND par.status = 'pending'
  );

NOTIFY pgrst, 'reload schema';