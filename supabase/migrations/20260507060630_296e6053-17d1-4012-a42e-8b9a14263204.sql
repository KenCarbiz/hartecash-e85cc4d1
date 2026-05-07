-- document_config: per-tenant catalog of customer documents.
CREATE TABLE IF NOT EXISTS public.document_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  doc_id text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'optional',
  conditional_on text,
  ocr_pipeline text,
  customer_visible boolean NOT NULL DEFAULT true,
  staff_only boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, doc_id)
);

ALTER TABLE public.document_config
  DROP CONSTRAINT IF EXISTS document_config_role_chk;
ALTER TABLE public.document_config
  ADD  CONSTRAINT document_config_role_chk
  CHECK (role IN ('off','optional','required','conditional'));

ALTER TABLE public.document_config
  DROP CONSTRAINT IF EXISTS document_config_conditional_chk;
ALTER TABLE public.document_config
  ADD  CONSTRAINT document_config_conditional_chk
  CHECK (
    conditional_on IS NULL
    OR conditional_on IN ('has_loan','has_lease')
  );

ALTER TABLE public.document_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage own tenant document config" ON public.document_config;
CREATE POLICY "Admins can manage own tenant document config"
  ON public.document_config FOR ALL TO authenticated
  USING  (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Anyone can read document config" ON public.document_config;
CREATE POLICY "Anyone can read document config"
  ON public.document_config FOR SELECT TO public
  USING (true);

INSERT INTO public.document_config
  (dealership_id, doc_id, label, description, role, conditional_on,
   ocr_pipeline, customer_visible, staff_only, sort_order)
VALUES
  ('default','drivers_license_front','Driver''s License (front)',
   'All four corners visible, no glare','required',NULL,
   'parse-drivers-license', true, false, 0),
  ('default','drivers_license_back','Driver''s License (back)',
   'Back of the card','optional',NULL,
   NULL, true, false, 1),
  ('default','title_front','Title (front)',
   'Front of the title — VIN + owner of record visible','required',NULL,
   'parse-title-vin', true, false, 10),
  ('default','title_back','Title (back)',
   'Back of the title — assignment / lien release if any','optional',NULL,
   NULL, true, false, 11),
  ('default','registration','Registration',
   'Current registration, owner name visible','optional',NULL,
   NULL, true, false, 20),
  ('default','payoff_verification','Loan payoff statement',
   'Required if you have a loan on the vehicle','conditional','has_loan',
   NULL, true, false, 30),
  ('default','lease_buyout','Lease buyout quote',
   'Required if your vehicle is on a lease','conditional','has_lease',
   NULL, true, false, 31),
  ('default','appraisal','Appraisal',
   'Internal appraisal worksheet','optional',NULL,
   NULL, false, true, 100),
  ('default','carfax','Carfax',
   'Vehicle history report','optional',NULL,
   NULL, false, true, 101),
  ('default','window_sticker','Window Sticker',
   'Original Monroney sticker if available','optional',NULL,
   NULL, false, true, 102),
  ('default','title_inquiry','Title Inquiry',
   'DMV title inquiry response','optional',NULL,
   NULL, false, true, 103)
ON CONFLICT (dealership_id, doc_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS document_config_dealer_role_idx
  ON public.document_config (dealership_id, role)
  WHERE role <> 'off';

NOTIFY pgrst, 'reload schema';