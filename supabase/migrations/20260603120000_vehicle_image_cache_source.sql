-- Record the origin of each cached vehicle image so the customer portal
-- can present it correctly: real photos (Black Book / Wikipedia) are
-- framed edge-to-edge like a photo card, while AI / studio renders are
-- clean white-background cutouts that float with a drop shadow.
--
-- Idempotent: safe to re-run / apply out of order.
ALTER TABLE public.vehicle_image_cache
  ADD COLUMN IF NOT EXISTS image_source text;

-- Let PostgREST pick up the new column without a restart.
NOTIFY pgrst, 'reload schema';
