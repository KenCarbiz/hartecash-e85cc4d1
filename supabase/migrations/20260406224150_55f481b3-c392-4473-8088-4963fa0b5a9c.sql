
-- 1. Create harte-auto tenant
INSERT INTO public.tenants (dealership_id, slug, display_name, is_active)
VALUES ('harte-auto', 'harte-auto', 'Harte Auto Group', true);

-- 2. Seed site_config for harte-auto
INSERT INTO public.site_config (dealership_id, dealership_name, tagline, hero_headline, hero_subtext, primary_color, accent_color, success_color, cta_offer_color, cta_accept_color)
VALUES ('harte-auto', 'Harte Auto Group', 'Your Trusted Auto Partner', 'Get a Cash Offer in Minutes', 'Fast, Fair, and Easy.', '#1a365d', '#2563eb', '#16a34a', '#2563eb', '#16a34a');

-- 3. Seed form_config
INSERT INTO public.form_config (dealership_id) VALUES ('harte-auto');

-- 4. Seed offer_settings
INSERT INTO public.offer_settings (dealership_id) VALUES ('harte-auto');

-- 5. Seed notification_settings
INSERT INTO public.notification_settings (dealership_id) VALUES ('harte-auto');

-- 6. Seed inspection_config
INSERT INTO public.inspection_config (dealership_id) VALUES ('harte-auto');

-- 7. Move Yousif from default → harte-auto (admin)
UPDATE public.user_roles
SET dealership_id = 'harte-auto'
WHERE user_id = '3d1d573a-b7fd-45bb-905d-54258813ced5'
  AND dealership_id = 'default';

-- 8. Move Colton from default → harte-auto (gsm_gm)
UPDATE public.user_roles
SET dealership_id = 'harte-auto'
WHERE user_id = '7c16280a-9a66-4cfc-b216-2fa88fe99574'
  AND dealership_id = 'default';
