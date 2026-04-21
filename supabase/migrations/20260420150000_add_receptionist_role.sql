-- Add the Receptionist role.
--
-- Receptionist is the thinnest permission tier on the platform — they
-- check customers in at the desk, see today's appointments, and hand
-- off to an inspector or salesperson. No access to pricing, book
-- values, condition data, or the rest of the customer file.
--
-- Typical use: front-desk staff at franchise stores, or a dual-role
-- receptionist/BDC-assistant at independent shops. Keeping the role
-- narrow prevents scope creep — if a store wants their receptionist
-- to also handle BDC functions, they get promoted to sales_bdc.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';

NOTIFY pgrst, 'reload schema';
