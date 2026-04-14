-- Pricing v2 — overage support
--
-- AutoFrame is inventory-gated. A dealer on the "Up to 70 units" tier
-- who occasionally floats between 70–80 units shouldn't be forced to
-- upgrade to the next tier just to cover a handful of overage units.
-- We price a small per-unit overage that caps out at the next tier's
-- price (enforced in application logic, not DB).
--
-- Schema-only here; billing is not wired (no Stripe yet). The admin
-- account manager sees the accumulated overage in the admin UI and
-- invoices manually until Stripe usage-based billing lands.

ALTER TABLE public.platform_product_tiers
  ADD COLUMN IF NOT EXISTS allow_overage boolean NOT NULL DEFAULT false;

ALTER TABLE public.platform_product_tiers
  ADD COLUMN IF NOT EXISTS overage_price_per_unit numeric(10, 2);

-- Seed the AutoFrame overage rates. $10/unit over cap feels right given
-- tier delta math: 120-unit tier is $200 more than 70-unit, so 20 overage
-- units beyond the 70-cap roughly equals upgrading. The UI renders this
-- as "Overage: $10 per additional unit".
UPDATE public.platform_product_tiers
   SET allow_overage = true,
       overage_price_per_unit = 10.00,
       updated_at = now()
 WHERE id IN ('autoframe_70', 'autoframe_120');

-- The unlimited tier has no cap, so no overage. Explicitly null for
-- clarity.
UPDATE public.platform_product_tiers
   SET allow_overage = false,
       overage_price_per_unit = NULL,
       updated_at = now()
 WHERE id = 'autoframe_unlimited';
