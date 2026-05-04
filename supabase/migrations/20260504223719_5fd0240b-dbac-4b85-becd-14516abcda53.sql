ALTER TABLE site_config
  ADD COLUMN IF NOT EXISTS condition_card_style TEXT
    NOT NULL DEFAULT 'basic';

ALTER TABLE site_config
  DROP CONSTRAINT IF EXISTS site_config_condition_card_style_check;

ALTER TABLE site_config
  ADD CONSTRAINT site_config_condition_card_style_check
    CHECK (condition_card_style IN ('basic', 'kbb'));

NOTIFY pgrst, 'reload schema';