-- Add an embed_config jsonb column to site_config so the dynamic embed
-- loader can serve runtime config to dealer websites. Once the dealer's
-- web provider installs the loader snippet ONCE, every change inside
-- EmbedToolkit propagates to the live site within ~30 seconds (CDN TTL).
--
-- Shape (all keys optional; loader applies sensible defaults for any missing):
--   {
--     "buttonColor":  "#003B80",
--     "buttonText":   "Get Cash Offer",
--     "drawerTitle":  "Get Your Trade-In Value",
--     "openMode":     "drawer" | "new-tab",
--     "widgetPosition": "bottom-right",
--     "stickyText":   "...",
--     "stickyCtaText": "...",
--     "stickyPosition": "bottom" | "top",
--     "bannerHeadline": "...",
--     "bannerText":   "...",
--     "bannerCtaText": "...",
--     "pptButtonText": "...",
--     "pptEnabled":   true | false,
--     "saleBanner": { "active": true, "text": "...", "ctaText": "...", "expires_at": "..." } | null,
--     "activeAssets": ["iframe", "widget", "sticky", ...]
--   }
--
-- Existing dealers stay on their static snippets until they opt into the
-- new loader; the field defaults to '{}' so reading is always safe.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS embed_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.site_config.embed_config IS
  'Runtime config served by the embed-config edge function to the dynamic embed-loader.js. Updated from EmbedToolkit; consumed by dealer websites.';
