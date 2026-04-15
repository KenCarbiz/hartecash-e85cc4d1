-- AutoCurb annual prepaid: $1,499/mo → $1,699/mo equivalent.
-- $1,699 × 12 = $20,388 annual upfront.

UPDATE public.platform_product_tiers
   SET annual_price = 20388.00,
       updated_at   = now()
 WHERE id = 'autocurb_standard';
