-- Dealer Costs: add a "packed warranty" cost alongside recon_cost and
-- dealer_pack on offer_settings. Internal profit-analysis input only
-- (like recon/pack it never reduces the customer offer) — surfaced in the
-- Pricing Engine Deal Cockpit's Cost-to-Market and Max-Offer ceiling.
--
-- Idempotent + schema reload per the repo migration rules.

ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS pack_warranty numeric NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
