UPDATE auth.users
SET encrypted_password = crypt('Summer1234!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = 'e4f28838-c47b-476f-88af-2e8090956bf4';