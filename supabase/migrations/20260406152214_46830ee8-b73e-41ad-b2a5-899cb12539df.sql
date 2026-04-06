ALTER TABLE public.dealership_locations
ADD COLUMN about_hero_headline text DEFAULT NULL,
ADD COLUMN about_hero_subtext text DEFAULT NULL,
ADD COLUMN about_story text DEFAULT NULL,
ADD COLUMN use_corporate_about boolean NOT NULL DEFAULT true;