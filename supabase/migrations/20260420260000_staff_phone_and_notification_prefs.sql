-- Staff phone numbers + opt-in flags for SMS notifications.
--
-- F1 (staff push notifications) relies on the platform being able to
-- text a specific rep when a specific event happens — reception hits
-- "Notify Sales Rep", and that rep's phone needs to be dial-able.
-- Prior to this migration the only phone column on user_roles was
-- absent, so those calls fell back to the admin-level broadcast list.
--
-- Two columns added:
--
-- phone — the staff member's cell. Dealer admin captures this in
-- Staff & Permissions (or each staff member can self-serve).
--
-- sms_notifications_opted_in — boolean. Respects TCPA compliance.
-- True = explicit opt-in, staff can receive work SMS. Defaults true
-- since the dealer gave us this number for work purposes (internal
-- business communication, not marketing), but staff can flip to
-- false to stop receiving SMS.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS sms_notifications_opted_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notifications_opted_in boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_roles.phone IS
  'Staff member''s cell phone for work SMS notifications (escalations, customer-arrived, etc.). Captured in Staff & Permissions or self-serve on the staff member''s profile. Respects sms_notifications_opted_in.';
COMMENT ON COLUMN public.user_roles.email IS
  'Staff member''s work email (mirrored from auth.users for easy lookup without a join). Updated when auth email changes; the Staff & Permissions admin surface exposes it.';
COMMENT ON COLUMN public.user_roles.sms_notifications_opted_in IS
  'Per-staff SMS opt-in. Default true — the dealer collected this number for internal business communication, which is TCPA-exempt. Staff can flip to false on their profile to stop receiving.';
COMMENT ON COLUMN public.user_roles.email_notifications_opted_in IS
  'Per-staff email opt-in. Same semantic as SMS.';

-- Backfill email from auth.users so existing rows are searchable.
UPDATE public.user_roles ur
SET email = au.email
FROM auth.users au
WHERE ur.user_id = au.id
  AND (ur.email IS NULL OR ur.email = '');

CREATE INDEX IF NOT EXISTS user_roles_email_idx
  ON public.user_roles (email)
  WHERE email IS NOT NULL;

NOTIFY pgrst, 'reload schema';
